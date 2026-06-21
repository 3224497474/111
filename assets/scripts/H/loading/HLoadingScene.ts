import { _decorator, Component, director, Director, Enum, game, Label, ProgressBar } from 'cc';
import { H } from '../H';
import type { HResourceAssetKind, HResourceBundleTask, HResourceTask } from '../HTypes';

const { ccclass, property } = _decorator;

export enum HLoadingAssetType {
    Asset = 0,
    Prefab = 1,
    SpriteFrame = 2,
    Texture2D = 3,
    AudioClip = 4,
    JsonAsset = 5,
}

Enum(HLoadingAssetType);

@ccclass('HLoadingBundleItem')
export class HLoadingBundleItem {
    @property
    public enabled = true;

    @property
    public name = '';

    @property
    public note = '';

    public toTask(): HResourceBundleTask | null {
        const bundleName = this.name.trim();
        if (!this.enabled || !bundleName) {
            return null;
        }

        return {
            enabled: this.enabled,
            name: bundleName,
            note: this.note,
        };
    }
}

@ccclass('HLoadingResourceItem')
export class HLoadingResourceItem {
    @property
    public enabled = true;

    @property
    public key = '';

    @property
    public bundle = 'resources';

    @property
    public path = '';

    @property({ type: HLoadingAssetType })
    public assetType = HLoadingAssetType.Prefab;

    @property
    public cache = false;

    @property
    public preloadOnly = true;

    @property
    public note = '';

    public toTask(): HResourceTask | null {
        const resourcePath = this.path.trim();
        if (!this.enabled || !resourcePath) {
            return null;
        }

        return {
            key: this.key.trim() || undefined,
            bundle: this.bundle.trim() || undefined,
            path: resourcePath,
            assetType: HLoadingScene.assetTypeToKind(this.assetType),
            cache: this.cache,
            preloadOnly: this.preloadOnly,
        };
    }
}

interface HLoadingPhase {
    name: string;
    start: number;
    end: number;
}

@ccclass('HLoadingScene')
export class HLoadingScene extends Component {
    @property({ tooltip: '首屏加载完成后进入的 Home 场景名。当前项目默认是 home。' })
    public homeSceneName = 'home';

    @property({ tooltip: '是否预加载 Home 场景。开启后进度更真实，切场景黑屏概率更低。' })
    public preloadHomeScene = true;

    @property({ tooltip: 'Loading 最少展示秒数，避免快网环境下一闪而过。' })
    public minShowSeconds = 0.8;

    @property({ tooltip: '显示进度追赶真实进度的速度。值越大越快，但不会超过真实目标进度。' })
    public progressFollowSpeed = 3.8;

    @property({ tooltip: '后台资源下载并发数。建议 1，避免抢首屏和 Home 的带宽。' })
    public backgroundConcurrency = 1;

    @property({ tooltip: '是否自动开始 Loading 流程。' })
    public autoStart = true;

    @property({ tooltip: 'H.data 本地存储命名空间。正式项目建议填游戏名+账号ID，避免不同账号串档。' })
    public dataNamespace = 'H';

    @property({ tooltip: '红点信息存储在 H.data 里的模块名。默认 redDot。' })
    public redDotStorageModuleName = 'redDot';

    @property({ tooltip: 'SDK 登录、启动参数等平台会话信息存储在 H.data 里的模块名。' })
    public sdkSessionStorageModuleName = 'platformSession';

    @property({ tooltip: '是否在 Loading 开局阶段自动调用 H.sdk.login，并存储平台登录返回。' })
    public autoSDKLogin = true;

    @property({ tooltip: '是否在 Loading 初始化时自动读取本地红点数据。' })
    public autoLoadRedDotLocal = true;

    @property({ tooltip: '是否让红点默认都持久化。一般关闭，只给需要保存的红点单独开启 persist。' })
    public persistRedDotByDefault = false;

    @property({ tooltip: '切到 Home 时是否临时保留 Loading 画面，遮住场景切换时的空白帧。' })
    public keepVisibleDuringSceneSwitch = true;

    @property({ tooltip: 'Home 场景加载完成后继续保留 Loading 的帧数，用来等待 Home 首帧 UI 渲染出来。' })
    public keepVisibleAfterHomeFrames = 2;

    @property(ProgressBar)
    public progressBar: ProgressBar | null = null;

    @property(Label)
    public percentLabel: Label | null = null;

    @property(Label)
    public tipLabel: Label | null = null;

    @property(Label)
    public detailLabel: Label | null = null;

    @property(Label)
    public errorLabel: Label | null = null;

    @property({ type: [HLoadingBundleItem], tooltip: '进入 Home 前必须加载完成的 Bundle。只填真正首屏必需的 Bundle。' })
    public firstScreenBundles: HLoadingBundleItem[] = [];

    @property({ type: [HLoadingResourceItem], tooltip: '首屏必须加载的资源，例如首页纹理、必要配置。' })
    public firstScreenResources: HLoadingResourceItem[] = [];

    @property({ type: [HLoadingResourceItem], tooltip: '首屏必须预加载的预制体，例如 Home 主界面和首屏弹窗。' })
    public firstScreenPrefabs: HLoadingResourceItem[] = [];

    @property({ type: [HLoadingBundleItem], tooltip: '进入 Home 前可以顺手预热的小 Bundle。不要放大量 Bundle。' })
    public warmupBundlesBeforeHome: HLoadingBundleItem[] = [];

    @property({ type: [HLoadingBundleItem], tooltip: '进入 Home 后后台下载的大量 Bundle。不会阻塞进入游戏。' })
    public backgroundBundles: HLoadingBundleItem[] = [];

    @property({ type: [HLoadingResourceItem], tooltip: '进入 Home 后后台预加载的不重要资源。不会阻塞进入游戏。' })
    public backgroundResources: HLoadingResourceItem[] = [];

    private targetProgress = 0;
    private displayProgress = 0;
    private loading = false;
    private allowCompleteDisplay = false;
    private startedAt = 0;
    private currentTip = '准备启动';

    public static assetTypeToKind(assetType: HLoadingAssetType): HResourceAssetKind {
        switch (assetType) {
            case HLoadingAssetType.Prefab:
                return 'Prefab';
            case HLoadingAssetType.SpriteFrame:
                return 'SpriteFrame';
            case HLoadingAssetType.Texture2D:
                return 'Texture2D';
            case HLoadingAssetType.AudioClip:
                return 'AudioClip';
            case HLoadingAssetType.JsonAsset:
                return 'JsonAsset';
            default:
                return 'Asset';
        }
    }

    protected start(): void {
        this.resetView();
        if (this.autoStart) {
            void this.startLoading();
        }
    }

    protected update(deltaTime: number): void {
        if (!this.loading) {
            return;
        }

        const cappedTarget = this.allowCompleteDisplay
            ? this.targetProgress
            : Math.min(this.targetProgress, 0.985);
        if (this.displayProgress < cappedTarget) {
            const delta = cappedTarget - this.displayProgress;
            const step = Math.max(0.0015, delta * this.progressFollowSpeed * deltaTime);
            this.displayProgress = Math.min(cappedTarget, this.displayProgress + step);
            this.refreshProgressView();
        }
    }

    public async startLoading(): Promise<void> {
        if (this.loading) {
            return;
        }

        this.loading = true;
        this.startedAt = Date.now();
        this.allowCompleteDisplay = false;
        this.setTargetProgress(0, '准备启动', '初始化启动环境');
        this.clearError();

        const firstScreenBundles = this.toBundleTasks(this.firstScreenBundles);
        const firstScreenResources = this.toResourceTasks(this.firstScreenResources, false);
        const firstScreenPrefabs = this.toResourceTasks(this.firstScreenPrefabs, true);
        const warmupBundles = this.toBundleTasks(this.warmupBundlesBeforeHome);
        const backgroundBundles = this.toBundleTasks(this.backgroundBundles);
        const backgroundResources = this.toResourceTasks(this.backgroundResources, true);

        H.init({
            uiRoot: this.node,
            data: {
                namespace: this.dataNamespace.trim() || 'H',
                modules: [
                    {
                        name: this.redDotStorageModuleName.trim() || 'redDot',
                        defaultValue: {},
                    },
                    {
                        name: this.sdkSessionStorageModuleName.trim() || 'platformSession',
                        defaultValue: {
                            platform: 'unknown',
                            login: null,
                            updatedAt: 0,
                        },
                    },
                    {
                        name: 'remoteConfig',
                        defaultValue: {},
                    },
                    {
                        name: 'analytics',
                        defaultValue: {
                            events: [],
                            updatedAt: 0,
                        },
                    },
                    {
                        name: 'reward',
                        defaultValue: {
                            records: {},
                            updatedAt: 0,
                        },
                    },
                ],
            },
            redDot: {
                storageModuleName: this.redDotStorageModuleName.trim() || 'redDot',
                autoLoadLocal: this.autoLoadRedDotLocal,
                persistByDefault: this.persistRedDotByDefault,
            },
            resource: {
                debug: true,
                backgroundConcurrency: this.backgroundConcurrency,
                criticalBundles: firstScreenBundles,
                preloadBundles: warmupBundles,
                backgroundBundles,
                critical: firstScreenResources,
                preload: firstScreenPrefabs,
                background: backgroundResources,
            },
            sdk: {
                sessionStorageModuleName: this.sdkSessionStorageModuleName.trim() || 'platformSession',
            },
            screen: {
                designWidth: 720,
                designHeight: 1280,
                fitMode: 'auto',
                autoRefresh: true,
            },
        });

        try {
            await this.runStartupFlow();
        } catch (error) {
            this.loading = false;
            console.error('[HLoadingScene] 首屏加载失败:', error);
            this.showError('加载失败，请检查网络后重试');
        }
    }

    public retry(): void {
        this.resetView();
        void this.startLoading();
    }

    private async runStartupFlow(): Promise<void> {
        this.setTargetProgress(0.02, '准备启动', '初始化完成');

        await this.loginPlatformIfNeeded();
        await this.loadCriticalBundles();
        await this.loadCriticalResources();
        await this.loadWarmupBundles();
        await this.preloadFirstScreenPrefabs();
        await this.preloadHomeSceneIfNeeded();

        await this.waitMinimumShowTime();
        this.allowCompleteDisplay = true;
        this.setTargetProgress(1, '加载完成', '正在进入游戏');
        await this.waitForDisplayedProgress(0.985, 1200);

        await this.enterHomeScene();
    }

    private async loginPlatformIfNeeded(): Promise<void> {
        if (!this.autoSDKLogin) {
            return;
        }

        this.setTargetProgress(0.04, '平台登录', '请求平台登录');
        const ret = await H.sdk.login();
        if (ret.ok) {
            this.setTargetProgress(0.06, '平台登录', '平台登录完成');
            return;
        }

        console.warn('[HLoadingScene] 平台登录未完成:', ret.reason, ret.errorMessage || ret.userMessage);
        this.setTargetProgress(0.06, '平台登录', ret.userMessage || '平台登录未完成，继续进入游戏');
    }

    private loadCriticalBundles(): Promise<void> {
        const phase = this.getPhase('加载首屏 Bundle', 0.02, 0.22);
        this.setTargetProgress(phase.start, phase.name, '检查首屏 Bundle');
        return H.resource.loadCriticalBundles(undefined, (finished, total, task) => {
            this.updatePhaseProgress(phase, finished, total, `加载 Bundle：${task.name}`);
        }).then(() => {
            this.setTargetProgress(phase.end, phase.name, '首屏 Bundle 完成');
        });
    }

    private loadCriticalResources(): Promise<void> {
        const phase = this.getPhase('加载首屏资源', 0.22, 0.45);
        this.setTargetProgress(phase.start, phase.name, '加载首屏必要资源');
        return H.resource.loadCritical(undefined, (finished, total, task) => {
            this.updatePhaseProgress(phase, finished, total, `加载资源：${task.path}`);
        }).then(() => {
            this.setTargetProgress(phase.end, phase.name, '首屏资源完成');
        });
    }

    private loadWarmupBundles(): Promise<void> {
        const phase = this.getPhase('预热常用 Bundle', 0.45, 0.56);
        this.setTargetProgress(phase.start, phase.name, '预热常用 Bundle');
        return H.resource.preloadRegisteredBundles((finished, total, task) => {
            this.updatePhaseProgress(phase, finished, total, `预热 Bundle：${task.name}`);
        }).then(() => {
            this.setTargetProgress(phase.end, phase.name, '常用 Bundle 完成');
        });
    }

    private preloadFirstScreenPrefabs(): Promise<void> {
        const phase = this.getPhase('预加载首屏预制体', 0.56, 0.82);
        this.setTargetProgress(phase.start, phase.name, '预加载首屏 UI');
        return H.resource.preloadRegistered((finished, total, task) => {
            this.updatePhaseProgress(phase, finished, total, `预加载：${task.path}`);
        }).then(() => {
            this.setTargetProgress(phase.end, phase.name, '首屏 UI 准备完成');
        });
    }

    private preloadHomeSceneIfNeeded(): Promise<void> {
        const phase = this.getPhase('准备 Home 场景', 0.82, 0.97);
        if (!this.preloadHomeScene) {
            this.setTargetProgress(phase.end, phase.name, '跳过场景预加载');
            return Promise.resolve();
        }

        const sceneName = this.homeSceneName.trim();
        if (!sceneName) {
            return Promise.reject(new Error('[HLoadingScene] homeSceneName 不能为空'));
        }

        this.setTargetProgress(phase.start, phase.name, '预加载 Home 场景');
        return new Promise<void>((resolve, reject) => {
            const anyDirector = director as any;
            anyDirector.preloadScene(
                sceneName,
                (completedCount: number, totalCount: number) => {
                    this.updatePhaseProgress(phase, completedCount, totalCount, '预加载 Home 场景');
                },
                (err: Error | null) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    this.setTargetProgress(phase.end, phase.name, 'Home 场景准备完成');
                    resolve();
                },
            );
        });
    }

    private enterHomeScene(): Promise<void> {
        const sceneName = this.homeSceneName.trim();
        if (!sceneName) {
            return Promise.reject(new Error('[HLoadingScene] homeSceneName 不能为空'));
        }

        const shouldKeepVisible = this.keepVisibleDuringSceneSwitch && !!this.node.parent;
        if (shouldKeepVisible) {
            // 切场景时旧场景会被销毁。把 Loading 节点临时设为常驻，避免中间出现空白帧。
            game.addPersistRootNode(this.node);
        }

        return new Promise((resolve, reject) => {
            director.loadScene(sceneName, (err) => {
                if (err) {
                    this.loading = false;
                    if (shouldKeepVisible) {
                        game.removePersistRootNode(this.node);
                    }
                    console.error('[HLoadingScene] 进入 Home 场景失败:', err);
                    this.showError('进入主界面失败，请重试');
                    reject(err);
                    return;
                }

                // 大量 Bundle 和低优先级资源只在 Home 场景进入后后台下载，避免拖慢首进时间。
                H.resource.startBackground();

                void this.releaseLoadingAfterHomeReady(shouldKeepVisible).then(resolve);
            });
        });
    }

    private async releaseLoadingAfterHomeReady(shouldKeepVisible: boolean): Promise<void> {
        if (!shouldKeepVisible) {
            this.loading = false;
            return;
        }

        await this.waitFrames(Math.max(1, this.keepVisibleAfterHomeFrames));
        this.loading = false;
        game.removePersistRootNode(this.node);
        this.node.destroy();
    }

    private updatePhaseProgress(phase: HLoadingPhase, finished: number, total: number, detail: string): void {
        const safeTotal = Math.max(1, total);
        const ratio = Math.max(0, Math.min(1, finished / safeTotal));
        const nextProgress = phase.start + (phase.end - phase.start) * ratio;
        this.setTargetProgress(nextProgress, phase.name, `${detail} (${finished}/${total})`);
    }

    private setTargetProgress(progress: number, tip?: string, detail?: string): void {
        this.targetProgress = Math.max(this.targetProgress, Math.max(0, Math.min(1, progress)));
        if (tip) {
            this.currentTip = tip;
            if (this.tipLabel) {
                this.tipLabel.string = tip;
            }
        }
        if (detail && this.detailLabel) {
            this.detailLabel.string = detail;
        }
        this.refreshProgressView();
    }

    private refreshProgressView(): void {
        const progress = Math.max(0, Math.min(1, this.displayProgress));
        if (this.progressBar) {
            this.progressBar.progress = progress;
        }
        if (this.percentLabel) {
            const percent = this.allowCompleteDisplay
                ? Math.floor(progress * 100)
                : Math.min(99, Math.floor(progress * 100));
            this.percentLabel.string = `${percent}%`;
        }
        if (this.tipLabel && !this.tipLabel.string) {
            this.tipLabel.string = this.currentTip;
        }
    }

    private toBundleTasks(items: HLoadingBundleItem[]): HResourceBundleTask[] {
        return items
            .map((item) => item.toTask())
            .filter((item): item is HResourceBundleTask => item !== null);
    }

    private toResourceTasks(items: HLoadingResourceItem[], preloadOnly: boolean): HResourceTask[] {
        const tasks: HResourceTask[] = [];
        for (const item of items) {
            const task = item.toTask();
            if (!task) {
                continue;
            }

            tasks.push({
                ...task,
                preloadOnly,
            });
        }
        return tasks;
    }

    private getPhase(name: string, start: number, end: number): HLoadingPhase {
        return {
            name,
            start,
            end,
        };
    }

    private waitMinimumShowTime(): Promise<void> {
        const elapsed = Date.now() - this.startedAt;
        const remain = Math.max(0, this.minShowSeconds * 1000 - elapsed);
        return this.waitMs(remain);
    }

    private waitForDisplayedProgress(progress: number, timeoutMs: number): Promise<void> {
        const startAt = Date.now();
        return new Promise((resolve) => {
            const tick = () => {
                if (this.displayProgress >= progress || Date.now() - startAt >= timeoutMs) {
                    resolve();
                    return;
                }
                setTimeout(tick, 16);
            };
            tick();
        });
    }

    private waitMs(ms: number): Promise<void> {
        if (ms <= 0) {
            return Promise.resolve();
        }
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private waitFrames(frameCount: number): Promise<void> {
        return new Promise((resolve) => {
            let remain = Math.max(1, frameCount);
            const tick = () => {
                remain -= 1;
                if (remain <= 0) {
                    resolve();
                    return;
                }
                director.once(Director.EVENT_AFTER_DRAW, tick);
            };

            director.once(Director.EVENT_AFTER_DRAW, tick);
        });
    }

    private resetView(): void {
        this.loading = false;
        this.targetProgress = 0;
        this.displayProgress = 0;
        this.allowCompleteDisplay = false;
        this.currentTip = '准备启动';
        this.clearError();
        if (this.tipLabel) {
            this.tipLabel.string = '准备启动';
        }
        if (this.detailLabel) {
            this.detailLabel.string = '';
        }
        this.refreshProgressView();
    }

    private showError(message: string): void {
        if (this.errorLabel) {
            this.errorLabel.string = message;
        }
        if (this.tipLabel) {
            this.tipLabel.string = '加载失败';
        }
    }

    private clearError(): void {
        if (this.errorLabel) {
            this.errorLabel.string = '';
        }
    }
}
