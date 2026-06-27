import {
    _decorator,
    AssetManager,
    assetManager,
    Component,
    director,
    Label,
    Layers,
    Node,
    Prefab,
    ProgressBar,
    sys,
    tween,
    Tween,
    UIOpacity,
} from 'cc';
import { MemoryMonitor } from './MemoryMonitor';
import { AsyncLoadQueue } from './AsyncLoadQueue';
import { BundlePrefabConfig } from './BundlePrefabConfig';
import { RemotePrefabCache } from './RemotePrefabCache';
import { RuntimePerfOverlay } from '../tools/RuntimePerfOverlay';
import { UIManager, UIPanelId } from '../X/ui/UIManager';

const { ccclass, property } = _decorator;

const WAITING_PROGRESS_CAP = 0.94;
const DISPLAY_COMPLETE_THRESHOLD = 0.935;
const AUTH_PROGRESS = 0.08;
const FINISH_FILL_DURATION = 0.42;
const FINISH_HOLD_DURATION = 0.18;
const MASK_FADE_DURATION = 0.36;
const MAX_CONCURRENT = 4;
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const FRAME_SLICE_BUDGET_MS = 16;
const MAX_CALLBACKS_PER_SLICE = 4;

interface LoadFrameSliceState {
    startedAt: number;
    processedCount: number;
    yieldPromise: Promise<void> | null;
}

interface DownloaderTuning {
    maxConcurrency?: number;
    maxRequestsPerFrame?: number;
    retryCount?: number;
    retryInterval?: number;
}

export interface IRemoteSceneLoaderDynamicBundle {
    bundleName: string;
    prefabPaths: string[];
}

export interface IRemoteSceneLoaderTips {
    preparing?: string;
    downloading?: string;
    entering?: string;
    failed?: string;
}

export interface IRemoteSceneLoaderOpenParams {
    sceneName?: string;
    bundles?: ReadonlyArray<IRemoteSceneLoaderDynamicBundle>;
    tips?: IRemoteSceneLoaderTips;
    autoStart?: boolean;
}

@ccclass('RemoteSceneLoader')
export class RemoteSceneLoader extends Component {
    /**
     * 供 UIManager 注册的生命周期脚本识别使用。
     */
    public uiPanelId: string = '';

    @property
    public targetSceneName: string = '';

    @property({ type: [BundlePrefabConfig] })
    public bundleConfigs: BundlePrefabConfig[] = [];

    @property(Node)
    public loadingMask: Node | null = null;

    @property(ProgressBar)
    public progressBar: ProgressBar | null = null;

    @property(Label)
    public progressLabel: Label | null = null;

    @property(Label)
    public tipLabel: Label | null = null;

    @property({
        tooltip: '是否启用 Runtime Perf 调试面板。关闭后不会创建，也不会继续运行采样。',
    })
    public enableRuntimePerfOverlay: boolean = false;

    @property
    public allowRepeatedClick: boolean = false;

    private _isLoading = false;
    private _transitionStarted = false;
    private _loadFinished = false;

    private _actualProgress = 0;
    private _targetProgress = 0;
    private _displayProgress = 0;
    private _displayPercent = 0;
    private _elapsed = 0;

    private _totalTasks = 0;
    private _completedTasks = 0;
    private _currentTip = '';

    private _maskOpacity: UIOpacity | null = null;
    private _tipOpacity: UIOpacity | null = null;
    private _dynamicTargetSceneName = '';
    private _dynamicBundleConfigs: BundlePrefabConfig[] | null = null;
    private _dynamicTips: IRemoteSceneLoaderTips | null = null;

    onLoad() {
        this.configureMiniGameDownloader();
        RuntimePerfOverlay.setEnabled(this.enableRuntimePerfOverlay);
        // 尽早挂上内存监控，保证加载阶段本身也能收到内存告警。
        MemoryMonitor.ensureMounted(this.node);
        this.ensureVisibleUiLayer();
        this.ensureTipLabelSupportsChinese();
        this.ensureMaskOpacity();
        this.ensureTipOpacity();
        this.resetVisualState();
    }

    protected start(): void {
        // 作为独立加载页使用时，仍然支持通过 Inspector 配置后自动启动。
        if (this.targetSceneName) {
            void this.onClickLoadAndGo();
        }
    }

    protected onDisable(): void {
        this.stopRuntimeTweens();
        this.unschedule(this.tickDisplayProgress);
    }

    /**
     * 供 UIManager 统一调用的打开生命周期。
     * 当 TransitionScreen 作为弹窗打开时，会优先使用动态参数覆盖 Inspector 配置。
     */
    public onUIOpen(params?: IRemoteSceneLoaderOpenParams): void {
        if (params?.sceneName && params.bundles) {
            this.initDynamicTask(params.sceneName, params.bundles, params.tips);
        } else {
            this.clearDynamicTask();
        }

        if (params?.autoStart ?? true) {
            void this.onClickLoadAndGo();
        }
    }

    /**
     * 允许通过代码动态覆盖目标场景和 bundle 任务。
     * 这样同一个 TransitionScreen prefab 可以复用于多条跳转链路。
     */
    public initDynamicTask(
        sceneName: string,
        bundles: ReadonlyArray<IRemoteSceneLoaderDynamicBundle>,
        tips?: IRemoteSceneLoaderTips,
    ): void {
        this._dynamicTargetSceneName = sceneName;
        this._dynamicBundleConfigs = bundles.map((item) => {
            const cfg = new BundlePrefabConfig();
            cfg.bundleName = item.bundleName;
            cfg.prefabPaths = [...item.prefabPaths];
            return cfg;
        });
        this._dynamicTips = tips ? { ...tips } : null;
    }

    private clearDynamicTask(): void {
        this._dynamicTargetSceneName = '';
        this._dynamicBundleConfigs = null;
        this._dynamicTips = null;
    }

    public async onClickLoadAndGo() {
        if (!this.allowRepeatedClick && this._isLoading) {
            return;
        }

        const sceneName = this.getActiveTargetSceneName();
        const bundleConfigs = this.getActiveBundleConfigs();
        const tips = this.getActiveTips();

        if (!sceneName) {
            console.warn('[RemoteSceneLoader] targetSceneName 未配置');
            return;
        }

        this._isLoading = true;
        this._transitionStarted = false;
        this._loadFinished = false;
        this._elapsed = 0;
        this._actualProgress = 0;
        this._targetProgress = 0;
        this._displayProgress = 0;
        this._displayPercent = 0;
        this._completedTasks = 0;
        this._totalTasks = this.computeTotalTasks(bundleConfigs);

        this.ensureVisibleUiLayer();
        this.ensureTipLabelSupportsChinese();
        this.ensureMaskOpacity();
        this.ensureTipOpacity();
        this.resetVisualState();

        // 新一轮远程加载前，先清掉上一场景遗留的 Bundle。
        await this.cleanupBeforeLoad(bundleConfigs);

        if (this.loadingMask) {
            this.loadingMask.active = true;
        }

        this.startTipPulse();
        this.setTip(tips.preparing);

        this._displayProgress = AUTH_PROGRESS;
        this.updateProgress(this._displayProgress);

        const validConfigs = bundleConfigs.filter(
            (cfg) => cfg.bundleName && cfg.prefabPaths.length > 0,
        );

        if (validConfigs.length === 0) {
            this.setTip(tips.entering);
            await this.playFinishAndTransition();
            this.loadSceneAndReleaseManagedPopup(sceneName);
            return;
        }

        this.setTip(tips.downloading);
        this.unschedule(this.tickDisplayProgress);
        this.schedule(this.tickDisplayProgress, 0);

        this.startLoadFlow(validConfigs)
            .then(async () => {
                this._loadFinished = true;
                this._actualProgress = 1;
                this._targetProgress = WAITING_PROGRESS_CAP;
                this.setTip(tips.entering);
                await this.waitForDisplayProgress(DISPLAY_COMPLETE_THRESHOLD);
                await this.playFinishAndTransition();
                this.loadSceneAndReleaseManagedPopup(sceneName);
            })
            .catch((err) => {
                console.error('[RemoteSceneLoader] 资源加载失败:', err);
                this.handleFailure(tips.failed);
            });
    }

    public onClickRetry() {
        this.onClickLoadAndGo();
    }

    private async cleanupBeforeLoad(configs: ReadonlyArray<BundlePrefabConfig>): Promise<void> {
        const shouldTriggerGc =
            sys.isNative ||
            sys.platform === sys.Platform.WECHAT_GAME ||
            sys.platform === sys.Platform.BYTEDANCE_MINI_GAME;
        if (shouldTriggerGc) {
            const gc = (sys as typeof sys & { garbageCollect?: () => void }).garbageCollect;
            if (typeof gc === 'function') {
                gc.call(sys);
                console.log('[RemoteSceneLoader] Triggered active garbage collection');
            }
        }

        const bundleNames = Array.from(
            new Set(
                configs
                    .map((cfg) => cfg.bundleName)
                    .filter((bundleName) => !!bundleName),
            ),
        );

        // 按 Bundle 清理，避免预加载阶段把旧场景资源继续堆在内存里。
        for (const bundleName of bundleNames) {
            RemotePrefabCache.clearBundle(bundleName);
        }

        await Promise.resolve();
    }

    private async startLoadFlow(configs: BundlePrefabConfig[]): Promise<void> {
        const tips = this.getActiveTips();

        for (const cfg of configs) {
            this.setTip(tips.downloading);

            const bundle = await this.loadBundle(cfg.bundleName);
            this.advanceRealProgress(1);

            await this.preloadPrefabsInBundle(bundle, cfg.bundleName, cfg.prefabPaths);
        }
    }

    private loadBundle(name: string): Promise<AssetManager.Bundle> {
        return new Promise((resolve, reject) => {
            assetManager.loadBundle(name, (err, bundle) => {
                if (err || !bundle) {
                    reject(err ?? new Error(`Bundle 加载失败: ${name}`));
                    return;
                }

                resolve(bundle);
            });
        });
    }

    private configureMiniGameDownloader() {
        const isMiniGamePlatform =
            sys.platform === sys.Platform.WECHAT_GAME ||
            sys.platform === sys.Platform.BYTEDANCE_MINI_GAME;

        if (!isMiniGamePlatform) {
            return;
        }

        const downloader = assetManager.downloader as typeof assetManager.downloader & DownloaderTuning;

        // 小游戏平台的远程请求并发和临时文件链路都比较脆弱，统一压低并发并增加重试。
        downloader.maxConcurrency = 2;
        if (typeof downloader.maxRequestsPerFrame === 'number') {
            downloader.maxRequestsPerFrame = Math.min(downloader.maxRequestsPerFrame, 2);
        }
        downloader.retryCount = Math.max(downloader.retryCount ?? 0, 6);
        downloader.retryInterval = Math.max(downloader.retryInterval ?? 0, 1500);

        console.log('[RemoteSceneLoader] Mini-game remote downloader tuning applied.', {
            platform: sys.platform,
            maxConcurrency: downloader.maxConcurrency,
            maxRequestsPerFrame: downloader.maxRequestsPerFrame,
            retryCount: downloader.retryCount,
            retryInterval: downloader.retryInterval,
        });
    }

    private preloadPrefabsInBundle(
        bundle: AssetManager.Bundle,
        bundleName: string,
        paths: string[],
    ): Promise<void> {
        if (!paths || paths.length === 0) {
            return Promise.resolve();
        }

        return this.preloadPrefabsWithQueue(bundle, bundleName, paths);
    }

    private tickDisplayProgress(dt: number) {
        if (!this._isLoading) {
            return;
        }

        this._elapsed += dt;
        this.updateTargetProgress();

        const diff = this._targetProgress - this._displayProgress;
        if (diff <= 0) {
            return;
        }

        let catchUp = diff * Math.min(1, dt * 9);
        if (diff > 0.2) {
            catchUp = Math.max(catchUp, dt * 0.55);
        } else if (diff > 0.08) {
            catchUp = Math.max(catchUp, dt * 0.28);
        } else {
            catchUp = Math.max(catchUp, dt * 0.12);
        }

        this._displayProgress = Math.min(this._targetProgress, this._displayProgress + catchUp);
        this.updateProgress(this._displayProgress);
        this.updateTipByDisplayedProgress();
    }

    private preloadPrefabsWithQueue(
        bundle: AssetManager.Bundle,
        bundleName: string,
        paths: string[],
    ): Promise<void> {
        const queue = new AsyncLoadQueue(MAX_CONCURRENT);

        // 多个 worker 共用一个时间片，避免回调集中返回时长时间占住主线程。
        const frameSliceState = this.createLoadFrameSliceState();

        return queue.run(paths, async (path) => {
            const prefab = await this.loadPrefabWithRetry(bundle, bundleName, path);
            RemotePrefabCache.set(bundleName, path, prefab);
            this.advanceRealProgress(1);
            await this.maybeYieldForUi(frameSliceState);
        });
    }

    private createLoadFrameSliceState(): LoadFrameSliceState {
        return {
            startedAt: this.getNowMs(),
            processedCount: 0,
            yieldPromise: null,
        };
    }

    private async maybeYieldForUi(state: LoadFrameSliceState): Promise<void> {
        if (state.yieldPromise) {
            await state.yieldPromise;
            return;
        }

        state.processedCount += 1;
        const elapsedMs = this.getNowMs() - state.startedAt;
        const exceededCountBudget = state.processedCount >= MAX_CALLBACKS_PER_SLICE;
        const exceededTimeBudget = elapsedMs >= FRAME_SLICE_BUDGET_MS;

        if (!exceededCountBudget && !exceededTimeBudget) {
            return;
        }

        // 一旦超出当前时间片预算，就主动让出一帧，给进度条和动画刷新机会。
        state.yieldPromise = this.yieldFrame();

        try {
            await state.yieldPromise;
        } finally {
            state.processedCount = 0;
            state.startedAt = this.getNowMs();
            state.yieldPromise = null;
        }
    }

    private async loadPrefabWithRetry(
        bundle: AssetManager.Bundle,
        bundleName: string,
        path: string,
    ): Promise<Prefab> {
        let lastError: unknown = null;

        // 弱网场景下用指数退避重试，避免同一路径被连续猛打。
        for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
            try {
                return await this.loadPrefabOnce(bundle, path);
            } catch (error) {
                lastError = error;
                if (attempt >= RETRY_DELAYS_MS.length) {
                    break;
                }

                const retryDelay = RETRY_DELAYS_MS[attempt];
                console.warn(
                    `[RemoteSceneLoader] Prefab load failed, retrying (${attempt + 1}/${RETRY_DELAYS_MS.length}): ${bundleName}/${path}`,
                    error,
                );
                await this.delayMs(retryDelay);
            }
        }

        throw lastError ?? new Error(`Prefab load failed: ${bundleName}/${path}`);
    }

    private loadPrefabOnce(
        bundle: AssetManager.Bundle,
        path: string,
    ): Promise<Prefab> {
        return new Promise((resolve, reject) => {
            bundle.load(path, Prefab, (err, prefab) => {
                if (err || !prefab) {
                    reject(err ?? new Error(`Prefab load failed: ${bundle.name}/${path}`));
                    return;
                }

                resolve(prefab);
            });
        });
    }

    private updateTargetProgress() {
        const warmupProgress = this.computeWarmupProgress(this._elapsed);
        const actualMappedProgress = Math.min(
            WAITING_PROGRESS_CAP,
            AUTH_PROGRESS + this._actualProgress * (WAITING_PROGRESS_CAP - AUTH_PROGRESS),
        );

        this._targetProgress = Math.max(this._targetProgress, warmupProgress, actualMappedProgress);

        if (!this._loadFinished) {
            this._targetProgress = Math.min(this._targetProgress, WAITING_PROGRESS_CAP);
        }
    }

    private computeWarmupProgress(elapsed: number): number {
        if (elapsed <= 0.25) {
            return this.lerp(AUTH_PROGRESS, 0.16, elapsed / 0.25);
        }
        if (elapsed <= 0.9) {
            return this.lerp(0.16, 0.32, (elapsed - 0.25) / 0.65);
        }
        if (elapsed <= 1.8) {
            return this.lerp(0.32, 0.58, (elapsed - 0.9) / 0.9);
        }
        if (elapsed <= 3.4) {
            return this.lerp(0.58, 0.82, (elapsed - 1.8) / 1.6);
        }
        return this.lerp(0.82, 0.9, Math.min(1, (elapsed - 3.4) / 2.2));
    }

    private computeTotalTasks(configs: BundlePrefabConfig[]): number {
        let total = 0;
        for (const cfg of configs) {
            total += 1;
            total += cfg.prefabPaths.length;
        }
        return Math.max(total, 1);
    }

    /**
     * 运行时优先使用动态注入的场景名；未注入时回退到 Inspector 配置。
     */
    private getActiveTargetSceneName(): string {
        return this._dynamicTargetSceneName || this.targetSceneName;
    }

    /**
     * 运行时优先使用动态注入的 bundle 配置；未注入时回退到 Inspector 配置。
     */
    private getActiveBundleConfigs(): BundlePrefabConfig[] {
        return this._dynamicBundleConfigs ?? this.bundleConfigs;
    }

    /**
     * 运行时优先使用动态传入的文案。
     * 如果外部没有显式传文案，则根据场景名推断更贴合业务的默认提示。
     */
    private getActiveTips(): Required<IRemoteSceneLoaderTips> {
        const sceneName = this.getActiveTargetSceneName();
        const sceneLabel = this.getSceneDisplayName(sceneName);
        const defaults =
            sceneLabel === '游戏'
                ? {
                      preparing: '正在准备资源',
                      downloading: '正在加载资源',
                      entering: '正在进入游戏',
                      failed: '资源加载失败，请稍后重试',
                  }
                : {
                      preparing: `正在准备${sceneLabel}资源`,
                      downloading: `正在加载${sceneLabel}资源`,
                      entering: `正在进入${sceneLabel}`,
                      failed: `${sceneLabel}资源加载失败，请稍后重试`,
                  };

        return {
            preparing: this._dynamicTips?.preparing ?? defaults.preparing,
            downloading: this._dynamicTips?.downloading ?? defaults.downloading,
            entering: this._dynamicTips?.entering ?? defaults.entering,
            failed: this._dynamicTips?.failed ?? defaults.failed,
        };
    }

    /**
     * 把场景名转换为更适合展示给玩家的中文标签。
     * 这样即使外部没有额外传文案，BattleScene 这类跳转也不会显示成固定的“进入游戏”。
     */
    private getSceneDisplayName(sceneName: string): string {
        if (!sceneName) {
            return '游戏';
        }

        const normalized = sceneName.toLowerCase();
        if (normalized.includes('battle') || sceneName.includes('战斗')) {
            return '战斗';
        }
        if (normalized.includes('story') || sceneName.includes('剧情')) {
            return '剧情';
        }
        if (
            normalized.includes('home') ||
            normalized.includes('lobby') ||
            normalized.includes('main') ||
            sceneName.includes('大厅') ||
            sceneName.includes('主城') ||
            sceneName.includes('主界面')
        ) {
            return '主界面';
        }
        if (normalized.includes('login') || sceneName.includes('登录')) {
            return '登录界面';
        }

        return '游戏';
    }

    private advanceRealProgress(step: number) {
        this._completedTasks += step;
        this._actualProgress = Math.min(1, this._completedTasks / this._totalTasks);
        this.updateTargetProgress();
    }

    private async playFinishAndTransition(): Promise<void> {
        if (this._transitionStarted) {
            return;
        }
        this._transitionStarted = true;

        this.stopTipPulse();
        this.setTip(this.getActiveTips().entering);

        await new Promise<void>((resolve) => {
            const state = { value: Math.max(this._displayProgress, WAITING_PROGRESS_CAP) };
            tween(state)
                .to(FINISH_FILL_DURATION, { value: 1 }, {
                    onUpdate: (target?: { value: number }) => {
                        if (!target) {
                            return;
                        }
                        this._displayProgress = target.value;
                        this.updateProgress(this._displayProgress);
                    },
                })
                .call(() => {
                    this._displayProgress = 1;
                    this.updateProgress(1);
                    resolve();
                })
                .start();
        });

        await this.delay(FINISH_HOLD_DURATION);

        // 如果当前是通过 UIManager 打开的过渡弹窗，就不要提前淡出遮罩。
        // 这样至少能在 loadScene 触发前，稳定盖住旧场景销毁和资源清理过程。
        if (this.uiPanelId) {
            this._isLoading = false;
            this.unschedule(this.tickDisplayProgress);
            return;
        }

        await new Promise<void>((resolve) => {
            if (!this.loadingMask || !this._maskOpacity) {
                resolve();
                return;
            }

            tween(this._maskOpacity)
                .to(MASK_FADE_DURATION, { opacity: 0 })
                .call(() => {
                    if (this.loadingMask) {
                        this.loadingMask.active = false;
                    }
                    resolve();
                })
                .start();
        });

        this._isLoading = false;
        this.unschedule(this.tickDisplayProgress);
    }

    /**
     * 统一从过场页切场景。
     * 如果当前节点是 UIManager 托管的 TransitionScreen，就在新场景加载完成后真正关闭它。
     */
    private loadSceneAndReleaseManagedPopup(sceneName: string): void {
        UIManager.instance.closeGroup('main');
        director.loadScene(sceneName, () => {
            this.releaseManagedPopupIfNeeded();
        });
    }

    /**
     * 当 RemoteSceneLoader 作为 TransitionScreen 弹窗使用时，
     * 在新场景加载完成后关闭托管弹窗，避免持久化 UIRoot 把过渡层残留到下一场景。
     */
    private releaseManagedPopupIfNeeded(): void {
        if (!this.uiPanelId) {
            return;
        }

        UIManager.instance.closePopup(this.uiPanelId as UIPanelId);
    }

    private handleFailure(message: string) {
        this._isLoading = false;
        this._loadFinished = false;
        this._transitionStarted = false;
        this.stopTipPulse();
        this.unschedule(this.tickDisplayProgress);

        if (this._maskOpacity) {
            this._maskOpacity.opacity = 255;
        }

        this.setTip(message);
    }

    private updateProgress(ratio: number) {
        const clamped = Math.max(0, Math.min(1, ratio));
        if (this.progressBar) {
            this.progressBar.progress = clamped;
        }

        const nextPercent = clamped >= 1 ? 100 : Math.min(99, Math.floor(clamped * 100));
        if (nextPercent < this._displayPercent) {
            return;
        }

        this._displayPercent = nextPercent;
        if (this.progressLabel) {
            this.progressLabel.string = `${nextPercent}%`;
        }
    }

    private updateTipByDisplayedProgress() {
        const tips = this.getActiveTips();

        if (this._loadFinished || this._transitionStarted) {
            return;
        }

        if (this._displayProgress < WAITING_PROGRESS_CAP) {
            this.setTip(tips.downloading);
            return;
        }

        this.setTip(tips.entering);
    }

    private setTip(message: string) {
        if (this._currentTip === message) {
            return;
        }

        this._currentTip = message;
        if (this.tipLabel) {
            this.tipLabel.string = message;
        }
    }

    private startTipPulse() {
        if (!this._tipOpacity) {
            return;
        }

        Tween.stopAllByTarget(this._tipOpacity);
        this._tipOpacity.opacity = 255;

        tween(this._tipOpacity)
            .repeatForever(
                tween()
                    .to(0.8, { opacity: 208 })
                    .to(0.8, { opacity: 255 }),
            )
            .start();
    }

    private stopTipPulse() {
        if (!this._tipOpacity) {
            return;
        }

        Tween.stopAllByTarget(this._tipOpacity);
        this._tipOpacity.opacity = 255;
    }

    private ensureMaskOpacity() {
        if (!this.loadingMask) {
            this._maskOpacity = null;
            return;
        }

        this._maskOpacity = this.loadingMask.getComponent(UIOpacity);
        if (!this._maskOpacity) {
            this._maskOpacity = this.loadingMask.addComponent(UIOpacity);
        }
    }

    private ensureTipOpacity() {
        if (!this.tipLabel) {
            this._tipOpacity = null;
            return;
        }

        this._tipOpacity = this.tipLabel.node.getComponent(UIOpacity);
        if (!this._tipOpacity) {
            this._tipOpacity = this.tipLabel.node.addComponent(UIOpacity);
        }
    }

    private ensureTipLabelSupportsChinese() {
        if (!this.tipLabel) {
            return;
        }

        this.tipLabel.font = null;
        this.tipLabel.useSystemFont = true;
        this.tipLabel.fontFamily = 'Arial';
    }

    private ensureVisibleUiLayer() {
        const uiLayer = Layers.Enum.UI_2D;
        this.applyLayerRecursively(this.loadingMask, uiLayer);
        this.applyLayerRecursively(this.progressBar?.node ?? null, uiLayer);
        this.applyLayerRecursively(this.progressLabel?.node ?? null, uiLayer);
        this.applyLayerRecursively(this.tipLabel?.node ?? null, uiLayer);
    }

    private applyLayerRecursively(node: Node | null, layer: number) {
        if (!node) {
            return;
        }

        node.layer = layer;
        for (const child of node.children) {
            this.applyLayerRecursively(child, layer);
        }
    }

    private resetVisualState() {
        this.stopRuntimeTweens();
        this._displayPercent = 0;

        if (this.loadingMask) {
            this.loadingMask.active = false;
        }
        if (this._maskOpacity) {
            this._maskOpacity.opacity = 255;
        }
        if (this._tipOpacity) {
            this._tipOpacity.opacity = 255;
        }

        this._currentTip = '';
        this.updateProgress(0);
        if (this.progressLabel) {
            this.progressLabel.string = '0%';
        }
        if (this.tipLabel) {
            this.tipLabel.string = '';
        }
    }

    private stopRuntimeTweens() {
        if (this._maskOpacity) {
            Tween.stopAllByTarget(this._maskOpacity);
        }
        if (this._tipOpacity) {
            Tween.stopAllByTarget(this._tipOpacity);
        }
    }

    private async waitForDisplayProgress(target: number): Promise<void> {
        return new Promise((resolve) => {
            const check = () => {
                if (this._displayProgress >= target || !this._isLoading) {
                    this.unschedule(check);
                    resolve();
                }
            };

            this.schedule(check, 0);
        });
    }

    private delay(seconds: number): Promise<void> {
        return new Promise((resolve) => {
            this.scheduleOnce(() => resolve(), seconds);
        });
    }

    private yieldFrame(): Promise<void> {
        return new Promise((resolve) => {
            this.scheduleOnce(() => resolve(), 0);
        });
    }

    private delayMs(ms: number): Promise<void> {
        return new Promise((resolve) => {
            this.scheduleOnce(() => resolve(), ms / 1000);
        });
    }

    private getNowMs(): number {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }

        return Date.now();
    }

    private lerp(from: number, to: number, ratio: number) {
        const clamped = Math.max(0, Math.min(1, ratio));
        return from + (to - from) * clamped;
    }
}
