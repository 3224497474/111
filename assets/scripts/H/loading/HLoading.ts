import { _decorator, Component, Enum, Label, ProgressBar } from 'cc';
import { H } from '../H';
import type { HResourceAssetKind, HResourceBundleTask, HResourceTask } from '../HTypes';
import { HUIConfigs, HUI } from '../ui/HUIConfig';

const { ccclass, property } = _decorator;

/**
 * Loading 资源类型。
 *
 * 说明：
 * - 这里只用于 Inspector 选择。
 * - 最终会转换成 H.resource 识别的 assetType 字符串。
 */
export enum HLoadingAssetType {
    Asset = 0,
    Prefab = 1,
    SpriteFrame = 2,
    Texture2D = 3,
    AudioClip = 4,
    JsonAsset = 5,
}

Enum(HLoadingAssetType);

/**
 * Loading 完成前需要打开的 UI 类型。
 *
 * 注意：
 * - 这里不会手动 instantiate prefab。
 * - HMain 会根据 openType 调用 H.ui.openPage / openDialog / showTip / open。
 */
export enum HLoadingStartupUIOpenType {
    Auto = 0,
    Page = 1,
    Dialog = 2,
    Tip = 3,
    Loading = 4,
}

Enum(HLoadingStartupUIOpenType);

export enum HLoadingStartupUILayer {
    Auto = 0,
    Layer1 = 1,
    Layer2 = 2,
    Layer3 = 3,
    Dialog = 4,
    Tip = 5,
    Guide = 6,
    Reward = 7,
    Error = 8,
    Transition = 9,
}

Enum(HLoadingStartupUILayer);

/**
 * 必要 Bundle 配置。
 *
 * 说明：
 * - Name 才是真正的 bundle 名。
 * - Note 只是备注，不参与加载。
 */
@ccclass('HLoadingBundleItem')
export class HLoadingBundleItem {
    @property
    public enabled = true;

    @property({ tooltip: 'Bundle 名。例如 home、gui、common。' })
    public name = '';

    @property({ tooltip: '备注，不参与加载。' })
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

/**
 * 必要资源 / 预制体配置。
 *
 * 说明：
 * - Bundle 填真实 bundle 名，例如 home。
 * - Path 填 bundle 内路径，不带扩展名，例如 prefabs/Home。
 * - Preload Only = true 表示只预加载，不自动显示。
 */
@ccclass('HLoadingResourceItem')
export class HLoadingResourceItem {
    @property
    public enabled = true;

    @property({ tooltip: '缓存 key，可选。若该 prefab 需要作为 Startup UI 打开，这里应填写 HUIConfig.ts 里的统一枚举 id，例如 HUI.home。' })
    public key = '';

    @property({ tooltip: '资源所在 Bundle。resources 表示 resources 目录。' })
    public bundle = 'resources';

    @property({ tooltip: '资源路径，不带扩展名。例如 prefabs/Home。' })
    public path = '';

    @property({ type: HLoadingAssetType })
    public assetType = HLoadingAssetType.Prefab;

    @property({ tooltip: '是否缓存资源引用。首屏 UI 预制体一般开启。' })
    public cache = false;

    @property({ tooltip: '是否只预加载。首屏 UI prefab 一般开启，真正显示由 Startup UIs 通过 H.ui 打开。' })
    public preloadOnly = true;

    @property({ tooltip: '是否在 Loading 完成后自动显示该预制体对应的 UI。启用后会直接使用当前 key 作为 uiId，避免再到 Startup UIs 里重复手填。' })
    public showOnStartup = false;

    @property({
        type: HLoadingStartupUIOpenType,
        tooltip: '启动后显示该 UI 的打开方式。建议优先用 Auto，让 H.ui 按注册配置决定。',
    })
    public startupOpenType: HLoadingStartupUIOpenType = HLoadingStartupUIOpenType.Auto;

    @property({
        type: HLoadingStartupUILayer,
        tooltip: '启动后显示该 UI 的目标层级。建议直接下拉选择，避免手写 layer 字符串。',
    })
    public startupLayer: HLoadingStartupUILayer = HLoadingStartupUILayer.Auto;

    @property({ tooltip: '启动后显示顺序，数字越小越先打开。' })
    public startupOrder = 0;

    @property({ tooltip: '启动后打开该 UI 时传入的参数 JSON。例如 {\"tab\":\"home\"}。' })
    public startupParamsJson = '';

    @property({ tooltip: '备注，不参与加载。' })
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
            assetType: HLoading.assetTypeToKind(this.assetType),
            cache: this.cache,
            preloadOnly: this.preloadOnly,
        };
    }

    public resolveRouteId(): HUI | null {
        return HLoading.resolveStartupUIId(this.key);
    }

    public toStartupEntry(): HLoadingStartupUIEntry | null {
        const routeId = this.resolveRouteId();
        if (!this.enabled || !this.showOnStartup || !routeId || this.assetType !== HLoadingAssetType.Prefab) {
            return null;
        }

        return {
            uiId: routeId,
            openType: this.startupOpenType,
            order: this.startupOrder,
            layerName: HLoading.resolveStartupLayerName(this.startupLayer, this.startupOpenType, ''),
            paramsJson: this.startupParamsJson,
            note: this.note,
        };
    }
}

/**
 * Loading 完成前需要打开的首屏 UI。
 *
 * 说明：
 * - First Screen Prefabs 只负责预加载 prefab。
 * - Startup UIs 才负责声明哪些 UI 要显示。
 * - 实际打开由 HMain 调用 H.ui 完成，因此 UI 会挂到 Gui 节点下并进入 UI 生命周期。
 */
@ccclass('HLoadingStartupUIItem')
export class HLoadingStartupUIItem {
    @property
    public enabled = true;

    @property({
        type: HUI,
        tooltip: 'UI 路由 id。必须和 HUIConfig.ts 里的统一枚举 id 一致，例如 HUI.home。',
    })
    // Startup UI ids are configured by enum and resolved through HUIConfig.ts.
    public uiId: HUI = HUI.home;

    @property({
        type: HLoadingStartupUIOpenType,
        tooltip: '打开类型。Page 调 openPage，Dialog 调 openDialog，Auto 调 open。',
    })
    public openType: HLoadingStartupUIOpenType = HLoadingStartupUIOpenType.Page;

    @property({ tooltip: '打开顺序，数字越小越先打开。' })
    public order = 0;

    @property({
        type: HLoadingStartupUILayer,
        tooltip: '目标 UI 层级。建议直接下拉选择，避免手写 layerName。',
    })
    public layer: HLoadingStartupUILayer = HLoadingStartupUILayer.Auto;

    @property({ tooltip: '目标 UI 层级。可填 layer1 / layer2 / layer3 / dialog / tip / transition。为空时按 openType 自动推断。' })
    public layerName = '';

    @property({ tooltip: '传给 UI 的参数 JSON。例如 {"tab":"home"}。为空表示不传参。' })
    public paramsJson = '';

    @property({ tooltip: '备注，不参与打开。' })
    public note = '';

    public toEntry(): HLoadingStartupUIEntry | null {
        const id = HLoading.resolveStartupUIId(this.uiId);
        if (!this.enabled || !id) {
            return null;
        }

        return {
            uiId: id,
            openType: this.openType,
            order: this.order,
            layerName: HLoading.resolveStartupLayerName(this.layer, this.openType, this.layerName),
            paramsJson: this.paramsJson,
            note: this.note,
        };
    }
}

export interface HLoadingStartupUIEntry {
    uiId: HUI;
    openType: HLoadingStartupUIOpenType;
    order: number;
    layerName: string;
    paramsJson: string;
    note: string;
}

export interface HLoadingRunOptions {
    /**
     * SDK 初始化 / 登录。
     *
     * 由 HMain 提供，HLoading 只负责显示阶段进度。
     */
    initSDK?: () => Promise<void> | void;

    /**
     * 用户数据初始化。
     *
     * 由 HMain 或项目子类提供。
     */
    initUserData?: () => Promise<void> | void;

    /**
     * 进入游戏前流程。
     *
     * 典型内容：
     * - beforeEnterGame
     * - openStartupUIs
     */
    beforeEnterGame?: () => Promise<void> | void;
}

interface HLoadingPhase {
    name: string;
    start: number;
    end: number;
}

@ccclass('HLoading')
export class HLoading extends Component {
    // ---------------------------------------------------------------------
    // Loading 显示配置
    // ---------------------------------------------------------------------

    @property({ tooltip: 'Loading 最少展示秒数，避免快网环境下一闪而过。' })
    public minShowSeconds = 0.8;

    @property({ tooltip: '显示进度追赶真实进度的速度。值越大越快，但不会超过真实目标进度。' })
    public progressFollowSpeed = 3.8;

    @property({ tooltip: '是否输出 Loading 阶段日志。' })
    public debugLog = true;

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

    // ---------------------------------------------------------------------
    // 资源清单
    // ---------------------------------------------------------------------

    @property({
        type: [HLoadingBundleItem],
        tooltip: '进入游戏前必须加载完成的 Bundle。只填首屏真正必需的 Bundle。',
    })
    public firstScreenBundles: HLoadingBundleItem[] = [];

    @property({
        type: [HLoadingResourceItem],
        tooltip: '进入游戏前必须加载完成的首屏资源。Startup UIs 会自动补充对应 prefab，这里只填额外必需资源。',
    })
    public firstScreenResources: HLoadingResourceItem[] = [];

    @property({
        type: [HLoadingStartupUIItem],
        tooltip: 'Loading 快结束时需要通过 H.ui 打开的首屏 UI。会挂到 Gui 下并进入 UI 生命周期。',
    })
    public startupUIs: HLoadingStartupUIItem[] = [];

    private targetProgress = 0;
    private displayProgress = 0;
    private loading = false;
    private allowCompleteDisplay = false;
    private startedAt = 0;
    private currentTip = '准备启动';
    private currentDetail = '';

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

    public static resolveStartupLayerName(
        layer: HLoadingStartupUILayer,
        openType: HLoadingStartupUIOpenType,
        fallbackLayerName = '',
    ): string {
        switch (layer) {
            case HLoadingStartupUILayer.Layer1:
                return 'layer1';
            case HLoadingStartupUILayer.Layer2:
                return 'layer2';
            case HLoadingStartupUILayer.Layer3:
                return 'layer3';
            case HLoadingStartupUILayer.Dialog:
                return 'dialog';
            case HLoadingStartupUILayer.Tip:
                return 'tip';
            case HLoadingStartupUILayer.Guide:
                return 'guide';
            case HLoadingStartupUILayer.Reward:
                return 'reward';
            case HLoadingStartupUILayer.Error:
                return 'error';
            case HLoadingStartupUILayer.Transition:
                return 'transition';
            case HLoadingStartupUILayer.Auto:
            default:
                return fallbackLayerName.trim() || HLoading.resolveStartupLayerNameByOpenType(openType);
        }
    }

    private static resolveStartupLayerNameByOpenType(openType: HLoadingStartupUIOpenType): string {
        switch (openType) {
            case HLoadingStartupUIOpenType.Dialog:
                return 'layer3';
            case HLoadingStartupUIOpenType.Tip:
                return 'tip';
            case HLoadingStartupUIOpenType.Loading:
                return 'transition';
            case HLoadingStartupUIOpenType.Page:
            case HLoadingStartupUIOpenType.Auto:
            default:
                return 'layer2';
        }
    }

    public static resolveStartupUIId(id: string | HUI): HUI | null {
        const normalized = String(id).trim();
        if (!normalized) {
            return null;
        }

        if (Object.prototype.hasOwnProperty.call(HUIConfigs, normalized)) {
            return normalized as HUI;
        }

        const normalizedLower = normalized.toLowerCase();
        const matchedEntry = Object.entries(HUI).find(([key, value]) => {
            if (typeof value !== 'string') {
                return false;
            }

            return key.toLowerCase() === normalizedLower || value.toLowerCase() === normalizedLower;
        });
        const matchedId = matchedEntry?.[1];
        if (typeof matchedId === 'string' && Object.prototype.hasOwnProperty.call(HUIConfigs, matchedId)) {
            return matchedId as HUI;
        }

        return null;
    }

    protected start(): void {
        this.resetView();
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

    // ---------------------------------------------------------------------
    // 给 HMain / H.init 使用的配置读取
    // ---------------------------------------------------------------------

    public getFirstScreenBundleTasks(): HResourceBundleTask[] {
        return this.toBundleTasks(this.firstScreenBundles);
    }

    public getFirstScreenResourceTasks(): HResourceTask[] {
        return this.dedupeResourceTasks([
            ...this.toResourceTasks(this.firstScreenResources),
            ...this.getStartupUIResourceTasks(),
        ]);
    }

    public getStartupUIs(): HLoadingStartupUIEntry[] {
        const entries = new Map<string, HLoadingStartupUIEntry>();

        for (const item of this.firstScreenResources) {
            const entry = item.toStartupEntry();
            if (!entry) {
                continue;
            }

            entries.set(entry.uiId, entry);
        }

        for (const item of this.startupUIs) {
            const entry = item.toEntry();
            if (!entry) {
                continue;
            }

            entries.set(entry.uiId, entry);
        }

        return [...entries.values()].sort((a, b) => a.order - b.order);
    }

    // ---------------------------------------------------------------------
    // 启动流程
    // ---------------------------------------------------------------------

    public async runStartupFlow(options: HLoadingRunOptions = {}): Promise<void> {
        if (this.loading) {
            return;
        }

        this.loading = true;
        this.startedAt = Date.now();
        this.allowCompleteDisplay = false;
        this.displayProgress = 0;
        this.targetProgress = 0;

        this.resetView();
        this.clearError();
        this.setTargetProgress(0.01, '准备启动', '初始化启动环境');

        try {
            await this.runPhase('加载首屏 Bundle', 0.05, 0.25, '下载并初始化首屏 Bundle', () => {
                return this.loadCriticalBundles();
            });

            await this.runPhase('加载首屏资源', 0.25, 0.55, '预加载首屏 UI 和关键贴图', () => {
                return this.loadCriticalResources();
            });

            await this.runPhase('SDK 初始化', 0.55, 0.68, '初始化并登录平台 SDK', async () => {
                await options.initSDK?.();
            });

            await this.runPhase('用户数据初始化', 0.68, 0.82, '读取本地数据和服务器用户数据', async () => {
                await options.initUserData?.();
            });

            await this.runPhase('准备进入游戏', 0.82, 0.96, '打开首屏 UI 并准备显示玩法节点', async () => {
                await options.beforeEnterGame?.();
            });

            await this.waitMinimumShowTime();

            this.allowCompleteDisplay = true;
            this.setTargetProgress(1, '加载完成', '正在进入游戏');
            await this.waitForDisplayedProgress(0.985, 300);

            this.loading = false;
        } catch (error) {
            this.loading = false;
            console.error('[HLoading] 启动加载失败:', error);
            this.showError('加载失败，请检查网络或配置后重试');
            throw error;
        }
    }

    public retry(options: HLoadingRunOptions = {}): void {
        this.resetView();
        void this.runStartupFlow(options);
    }

    public showError(message: string): void {
        if (this.errorLabel) {
            this.errorLabel.node.active = true;
            this.errorLabel.string = message;
        }
    }

    public clearError(): void {
        if (this.errorLabel) {
            this.errorLabel.string = '';
            this.errorLabel.node.active = false;
        }
    }

    public resetView(): void {
        this.targetProgress = 0;
        this.displayProgress = 0;
        this.currentTip = '准备启动';
        this.currentDetail = '';

        if (this.progressBar) {
            this.progressBar.progress = 0;
        }

        if (this.percentLabel) {
            this.percentLabel.string = '0%';
        }

        if (this.tipLabel) {
            this.tipLabel.string = this.currentTip;
        }

        if (this.detailLabel) {
            this.detailLabel.string = this.currentDetail;
        }

        this.clearError();
    }

    // ---------------------------------------------------------------------
    // 各阶段资源加载
    // ---------------------------------------------------------------------

    private async loadCriticalBundles(): Promise<void> {
        const resource = (H as any).resource;
        if (!resource || typeof resource.loadCriticalBundles !== 'function') {
            return;
        }

        await resource.loadCriticalBundles(undefined, (finished: number, total: number, task: HResourceBundleTask) => {
            this.updateCurrentPhaseProgress(finished, total, `加载 Bundle：${task?.name || ''}`);
        });
    }

    private async loadCriticalResources(): Promise<void> {
        const resource = (H as any).resource;
        if (!resource || typeof resource.loadCritical !== 'function') {
            return;
        }

        await resource.loadCritical(undefined, (finished: number, total: number, task: HResourceTask) => {
            const bundleName = task?.bundle && task.bundle !== 'resources' ? `${task.bundle}/` : '';
            this.updateCurrentPhaseProgress(finished, total, `加载资源：${bundleName}${task?.path || ''}`);
        });
    }

    // ---------------------------------------------------------------------
    // 进度与阶段
    // ---------------------------------------------------------------------

    private currentPhase: HLoadingPhase | null = null;

    private async runPhase(
        name: string,
        start: number,
        end: number,
        detail: string,
        handler: () => Promise<void> | void,
    ): Promise<void> {
        const phase: HLoadingPhase = { name, start, end };
        this.currentPhase = phase;

        const startedAt = Date.now();
        this.setTargetProgress(start, name, detail);

        if (this.debugLog) {
            console.log(`[HLoading] 开始：${name}，进度 ${Math.round(start * 100)}%-${Math.round(end * 100)}%，${detail}`);
        }

        await handler();

        this.setTargetProgress(end, name, `${name}完成`);

        if (this.debugLog) {
            console.log(`[HLoading] 完成：${name}，耗时 ${Date.now() - startedAt} ms`);
        }

        this.currentPhase = null;
    }

    private updateCurrentPhaseProgress(finished: number, total: number, detail: string): void {
        if (!this.currentPhase) {
            return;
        }

        this.updatePhaseProgress(this.currentPhase, finished, total, detail);
    }

    private updatePhaseProgress(phase: HLoadingPhase, finished: number, total: number, detail: string): void {
        if (total <= 0) {
            this.setTargetProgress(phase.end, phase.name, detail);
            return;
        }

        const ratio = Math.max(0, Math.min(1, finished / total));
        const progress = phase.start + (phase.end - phase.start) * ratio;
        this.setTargetProgress(progress, phase.name, detail);
    }

    private setTargetProgress(value: number, tip: string, detail = ''): void {
        this.targetProgress = Math.max(0, Math.min(1, value));
        this.currentTip = tip;
        this.currentDetail = detail;

        if (this.tipLabel) {
            this.tipLabel.string = tip;
        }

        if (this.detailLabel) {
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
            this.percentLabel.string = `${Math.floor(progress * 100)}%`;
        }
    }

    private waitMinimumShowTime(): Promise<void> {
        const elapsed = (Date.now() - this.startedAt) / 1000;
        const remain = Math.max(0, this.minShowSeconds - elapsed);

        if (remain <= 0) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            setTimeout(resolve, remain * 1000);
        });
    }

    private waitForDisplayedProgress(target: number, timeoutMs: number): Promise<void> {
        const startedAt = Date.now();

        return new Promise((resolve) => {
            const tick = () => {
                if (this.displayProgress >= target || Date.now() - startedAt >= timeoutMs) {
                    resolve();
                    return;
                }

                setTimeout(tick, 16);
            };

            tick();
        });
    }

    private toBundleTasks(items: HLoadingBundleItem[]): HResourceBundleTask[] {
        return items
            .map((item) => item.toTask())
            .filter((task): task is HResourceBundleTask => !!task);
    }

    private toResourceTasks(items: HLoadingResourceItem[]): HResourceTask[] {
        return items
            .map((item) => item.toTask())
            .filter((task): task is HResourceTask => !!task);
    }

    private getStartupUIResourceTasks(): HResourceTask[] {
        return this.getStartupUIs()
            .map((entry): HResourceTask | null => {
                const config = HUIConfigs[entry.uiId];
                if (!config?.prefabPath) {
                    return null;
                }

                return {
                    key: String(entry.uiId),
                    bundle: config.bundle || 'resources',
                    path: config.prefabPath,
                    assetType: 'Prefab',
                    cache: true,
                    preloadOnly: false,
                };
            })
            .filter((task): task is HResourceTask => !!task);
    }

    private dedupeResourceTasks(tasks: HResourceTask[]): HResourceTask[] {
        const deduped = new Map<string, HResourceTask>();
        for (const task of tasks) {
            const bundleName = task.bundle || 'resources';
            const assetType = task.assetType || '';
            deduped.set(`${bundleName}:${task.path}:${assetType}`, task);
        }
        return [...deduped.values()];
    }

}
