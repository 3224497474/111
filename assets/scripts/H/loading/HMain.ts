import { _decorator, AudioSource, Component, isValid, Node } from 'cc';
import { H } from '../H';
import {
    HLoading,
    HLoadingAssetType,
    HLoadingStartupUIEntry,
    HLoadingStartupUIOpenType,
} from './HLoading';
import type { HResourceBundleTask, HResourceTask } from '../HTypes';
import type { HUIOpenOptions } from '../ui/HUITypes';

const { ccclass, property } = _decorator;

@ccclass('HMainBackgroundBundleItem')
export class HMainBackgroundBundleItem {
    @property
    public enabled = true;

    @property({ tooltip: '进入 Home 显示后后台加载的 Bundle 名。' })
    public name = '';

    @property({ tooltip: '备注，只给编辑器查看，不参与加载。' })
    public note = '';

    public toTask(): HResourceBundleTask | null {
        const bundleName = this.name.trim();
        if (!this.enabled || !bundleName) {
            return null;
        }

        return {
            enabled: this.enabled,
            name: bundleName,
            phase: 'background',
            note: this.note,
        };
    }
}

@ccclass('HMainBackgroundResourceItem')
export class HMainBackgroundResourceItem {
    @property
    public enabled = true;

    @property({ tooltip: '可选缓存 key。留空时使用 bundle:path。' })
    public key = '';

    @property({ tooltip: '资源所在 Bundle。resources 表示内置 resources bundle。' })
    public bundle = 'resources';

    @property({ tooltip: '资源路径，不带扩展名，例如 prefabs/Setting。' })
    public path = '';

    @property({ type: HLoadingAssetType })
    public assetType = HLoadingAssetType.Prefab;

    @property({ tooltip: 'preloadOnly=false 时，是否把完整加载的资源放入 H.resource 缓存。' })
    public cache = true;

    @property({ tooltip: 'true 只预加载依赖；false 会在后台完整 load 资源。' })
    public preloadOnly = true;

    @property({ tooltip: '备注，只给编辑器查看，不参与加载。' })
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
            phase: 'background',
            cache: this.cache,
            preloadOnly: this.preloadOnly,
        };
    }
}

@ccclass('HMain')
export class HMain extends Component {
    // ---------------------------------------------------------------------
    // Root 节点引用：Inspector 手动拖拽
    // ---------------------------------------------------------------------

    @property({
        type: Node,
        tooltip: '游戏核心玩法 Root。拖 Canvas/game。Loading 完成前通常隐藏，进入游戏后显示。',
    })
    public gameRoot: Node | null = null;

    @property({
        type: Node,
        tooltip: 'UI 框架 Root。拖 Canvas/Gui。H.init 会把它作为 uiRoot，所有 H.ui 页面、弹窗、提示都挂在这里。',
    })
    public guiRoot: Node | null = null;

    @property({
        type: Node,
        tooltip: '开局 Loading Root。拖 Canvas/Loading。启动流程完成后会销毁。',
    })
    public loadingRoot: Node | null = null;

    @property({
        type: HLoading,
        tooltip: 'Canvas/Loading 节点上的 HLoading 组件。',
    })
    public loading: HLoading | null = null;

    @property({
        type: AudioSource,
        tooltip: '可选：背景音乐或全局音乐 AudioSource。',
    })
    public musicAudioSource: AudioSource | null = null;

    // ---------------------------------------------------------------------
    // 自动查找与启动选项
    // ---------------------------------------------------------------------

    @property({
        tooltip: '没有手动拖引用时，是否根据节点名字自动查找 game / Gui / Loading。',
    })
    public autoFindRoots = true;

    @property({
        tooltip: '自动查找 gameRoot 使用的节点名。',
    })
    public gameRootName = 'game';

    @property({
        tooltip: '自动查找 guiRoot 使用的节点名。',
    })
    public guiRootName = 'Gui';

    @property({
        tooltip: '自动查找 loadingRoot 使用的节点名。',
    })
    public loadingRootName = 'Loading';

    @property({
        tooltip: '启动时是否先隐藏 gameRoot，Loading 完成后再显示。',
    })
    public hideGameUntilReady = true;

    @property({
        tooltip: 'Loading 完成后是否销毁 Loading 节点。',
    })
    public destroyLoadingWhenDone = true;

    @property({
        tooltip: 'Loading 完成前是否自动打开 HLoading 面板里配置的 Startup UIs。',
    })
    public autoOpenStartupUIs = true;

    @property({
        tooltip: '进入游戏后是否启动后台资源加载。',
    })
    public startBackgroundLoadingAfterEnter = true;

    // ---------------------------------------------------------------------
    // H.init 基础配置
    // ---------------------------------------------------------------------

    @property({
        tooltip: 'H.data 本地存储命名空间。',
    })
    public dataNamespace = 'H';

    @property({
        tooltip: '红点信息存储在 H.data 里的模块名。',
    })
    public redDotStorageModuleName = 'redDot';

    @property({
        tooltip: 'SDK 登录、启动参数等平台会话信息存储在 H.data 里的模块名。',
    })
    public sdkSessionStorageModuleName = 'platformSession';

    @property({
        tooltip: '后台资源加载并发数。',
    })
    public backgroundConcurrency = 1;

    @property({
        type: [HMainBackgroundBundleItem],
        tooltip: 'Home 显示后后台加载的 Bundle，不阻塞 Loading。',
    })
    public backgroundBundles: HMainBackgroundBundleItem[] = [];

    @property({
        type: [HMainBackgroundResourceItem],
        tooltip: 'Home 显示后后台预热的 prefab/资源，不阻塞 Loading。',
    })
    public backgroundResources: HMainBackgroundResourceItem[] = [];

    @property({
        tooltip: '是否输出资源系统调试日志。',
    })
    public resourceDebug = true;

    @property({
        tooltip: '设计宽度。',
    })
    public designWidth = 720;

    @property({
        tooltip: '设计高度。',
    })
    public designHeight = 1280;

    private starting = false;
    private started = false;

    protected onLoad(): void {
        this.resolveRootReferences();

        if (this.hideGameUntilReady) {
            this.setGameVisible(false);
        }

        this.setupSystemComponents();
    }

    protected start(): void {
        void this.startup();
    }

    /**
     * 主启动流程。
     *
     * 设计原则：
     * - HMain 负责整体调度和 H.init。
     * - HLoading 负责资源阶段、进度显示、错误展示。
     * - UI 打开必须走 H.ui，并挂到 guiRoot 下。
     */
    public async startup(): Promise<void> {
        if (this.starting || this.started) {
            return;
        }

        this.starting = true;

        try {
            this.resolveRootReferences();

            const loading = this.getLoading();

            this.initH(loading);

            await loading.runStartupFlow({
                initSDK: () => this.initSDK(),
                initUserData: () => this.initUserData(),
                beforeEnterGame: () => this.prepareEnterGame(loading),
            });

            await this.enterGame();

            this.started = true;
        } catch (error) {
            console.error('[HMain] 启动失败:', error);
            this.loading?.showError?.('启动失败，请检查配置后重试');
        } finally {
            this.starting = false;
        }
    }

    // ---------------------------------------------------------------------
    // Root 查找与校验
    // ---------------------------------------------------------------------

    protected resolveRootReferences(): void {
        if (!this.autoFindRoots) {
            return;
        }

        if (!this.gameRoot) {
            this.gameRoot = this.node.getChildByName(this.gameRootName);
        }

        if (!this.guiRoot) {
            this.guiRoot = this.node.getChildByName(this.guiRootName);
        }

        if (!this.loadingRoot) {
            this.loadingRoot = this.node.getChildByName(this.loadingRootName);
        }

        if (!this.loading && this.loadingRoot) {
            this.loading = this.loadingRoot.getComponent(HLoading);
        }
    }

    protected getGameRoot(): Node {
        if (!this.gameRoot) {
            throw new Error('[HMain] gameRoot 不能为空，请在 Inspector 拖 Canvas/game。');
        }

        return this.gameRoot;
    }

    protected getGuiRoot(): Node {
        if (!this.guiRoot) {
            throw new Error('[HMain] guiRoot 不能为空，请在 Inspector 拖 Canvas/Gui。');
        }

        return this.guiRoot;
    }

    protected getLoading(): HLoading {
        if (!this.loading) {
            throw new Error('[HMain] loading 不能为空，请在 Inspector 拖 Canvas/Loading 上的 HLoading 组件。');
        }

        return this.loading;
    }

    // ---------------------------------------------------------------------
    // H 框架初始化
    // ---------------------------------------------------------------------

    protected initH(loading: HLoading): void {
        H.init({
            platform: { debug: true },
            uiRoot: this.getGuiRoot(),

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
                autoLoadLocal: true,
                persistByDefault: false,
            },

            resource: {
                debug: this.resourceDebug,
                backgroundConcurrency: this.backgroundConcurrency,

                // 首屏阻塞 Bundle 和 Startup UI prefab，保证进入游戏时 H.ui.open 尽量命中缓存。
                criticalBundles: loading.getFirstScreenBundleTasks(),
                critical: loading.getFirstScreenResourceTasks(),
                backgroundBundles: this.getBackgroundBundleTasks(),
                background: this.getBackgroundResourceTasks(),
            },

            sdk: {
                sessionStorageModuleName: this.sdkSessionStorageModuleName.trim() || 'platformSession',
            },

            screen: {
                designWidth: Math.max(1, this.designWidth),
                designHeight: Math.max(1, this.designHeight),
                fitMode: 'auto',
                autoRefresh: true,
            },
        });

    }

    /**
     * 初始化全局系统组件。
     *
     * 项目可继承 HMain 后重写：
     * - 音频管理
     * - 时间管理
     * - 全局事件
     * - 埋点
     * - 输入管理
     */
    protected setupSystemComponents(): void {
        // 示例：
        // H.audio?.init(this.musicAudioSource);
        // H.time?.init();
    }

    /**
     * SDK 初始化 / 登录。
     *
     * 默认尝试调用 H.sdk.login。
     * 如果项目有更复杂的 SDK 流程，继承 HMain 后重写即可。
     */
    protected async initSDK(): Promise<void> {
        const sdk = (H as any).sdk;
        console.log('[HMain] initSDK: sdk:', sdk);
        if (!sdk || typeof sdk.login !== 'function') {
            return;
        }

        const ret = await sdk.login();
        if (!ret?.ok) {
            console.warn('[HMain] SDK 登录未完成:', ret?.reason || ret?.errorMessage || ret);
        }
    }

    /**
     * 用户数据初始化。
     *
     * 项目侧继承 HMain 后重写：
     * - 初始化 H.vm / H.store
     * - 读取本地存档
     * - 拉取服务器用户数据
     * - 初始化背包、任务、红点等模块
     */
    protected async initUserData(): Promise<void> {
        // project override
    }

    /**
     * 进入游戏前的项目自定义逻辑。
     *
     * 注意：
     * - 不建议在这里手动 instantiate UI。
     * - 首屏 UI 推荐配置到 HLoading.startupUIs，由 openStartupUIs 统一通过 H.ui 打开。
     */
    protected async beforeEnterGame(): Promise<void> {
        // project override
    }

    protected async prepareEnterGame(loading: HLoading): Promise<void> {
        await this.beforeEnterGame();

        if (this.autoOpenStartupUIs) {
            await this.openStartupUIs(loading);
        }
    }

    // ---------------------------------------------------------------------
    // Startup UI 打开
    // ---------------------------------------------------------------------

    protected async openStartupUIs(loading: HLoading): Promise<void> {
        const entries = loading.getStartupUIs();

        for (const entry of entries) {
            await this.openStartupUI(entry);
        }
    }

    protected async openStartupUI(entry: HLoadingStartupUIEntry): Promise<void> {
        const ui = (H as any).ui;
        if (!ui) {
            throw new Error('[HMain] H.ui 未初始化，无法打开 Startup UI。');
        }

        const params = this.parseStartupUIParams(entry);
        const routeConfig = typeof ui.getConfig === 'function' ? ui.getConfig(entry.uiId) : null;
        const fastOpenOptions: Partial<HUIOpenOptions> = {
            openLoading: false,
            animation: 'none',
            silent: true,
        };

        if (routeConfig && typeof ui.open === 'function') {
            await ui.open(entry.uiId, params, fastOpenOptions);
            return;
        }

        switch (entry.openType) {
            case HLoadingStartupUIOpenType.Page:
                if (typeof ui.openPage === 'function') {
                    await ui.openPage(entry.uiId, params, fastOpenOptions);
                    return;
                }
                break;

            case HLoadingStartupUIOpenType.Dialog:
                if (typeof ui.openDialog === 'function') {
                    await ui.openDialog(entry.uiId, params, fastOpenOptions);
                    return;
                }
                break;

            case HLoadingStartupUIOpenType.Tip:
                if (typeof ui.showTip === 'function') {
                    await ui.showTip(entry.uiId, params);
                    return;
                }
                break;

            case HLoadingStartupUIOpenType.Loading:
                if (typeof ui.openLoading === 'function') {
                    await ui.openLoading(entry.uiId, params);
                    return;
                }
                break;

            case HLoadingStartupUIOpenType.Auto:
            default:
                break;
        }

        if (typeof ui.open === 'function') {
            await ui.open(entry.uiId, params, fastOpenOptions);
            return;
        }

        throw new Error(`[HMain] H.ui 没有可用的 open 方法，无法打开 UI：${entry.uiId}`);
    }

    protected parseStartupUIParams(entry: HLoadingStartupUIEntry): any {
        const json = entry.paramsJson?.trim();
        if (!json) {
            return undefined;
        }

        try {
            return JSON.parse(json);
        } catch (error) {
            console.warn(`[HMain] Startup UI 参数 JSON 解析失败：${entry.uiId}`, error);
            return undefined;
        }
    }

    // ---------------------------------------------------------------------
    // 进入游戏
    // ---------------------------------------------------------------------

    protected async enterGame(): Promise<void> {
        this.setGameVisible(true);
        this.disposeLoadingRoot();

        if (this.startBackgroundLoadingAfterEnter) {
            this.scheduleOnce(() => this.startBackgroundLoading(), 0);
        }
    }

    protected disposeLoadingRoot(): void {
        if (!this.destroyLoadingWhenDone || !this.loadingRoot) {
            return;
        }

        const loadingRoot = this.loadingRoot;
        this.loadingRoot = null;
        this.loading = null;

        loadingRoot.active = false;
        this.scheduleOnce(() => {
            if (isValid(loadingRoot)) {
                loadingRoot.destroy();
            }
        }, 0);
    }

    protected setGameVisible(visible: boolean): void {
        if (this.gameRoot) {
            this.gameRoot.active = visible;
        }
    }

    protected getBackgroundBundleTasks(): HResourceBundleTask[] {
        return this.backgroundBundles
            .map((item) => item.toTask())
            .filter((task): task is HResourceBundleTask => !!task);
    }

    protected getBackgroundResourceTasks(): HResourceTask[] {
        return this.dedupeResourceTasks(this.backgroundResources
            .map((item) => item.toTask())
            .filter((task): task is HResourceTask => !!task));
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

    protected startBackgroundLoading(): void {
        const resource = (H as any).resource;
        if (!resource) {
            return;
        }

        if (typeof resource.startBackground === 'function') {
            void resource.startBackground();
            return;
        }

        if (typeof resource.loadBackground === 'function') {
            void resource.loadBackground();
            return;
        }

        if (typeof resource.loadBackgroundRegistered === 'function') {
            void resource.loadBackgroundRegistered();
        }
    }
}
