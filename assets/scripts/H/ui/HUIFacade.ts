import {
    AssetManager,
    BlockInputEvents,
    Color,
    Component,
    EventTouch,
    Graphics,
    Label,
    Node,
    Prefab,
    UITransform,
    UIOpacity,
    Widget,
    assetManager,
    game,
    instantiate,
    isValid,
    resources,
} from 'cc';
import {
    UILayer,
    UIRoute,
    type HUICloseReason,
    type HUICloseSoundPlayer,
    type HUICacheMode,
    type HUIConfig,
    type HUIEvent,
    type HUIEventListener,
    type HUIEventType,
    type HUILayerName,
    type HUIOpenLoadingPolicy,
    type HUIOpenOptions,
    type HUIResourcePolicy,
    type HUIRouteConfigInput,
    type HUIRouteId,
    type HUIType,
    type HUIInitOptions,
} from './HUITypes';
import type { HEventBus } from '../core/HEventBus';
import type { HStoreFacade } from '../store/HStoreFacade';
import { HUIConfigs } from './HUIConfig';
import { HUIStack } from './HUIStack';
import { HUIViewBase } from './HUIViewBase';

/**
 * HUIFacade 是 H.ui 的唯一运行时入口，负责路由、层级、生命周期、遮罩、动画和资源缓存。
 *
 * 排查 UI 打开关闭问题时建议按下面的链路看：
 * 1. open/openResolved：统一入口、单例复用、重复打开保护、慢加载提示。
 * 2. loadCreateAndOpen/openRecord：加载 prefab、创建记录、挂层级、绑定脚本、执行打开生命周期。
 * 3. close/closeRecord：关闭节流、二次确认、关闭动画、隐藏缓存或销毁释放。
 * 4. createMaskForRecord/sortLayer：遮罩节点、点击遮罩关闭、同层排序。
 * 5. retainRecordResource/releaseRecordResource：prefab 和 bundle 的引用管理。
 */
interface HUIRecord {
    id: string;
    layer: HUILayerName;
    type: HUIType;
    node: Node;
    maskNode: Node | null;
    view: HUIViewBase | null;
    config: HUIConfig;
    params?: any;
    prefabAsset?: Prefab;
    bundleName?: string;
    bundle?: AssetManager.Bundle;
    cacheMode: HUICacheMode;
    group: string;
    mutexGroup: string;
    closing: boolean;
    lastCloseRequestAt: number;
    lastUsedAt: number;
    openIndex: number;
    operationVersion: number;
}

interface HUIOpenLoadingSession {
    finish(): Promise<void>;
}

interface HUILoadedNode {
    node: Node;
    prefabAsset?: Prefab;
    bundleName?: string;
    bundle?: AssetManager.Bundle;
}

type HUIOpenInput = HUIRouteId | HUIOpenOptions;

export class HUIFacade {
    // root/layer/record 是 UI 框架运行态的核心数据，业务不要绕过这些状态直接挂节点。
    private root: Node | null = null;
    private readonly layerNodes = new Map<string, Node>();
    private readonly records = new Map<string, HUIRecord>();
    private readonly configs = new Map<string, HUIConfig>();

    // loadingTasks 防止同一个单例 UI 被快速重复加载；operationQueues 保证同一个 UI 的 open/close 串行执行。
    private readonly loadingTasks = new Map<string, Promise<Node>>();
    private readonly operationQueues = new Map<string, Promise<unknown>>();
    private readonly openLoadingRefCounts = new Map<string, number>();

    // maskRecordIds 用于从遮罩点击反查 UI；bundleRefCounts 用于 bundle 低内存和销毁释放。
    private readonly maskRecordIds = new WeakMap<Node, string>();
    private readonly bundleRefCounts = new Map<string, number>();
    private readonly listeners = new Map<HUIEventType, Set<HUIEventListener>>();
    private readonly stack = new HUIStack();
    private closeSoundPlayer: HUICloseSoundPlayer | null = null;
    private eventReporter: HUIEventListener | null = null;
    private storeFacade: HStoreFacade | null = null;
    private eventBus: HEventBus | null = null;
    private resourcePolicy: Required<HUIResourcePolicy> = {
        maxHiddenRecords: 8,
        releasePrefabOnDestroy: true,
        releaseBundleOnUnused: false,
        lowMemoryStrategy: 'destroy-hidden',
    };
    private openSequence = 0;
    private tipSeed = 0;
    private defaultLoadingId: HUIRouteId = UIRoute.GlobalLoading;
    private defaultOpenLoadingPolicy: HUIOpenLoadingPolicy = {
        enabled: true,
        delayMs: 300,
        minShowMs: 300,
        message: '加载中',
    };

    private readonly defaultLayerOrder: Record<UILayer, number> = {
        [UILayer.Layer1]: 100,
        [UILayer.Layer2]: 200,
        [UILayer.Layer3]: 300,
        [UILayer.Layer4]: 400,
        [UILayer.Layer5]: 500,
        [UILayer.Guide]: 600,
        [UILayer.Tip]: 700,
        [UILayer.Transition]: 800,
    };

    public setStore(store: HStoreFacade | null): void {
        this.storeFacade = store;
    }

    public setEventBus(eventBus: HEventBus | null): void {
        this.eventBus = eventBus;
    }

    /**
     * 初始化 UI 根节点和默认层级。
     * 后续业务只需要调用 H.ui.open/close，不需要自己创建 layer 容器。
     */
    public init(root: Node, options: HUIInitOptions = {}): void {
        this.root = root;
        this.defaultLoadingId = options.defaultLoadingId || this.defaultLoadingId;
        this.defaultOpenLoadingPolicy = this.normalizeOpenLoadingPolicy(options.openLoading, this.defaultOpenLoadingPolicy);
        this.closeSoundPlayer = options.closeSoundPlayer || null;
        this.eventReporter = options.eventReporter || null;
        this.resourcePolicy = {
            ...this.resourcePolicy,
            ...(options.resource || {}),
        };

        if (options.persistRoot && root.parent) {
            game.addPersistRootNode(root);
        }

        this.ensureRootTransform(root);
        this.createDefaultLayers(options.layerOrder);
        this.registerRoutes(HUIConfigs);
        if (options.routes) {
            this.registerRoutes(options.routes);
        }
        if (options.configs) {
            this.registerRoutes(options.configs);
        }

        this.bindLowMemoryListener();
    }

    public registerRoutes(routes: HUIRouteConfigInput): void {
        const list = Array.isArray(routes) ? routes : Object.values(routes);
        list.forEach((config) => this.registerConfig(config));
    }

    public registerConfig(config: HUIConfig): void {
        const normalized = this.normalizeConfig(config);
        this.configs.set(String(normalized.id), normalized);
    }

    public registerConfigs(configs: HUIRouteConfigInput): void {
        this.registerRoutes(configs);
    }

    public unregisterConfig(id: HUIRouteId): void {
        this.configs.delete(String(id));
    }

    public getConfig(id: HUIRouteId): HUIConfig | null {
        const config = this.configs.get(String(id));
        return config ? { ...config } : null;
    }

    public on(eventName: HUIEventType, listener: HUIEventListener): void {
        let listeners = this.listeners.get(eventName);
        if (!listeners) {
            listeners = new Set();
            this.listeners.set(eventName, listeners);
        }
        listeners.add(listener);
    }

    public off(eventName: HUIEventType, listener: HUIEventListener): void {
        this.listeners.get(eventName)?.delete(listener);
    }

    public async clearHiddenCache(includeKeep = false): Promise<void> {
        const records = this.getHiddenCacheRecords(includeKeep);
        await Promise.all(records.map((record) => this.close(record.id, true, 'force')));
    }

    public async trimHiddenCache(maxHiddenRecords = this.resourcePolicy.maxHiddenRecords, excludeId = ''): Promise<void> {
        const records = this.getHiddenCacheRecords(false)
            .filter((record) => record.id !== excludeId)
            .sort((a, b) => a.lastUsedAt - b.lastUsedAt);
        const overflow = records.length - maxHiddenRecords;
        if (overflow <= 0) {
            return;
        }

        const targets = records.slice(0, overflow);
        await Promise.all(targets.map((record) => this.close(record.id, true, 'force')));
        targets.forEach((record) => this.emitUIEvent('ui_cache_trim', record, 'cache-limit'));
    }

    /**
     * UI 打开的统一入口。
     * 这里先解析路由配置，再进入同 id 操作队列，避免快速 open/close/open 导致生命周期交叉。
     */
    public async open(input: HUIOpenInput, params?: any, openOptions: Partial<HUIOpenOptions> = {}): Promise<Node> {
        this.ensureInit();

        const options = this.resolveOpenInput(input, params, openOptions);
        const config = this.normalizeConfig(options);
        const id = String(config.id);

        return this.enqueueOperation(id, () => this.openResolved(config, options));
    }

    // 已完成路由解析后的真实打开流程，单例复用、重复加载保护和慢加载提示都在这里处理。
    private async openResolved(config: HUIConfig, options: HUIOpenOptions): Promise<Node> {
        const id = String(config.id);
        const singleton = config.singleton !== false;
        const startedAt = Date.now();
        this.emitUIEvent('ui_open_start', config);

        const existing = this.records.get(id);
        if (existing && singleton) {
            try {
                await this.openRecord(existing, options.params);
                this.emitUIEvent('ui_open_end', existing, undefined, Date.now() - startedAt);
                return existing.node;
            } catch (error) {
                this.emitUIEvent('ui_open_fail', existing, error, Date.now() - startedAt);
                throw error;
            }
        }

        const loadingTask = this.loadingTasks.get(id);
        if (loadingTask && singleton) {
            return loadingTask;
        }

        const runtimeConfig = singleton ? config : {
            ...config,
            id: this.createRuntimeId(id),
        };
        const runtimeOptions = singleton ? options : {
            ...options,
            id: runtimeConfig.id,
        };
        const task = this.loadCreateAndOpen(runtimeConfig, runtimeOptions);
        const loadingSession = this.beginOpenLoadingSession(runtimeConfig);
        if (singleton) {
            this.loadingTasks.set(id, task);
        }

        try {
            const node = await task;
            const record = this.records.get(String(runtimeConfig.id));
            this.emitUIEvent('ui_open_end', record || runtimeConfig, undefined, Date.now() - startedAt);
            return node;
        } catch (error) {
            const record = this.records.get(String(runtimeConfig.id));
            this.emitUIEvent('ui_open_fail', record || runtimeConfig, error, Date.now() - startedAt);
            throw error;
        } finally {
            await loadingSession?.finish().catch((error) => {
                console.warn('[HUIFacade] UI loading 关闭失败', error);
            });
            this.loadingTasks.delete(id);
        }
    }

    public openPage(id: HUIRouteId, params?: any, options: Partial<HUIOpenOptions> = {}): Promise<Node> {
        return this.open({ ...options, id, type: 'page', layer: UILayer.Layer2, params });
    }

    public openDialog(id: HUIRouteId, params?: any, options: Partial<HUIOpenOptions> = {}): Promise<Node> {
        return this.open({ ...options, id, type: 'dialog', layer: UILayer.Layer3, params });
    }

    public openGuide(id: HUIRouteId, params?: any, options: Partial<HUIOpenOptions> = {}): Promise<Node> {
        return this.open({ ...options, id, type: 'guide', layer: UILayer.Guide, params, blockInput: true });
    }

    public openLoading(id: HUIRouteId = this.defaultLoadingId, params?: any): Promise<Node> {
        const loadingId = String(id);
        if (this.configs.has(loadingId)) {
            return this.open({
                id,
                type: 'loading',
                layer: UILayer.Transition,
                params,
                blockInput: true,
                openLoading: false,
            });
        }

        return this.showBuiltinLoading(loadingId, params);
    }

    public async showTip(messageOrId: HUIRouteId, paramsOrDuration?: any): Promise<Node> {
        const id = String(messageOrId);
        const hasRoute = this.configs.has(id);
        if (hasRoute || (paramsOrDuration && typeof paramsOrDuration === 'object')) {
            const params = paramsOrDuration && typeof paramsOrDuration === 'object'
                ? paramsOrDuration
                : { message: id, durationMs: paramsOrDuration };
            return this.open({ id: messageOrId, type: 'tip', layer: UILayer.Tip, singleton: false, params });
        }

        return this.showBuiltinTip(id, paramsOrDuration);
    }

    public async refresh(id: HUIRouteId, params?: any): Promise<void> {
        const record = this.records.get(String(id));
        if (!record || !record.view) {
            return;
        }

        record.params = params;
        await record.view._hRefresh(params);
    }

    public async close(id: HUIRouteId, forceDestroy = false, reason: HUICloseReason = forceDestroy ? 'force' : 'api'): Promise<void> {
        return this.enqueueOperation(String(id), async () => {
            const record = this.records.get(String(id));
            if (!record || record.closing) {
                return;
            }

            await this.closeRecord(record, forceDestroy, reason);
        });
    }

    public remove(id: HUIRouteId, reason: HUICloseReason = 'force'): Promise<void> {
        return this.close(id, true, reason);
    }

    public async closeAllDialogs(): Promise<void> {
        const ids = this.stack.getDialogStack().slice().reverse();
        await Promise.all(ids.map((id) => this.close(id)));
    }

    public async closeLayer(layer: HUILayerName): Promise<void> {
        const layerName = String(layer);
        const ids = [...this.records.values()]
            .filter((record) => String(record.layer) === layerName)
            .map((record) => record.id);
        await Promise.all(ids.map((id) => this.close(id)));
    }

    public async closeGroup(group: string): Promise<void> {
        const ids = [...this.records.values()]
            .filter((record) => record.group === group)
            .map((record) => record.id);
        await Promise.all(ids.map((id) => this.close(id)));
    }

    public get(id: HUIRouteId): Node | null {
        return this.records.get(String(id))?.node || null;
    }

    public getScript<T extends HUIViewBase = HUIViewBase>(id: HUIRouteId): T | null {
        return this.records.get(String(id))?.view as T | null;
    }

    public isOpen(id: HUIRouteId): boolean {
        const record = this.records.get(String(id));
        return !!record && record.node.active && !record.closing;
    }

    public getOpenIds(layer?: HUILayerName): string[] {
        const layerName = layer === undefined ? '' : String(layer);
        return [...this.records.values()]
            .filter((record) => record.node.active && !record.closing && (!layerName || String(record.layer) === layerName))
            .map((record) => record.id);
    }

    public getLayerNode(layer: HUILayerName): Node {
        this.ensureInit();
        return this.ensureLayerNode(String(layer));
    }

    // 返回键统一从框架调度：引导层 > layer5 弹窗 > 普通弹窗 > 页面。
    public goBack(): boolean {
        const records = this.getBackRecords();
        for (const record of records) {
            if (this.handleBack(record.id)) {
                return true;
            }
        }

        return false;
    }

    // 首次打开 UI 的完整链路：加载/实例化 -> 创建 record -> 挂层级 -> bind -> open。
    private async loadCreateAndOpen(config: HUIConfig, options: HUIOpenOptions): Promise<Node> {
        const loaded = options.node
            ? { node: options.node } as HUILoadedNode
            : await this.loadPrefabNode(config);
        const node = loaded.node;
        const record = this.createRecord(config, node, options.params);
        record.prefabAsset = loaded.prefabAsset;
        record.bundleName = loaded.bundleName;
        record.bundle = loaded.bundle;
        this.retainRecordResource(record);
        try {
            this.records.set(record.id, record);
            this.attachToLayer(record, options.parent, config.order);
            this.createMaskForRecord(record);
            this.applyInputPolicy(record);
            await this.bindRecord(record, options.params);
            await this.openRecord(record, options.params);
            return node;
        } catch (error) {
            this.records.delete(record.id);
            this.destroyMask(record);
            this.releaseRecordResource(record);
            if (isValid(node)) {
                node.destroy();
            }
            throw error;
        }
    }

    // record 是框架跟踪一个 UI 的最小运行时单元，后续关闭、排序、缓存都以 record 为准。
    private createRecord(config: HUIConfig, node: Node, params?: any): HUIRecord {
        const type = config.type || this.resolveType(config.layer);
        const layer = config.layer || this.resolveLayer(type);
        const group = config.group || this.resolveDefaultGroup(type, layer);
        const record: HUIRecord = {
            id: String(config.id),
            layer,
            type,
            node,
            maskNode: null,
            view: null,
            config: {
                ...config,
                id: String(config.id),
                type,
                layer,
                group,
            },
            params,
            cacheMode: config.cacheMode || this.resolveCacheMode(type),
            group,
            mutexGroup: config.mutexGroup || this.resolveDefaultMutexGroup(config, type, layer, group),
            closing: false,
            lastCloseRequestAt: 0,
            lastUsedAt: Date.now(),
            openIndex: ++this.openSequence,
            operationVersion: 0,
        };
        record.config.cacheMode = record.cacheMode;
        record.config.mutexGroup = record.mutexGroup;
        return record;
    }

    // bind 只执行一次，用于把预制体脚本接入框架生命周期。
    private async bindRecord(record: HUIRecord, params?: any): Promise<void> {
        record.view = this.resolveView(record.node, record.config.scriptName);
        if (!record.view) {
            record.view = record.node.addComponent(HUIViewBase);
        }

        await record.view._hBind({
            id: record.id,
            config: record.config,
            params,
            manager: this,
            store: this.storeFacade,
            eventBus: this.eventBus,
        });
    }

    // 复用缓存 UI 和新建 UI 都走这里，确保打开动画、堆栈和自动移除规则一致。
    private async openRecord(record: HUIRecord, params?: any): Promise<void> {
        if (record.config.exclusive !== false) {
            await this.closeExclusivePeers(record);
        }

        record.params = params;
        record.lastUsedAt = Date.now();
        record.operationVersion += 1;
        record.openIndex = ++this.openSequence;
        this.attachToLayer(record, record.node.parent || undefined, record.config.order);
        this.activateMask(record);
        record.node.active = true;
        this.sortLayer(record.layer);
        await record.view?._hOpen(params);
        this.pushStack(record);
        this.scheduleAutoRemove(record.id, params);
    }

    // 关闭的唯一落点。外部 await H.ui.close(id) 时，等到这里完成才代表关闭动画和资源处理结束。
    private async closeRecord(record: HUIRecord, forceDestroy: boolean, reason: HUICloseReason): Promise<void> {
        const startedAt = Date.now();
        if (!forceDestroy && this.shouldThrottleClose(record)) {
            this.emitUIEvent('ui_close_cancel', record, 'throttle');
            return;
        }

        if (!forceDestroy && record.view && !(await record.view._hCanClose(reason))) {
            this.emitUIEvent('ui_close_cancel', record, reason);
            return;
        }

        record.closing = true;
        record.operationVersion += 1;
        this.emitUIEvent('ui_close_start', record, reason);
        this.playCloseSound(record, reason);
        await record.view?._hClose(reason);
        this.stack.remove(record.id);
        record.lastUsedAt = Date.now();

        const destroyAfterClose = forceDestroy || record.cacheMode === 'destroy';
        if (destroyAfterClose) {
            await record.view?._hRemove();
            this.records.delete(record.id);
            this.destroyMask(record);
            if (isValid(record.node)) {
                record.node.destroy();
            }
            this.releaseRecordResource(record);
            this.emitUIEvent('ui_close_end', record, reason, Date.now() - startedAt);
            return;
        }

        if (isValid(record.node)) {
            record.node.active = false;
        }
        this.hideMask(record);
        record.closing = false;
        this.emitUIEvent('ui_close_end', record, reason, Date.now() - startedAt);
        await this.trimHiddenCache(this.resourcePolicy.maxHiddenRecords, record.id);
    }

    // 互斥规则集中在这里：页面同层互斥，或者配置了相同 mutexGroup 的 UI 互斥。
    private async closeExclusivePeers(target: HUIRecord): Promise<void> {
        const ids = [...this.records.values()]
            .filter((record) => record.id !== target.id)
            .filter((record) => record.node.active && !record.closing)
            .filter((record) => {
                if (target.mutexGroup && record.mutexGroup === target.mutexGroup) {
                    return true;
                }
                return target.type === 'page' && record.type === 'page' && String(record.layer) === String(target.layer);
            })
            .map((record) => record.id);

        await Promise.all(ids.map((id) => this.close(id)));
    }

    private handleBack(id: string): boolean {
        const record = this.records.get(id);
        if (!record || record.closing) {
            return false;
        }

        if (record.view?._hBack()) {
            return true;
        }

        if (record.config.closeOnBack === false) {
            return false;
        }

        void this.close(id, false, 'back');
        return true;
    }

    private getBackRecords(): HUIRecord[] {
        return [...this.records.values()]
            .filter((record) => record.node.active && !record.closing)
            .filter((record) => record.type === 'guide' || record.type === 'dialog' || record.type === 'page')
            .sort((a, b) => {
                const priorityDiff = this.resolveBackPriority(b) - this.resolveBackPriority(a);
                if (priorityDiff !== 0) {
                    return priorityDiff;
                }

                return b.openIndex - a.openIndex;
            });
    }

    private resolveBackPriority(record: HUIRecord): number {
        if (record.type === 'guide') {
            return 400;
        }

        if (record.type === 'dialog' && String(record.layer) === UILayer.Layer5) {
            return 300;
        }

        if (record.type === 'dialog') {
            return 200;
        }

        if (record.type === 'page') {
            return 100;
        }

        return 0;
    }

    private pushStack(record: HUIRecord): void {
        if (record.type === 'page') {
            this.stack.pushPage(record.id);
        } else if (record.type === 'dialog') {
            this.stack.pushDialog(record.id);
        }
    }

    private scheduleAutoRemove(id: string, params?: any): void {
        const record = this.records.get(id);
        if (!record || record.type !== 'tip') {
            return;
        }

        const durationMs = Number(params?.durationMs ?? params?.duration ?? record.config.autoRemoveMs ?? 1500);
        if (durationMs <= 0) {
            return;
        }

        const targetNode = record.node;
        setTimeout(() => {
            const current = this.records.get(id);
            if (current && current.node === targetNode && current.node.active) {
                void this.remove(id, 'auto');
            }
        }, durationMs);
    }

    // 慢 UI 打开提示策略：超过 delayMs 才显示 Loading，并保证至少展示 minShowMs，避免闪一下。
    private beginOpenLoadingSession(config: HUIConfig): HUIOpenLoadingSession | null {
        const policy = this.resolveOpenLoadingPolicy(config);
        if (!policy) {
            return null;
        }

        const loadingId = String(policy.loadingId || this.defaultLoadingId);
        const delayMs = Math.max(0, Math.floor(policy.delayMs ?? 300));
        const minShowMs = Math.max(0, Math.floor(policy.minShowMs ?? 300));
        let cancelled = false;
        let shown = false;
        let shownAt = 0;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let showTask: Promise<void> | null = null;

        timer = setTimeout(() => {
            timer = null;
            if (cancelled) {
                return;
            }

            shown = true;
            shownAt = Date.now();
            this.retainOpenLoading(loadingId);
            showTask = this.openLoading(loadingId, {
                ...(policy.params || {}),
                message: policy.message || '加载中',
            }).then(() => undefined).catch((error) => {
                shown = false;
                this.releaseOpenLoadingRefOnly(loadingId);
                console.warn('[HUIFacade] UI loading 打开失败', error);
            });
        }, delayMs);

        return {
            finish: async () => {
                cancelled = true;
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }

                if (showTask) {
                    await showTask;
                }

                if (!shown) {
                    return;
                }

                const elapsedMs = Date.now() - shownAt;
                const waitMs = Math.max(0, minShowMs - elapsedMs);
                if (waitMs > 0) {
                    await this.wait(waitMs);
                }

                await this.releaseOpenLoading(loadingId);
            },
        };
    }

    private resolveOpenLoadingPolicy(config: HUIConfig): HUIOpenLoadingPolicy | null {
        if (config.type === 'loading' || config.type === 'tip' || (config as HUIOpenOptions).silent) {
            return null;
        }

        const policy = this.normalizeOpenLoadingPolicy(config.openLoading, this.defaultOpenLoadingPolicy);
        if (!policy.enabled) {
            return null;
        }

        return {
            ...policy,
            loadingId: policy.loadingId || this.defaultLoadingId,
        };
    }

    private normalizeOpenLoadingPolicy(
        value: boolean | HUIOpenLoadingPolicy | undefined,
        fallback: HUIOpenLoadingPolicy,
    ): HUIOpenLoadingPolicy {
        if (value === undefined) {
            return { ...fallback };
        }

        if (typeof value === 'boolean') {
            return {
                ...fallback,
                enabled: value,
            };
        }

        return {
            ...fallback,
            ...value,
            enabled: value.enabled ?? fallback.enabled,
        };
    }

    private retainOpenLoading(loadingId: string): void {
        const count = this.openLoadingRefCounts.get(loadingId) || 0;
        this.openLoadingRefCounts.set(loadingId, count + 1);
    }

    private releaseOpenLoadingRefOnly(loadingId: string): void {
        const count = this.openLoadingRefCounts.get(loadingId) || 0;
        if (count <= 1) {
            this.openLoadingRefCounts.delete(loadingId);
            return;
        }

        this.openLoadingRefCounts.set(loadingId, count - 1);
    }

    private async releaseOpenLoading(loadingId: string): Promise<void> {
        const count = this.openLoadingRefCounts.get(loadingId) || 0;
        if (count <= 1) {
            this.openLoadingRefCounts.delete(loadingId);
            await this.close(loadingId);
            return;
        }

        this.openLoadingRefCounts.set(loadingId, count - 1);
    }

    private wait(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async showBuiltinTip(message: string, durationMs = 1500): Promise<Node> {
        this.ensureInit();
        const id = `h:tip:${++this.tipSeed}`;
        const node = new Node(id);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(520, 72);

        const label = node.addComponent(Label);
        label.string = message;
        label.fontSize = 30;
        label.lineHeight = 36;
        label.color = new Color(255, 255, 255, 255);

        return this.open({
            id,
            type: 'tip',
            layer: UILayer.Tip,
            node,
            singleton: false,
            cacheMode: 'destroy',
            animation: 'slide-up',
            autoRemoveMs: durationMs,
            params: {
                message,
                durationMs,
            },
        });
    }

    // 没有注册 loading 预制体时使用内置 Loading，保证框架永远能给用户一个加载反馈。
    private showBuiltinLoading(id: string, params?: any): Promise<Node> {
        const message = String(params?.message || '加载中');
        const existing = this.records.get(id);
        if (existing) {
            this.updateBuiltinLoadingText(existing.node, message);
            return this.open({
                id,
                type: 'loading',
                layer: UILayer.Transition,
                params,
                blockInput: true,
                cacheMode: 'keep',
                openLoading: false,
            });
        }

        const node = new Node(id);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(520, 96);

        const labelNode = new Node('message');
        node.addChild(labelNode);
        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(520, 96);

        const label = labelNode.addComponent(Label);
        label.string = message;
        label.fontSize = 28;
        label.lineHeight = 34;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(255, 255, 255, 255);

        return this.open({
            id,
            type: 'loading',
            layer: UILayer.Transition,
            node,
            singleton: true,
            cacheMode: 'keep',
            blockInput: true,
            animation: 'fade',
            openLoading: false,
            params,
        });
    }

    private updateBuiltinLoadingText(node: Node, message: string): void {
        const label = this.findLabelDeep(node);
        if (label) {
            label.string = message;
        }
    }

    private findLabelDeep(node: Node): Label | null {
        const label = node.getComponent(Label);
        if (label) {
            return label;
        }

        for (const child of node.children) {
            const found = this.findLabelDeep(child);
            if (found) {
                return found;
            }
        }

        return null;
    }

    private createRuntimeId(id: string): string {
        return `${id}#${Date.now()}#${++this.tipSeed}`;
    }

    private attachToLayer(record: HUIRecord, parent?: Node, order?: number): void {
        const targetParent = parent || this.ensureLayerNode(String(record.layer));
        if (record.maskNode && record.maskNode.parent !== targetParent) {
            record.maskNode.setParent(targetParent);
        }
        if (record.node.parent !== targetParent) {
            record.node.setParent(targetParent);
        }

        if (order !== undefined || record.config.order !== undefined) {
            record.node.setSiblingIndex(order ?? record.config.order!);
        }
        this.sortLayer(record.layer);
    }

    // 遮罩由框架统一创建，业务只配置 showMask/closeOnMask/maskOpacity，不需要手写遮罩节点。
    private createMaskForRecord(record: HUIRecord): void {
        if (!this.shouldCreateMask(record)) {
            return;
        }

        if (record.maskNode && record.maskNode.isValid) {
            return;
        }

        const maskNode = new Node(`${record.id}:mask`);
        maskNode.active = false;
        const transform = maskNode.addComponent(UITransform);
        const size = this.getRootSize();
        transform.setContentSize(size.width, size.height);

        let widget = maskNode.addComponent(Widget);
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.left = 0;
        widget.right = 0;
        widget.top = 0;
        widget.bottom = 0;
        widget.updateAlignment();

        maskNode.addComponent(BlockInputEvents);
        maskNode.addComponent(UIOpacity).opacity = this.resolveMaskOpacity(record);
        this.drawMask(maskNode, record);

        this.maskRecordIds.set(maskNode, record.id);
        maskNode.on(Node.EventType.TOUCH_END, this.onMaskTouch, this);

        record.maskNode = maskNode;
        const parent = record.node.parent || this.ensureLayerNode(String(record.layer));
        maskNode.setParent(parent);
    }

    private activateMask(record: HUIRecord): void {
        if (!this.shouldCreateMask(record)) {
            return;
        }

        this.createMaskForRecord(record);
        if (record.maskNode && record.maskNode.isValid) {
            record.maskNode.active = true;
            this.drawMask(record.maskNode, record);
        }
    }

    private hideMask(record: HUIRecord): void {
        if (record.maskNode && record.maskNode.isValid) {
            record.maskNode.active = false;
        }
    }

    private destroyMask(record: HUIRecord): void {
        if (!record.maskNode || !record.maskNode.isValid) {
            record.maskNode = null;
            return;
        }

        record.maskNode.off(Node.EventType.TOUCH_END, this.onMaskTouch, this);
        record.maskNode.destroy();
        record.maskNode = null;
    }

    private shouldCreateMask(record: HUIRecord): boolean {
        if (record.config.showMask !== undefined) {
            return record.config.showMask;
        }

        return record.type === 'dialog'
            || record.type === 'guide'
            || record.type === 'loading';
    }

    private onMaskTouch(event?: EventTouch): void {
        this.stopTouchPropagation(event);
        const target = (event as any)?.currentTarget as Node | undefined;
        if (!target) {
            return;
        }

        const recordId = this.maskRecordIds.get(target);
        if (!recordId) {
            return;
        }

        const record = this.records.get(recordId);
        if (!record || record.config.closeOnMask === false) {
            return;
        }

        void this.close(record.id, false, 'mask');
    }

    private stopTouchPropagation(event?: EventTouch): void {
        const maybeEvent = event as any;
        if (maybeEvent && typeof maybeEvent.stopPropagation === 'function') {
            maybeEvent.stopPropagation();
        }
    }

    private drawMask(maskNode: Node, record: HUIRecord): void {
        const graphics = maskNode.getComponent(Graphics) || maskNode.addComponent(Graphics);
        const size = this.getRootSize();
        const color = record.config.maskColor || { r: 0, g: 0, b: 0, a: 255 };
        graphics.clear();
        graphics.fillColor = new Color(color.r, color.g, color.b, color.a ?? 255);
        graphics.rect(-size.width * 0.5, -size.height * 0.5, size.width, size.height);
        graphics.fill();
    }

    private getRootSize(): { width: number; height: number } {
        const transform = this.root?.getComponent(UITransform);
        return {
            width: Math.max(1, transform?.width || 2000),
            height: Math.max(1, transform?.height || 2000),
        };
    }

    private resolveMaskOpacity(record: HUIRecord): number {
        if (record.config.maskOpacity !== undefined) {
            return Math.max(0, Math.min(255, Math.floor(record.config.maskOpacity)));
        }

        if (record.type === 'guide') {
            return 180;
        }
        if (record.type === 'loading') {
            return 110;
        }
        return 140;
    }

    // 同层排序规则：先按 order/priority，再按 openIndex；遮罩永远排在对应 UI 节点前面。
    private sortLayer(layer: HUILayerName): void {
        const layerName = String(layer);
        const records = [...this.records.values()]
            .filter((record) => String(record.layer) === layerName)
            .filter((record) => record.node.parent === this.layerNodes.get(layerName) || record.maskNode?.parent === this.layerNodes.get(layerName))
            .sort((a, b) => {
                const orderA = this.resolveRecordOrder(a);
                const orderB = this.resolveRecordOrder(b);
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                return a.openIndex - b.openIndex;
            });

        let siblingIndex = 0;
        records.forEach((record) => {
            if (record.maskNode && record.maskNode.isValid && record.maskNode.active) {
                record.maskNode.setSiblingIndex(siblingIndex++);
            }
            if (record.node.isValid && record.node.active) {
                record.node.setSiblingIndex(siblingIndex++);
            }
        });
    }

    private resolveRecordOrder(record: HUIRecord): number {
        if (record.config.order !== undefined) {
            return record.config.order;
        }

        const priority = record.config.priority ?? this.resolveDefaultPriority(record);
        return priority * 100000 + record.openIndex;
    }

    private resolveDefaultPriority(record: HUIRecord): number {
        switch (record.type) {
            case 'guide':
                return 60;
            case 'loading':
                return 70;
            case 'tip':
                return 80;
            case 'dialog':
                return record.layer === UILayer.Layer5 ? 50 : 30;
            case 'page':
                return 10;
            default:
                return 20;
        }
    }

    private shouldThrottleClose(record: HUIRecord): boolean {
        const throttleMs = Math.max(0, Math.floor(record.config.closeThrottleMs ?? 300));
        if (throttleMs <= 0) {
            return false;
        }

        const now = Date.now();
        if (now - record.lastCloseRequestAt < throttleMs) {
            return true;
        }

        record.lastCloseRequestAt = now;
        return false;
    }

    // 关闭音效由框架统一触发，业务只配置 closeSound，具体播放函数在 init 注入。
    private playCloseSound(record: HUIRecord, reason: HUICloseReason): void {
        if (!record.config.closeSound || !this.closeSoundPlayer) {
            return;
        }

        try {
            this.closeSoundPlayer(record.config.closeSound, reason, record.config);
        } catch (error) {
            console.warn('[HUIFacade] closeSoundPlayer 执行失败', error);
        }
    }

    private applyInputPolicy(record: HUIRecord): void {
        if (!record.config.blockInput) {
            return;
        }

        if (!record.node.getComponent(BlockInputEvents)) {
            record.node.addComponent(BlockInputEvents);
        }
    }

    // 初始化时创建所有标准 UI 层，后续 layer1-layer5/tip/guide/transition 都复用这些节点。
    private createDefaultLayers(customOrder?: HUIInitOptions['layerOrder']): void {
        const entries = (Object.values(UILayer) as UILayer[])
            .map((layer) => ({
                layer,
                order: customOrder?.[layer] ?? this.defaultLayerOrder[layer],
            }))
            .sort((a, b) => a.order - b.order);

        entries.forEach((entry, index) => {
            const node = this.ensureLayerNode(entry.layer);
            node.setSiblingIndex(index);
        });
    }

    private ensureLayerNode(layerName: string): Node {
        if (this.layerNodes.has(layerName)) {
            return this.layerNodes.get(layerName)!;
        }

        if (!this.root) {
            throw new Error('[HUIFacade] 请先调用 H.ui.init(root)');
        }

        let layerNode = this.root.getChildByName(layerName);
        if (!layerNode) {
            layerNode = new Node(layerName);
            this.root.addChild(layerNode);
        }

        this.ensureLayerTransform(layerNode);
        this.layerNodes.set(layerName, layerNode);
        return layerNode;
    }

    private ensureRootTransform(root: Node): void {
        if (!root.getComponent(UITransform)) {
            root.addComponent(UITransform);
        }
    }

    private ensureLayerTransform(node: Node): void {
        if (!node.getComponent(UITransform)) {
            node.addComponent(UITransform);
        }

        let widget = node.getComponent(Widget);
        if (!widget) {
            widget = node.addComponent(Widget);
        }

        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.left = 0;
        widget.right = 0;
        widget.top = 0;
        widget.bottom = 0;
        widget.updateAlignment();
    }

    private resolveView(node: Node, scriptName?: string): HUIViewBase | null {
        if (scriptName) {
            const target = node.getComponent(scriptName as any);
            if (target instanceof HUIViewBase) {
                return target;
            }
        }

        const direct = node.getComponent(HUIViewBase);
        if (direct) {
            return direct;
        }

        const components = node.getComponents(Component);
        for (const component of components) {
            if (component instanceof HUIViewBase) {
                return component;
            }
        }

        return null;
    }

    // prefab/bundle 引用计数只在框架层维护，避免业务关闭 UI 时忘记释放资源。
    private retainRecordResource(record: HUIRecord): void {
        if (record.prefabAsset && this.resourcePolicy.releasePrefabOnDestroy) {
            const maybeAsset = record.prefabAsset as any;
            if (typeof maybeAsset.addRef === 'function') {
                maybeAsset.addRef();
            }
        }

        if (record.bundleName && record.bundleName !== 'resources') {
            const count = this.bundleRefCounts.get(record.bundleName) || 0;
            this.bundleRefCounts.set(record.bundleName, count + 1);
        }
    }

    private releaseRecordResource(record: HUIRecord): void {
        if (record.prefabAsset && this.resourcePolicy.releasePrefabOnDestroy) {
            const maybeAsset = record.prefabAsset as any;
            if (typeof maybeAsset.decRef === 'function') {
                maybeAsset.decRef();
            } else {
                assetManager.releaseAsset(record.prefabAsset);
            }
            this.emitUIEvent('ui_resource_release', record, 'prefab');
        }

        if (record.bundleName && record.bundleName !== 'resources') {
            this.releaseBundleRef(record.bundleName, record.bundle);
        }

        record.prefabAsset = undefined;
        record.bundleName = undefined;
        record.bundle = undefined;
    }

    private releaseBundleRef(bundleName: string, bundle?: AssetManager.Bundle): void {
        const count = this.bundleRefCounts.get(bundleName) || 0;
        if (count > 1) {
            this.bundleRefCounts.set(bundleName, count - 1);
            return;
        }

        this.bundleRefCounts.delete(bundleName);
        if (this.resourcePolicy.releaseBundleOnUnused && bundle) {
            assetManager.removeBundle(bundle);
        }
    }

    private getHiddenCacheRecords(includeKeep: boolean): HUIRecord[] {
        return [...this.records.values()]
            .filter((record) => !record.node.active && !record.closing)
            .filter((record) => record.cacheMode === 'hide' || (includeKeep && record.cacheMode === 'keep'))
            .filter((record) => record.type !== 'loading' && record.type !== 'tip');
    }

    // 低内存时按策略清理隐藏缓存，keep 缓存是否清理由 resource.lowMemoryStrategy 决定。
    private bindLowMemoryListener(): void {
        const eventName = (game as any).EVENT_LOW_MEMORY;
        if (!eventName) {
            return;
        }

        game.off(eventName, this.onLowMemory, this);
        game.on(eventName, this.onLowMemory, this);
    }

    private onLowMemory(): void {
        void this.handleLowMemory();
    }

    private async handleLowMemory(): Promise<void> {
        switch (this.resourcePolicy.lowMemoryStrategy) {
            case 'destroy-hidden':
                await this.clearHiddenCache(false);
                break;
            case 'destroy-hidden-and-keep':
                await this.clearHiddenCache(true);
                break;
            case 'none':
            default:
                break;
        }
    }

    // 资源加载只支持两条路径：resources 或指定 bundle，方便快速定位资源路径问题。
    private loadPrefabNode(config: HUIConfig): Promise<HUILoadedNode> {
        const prefabPath = config.prefabPath;
        if (!prefabPath) {
            return Promise.reject(new Error(`[HUIFacade] ${String(config.id)} 缺少 prefabPath 或 node`));
        }

        const bundleName = config.bundle;
        if (!bundleName || bundleName === 'resources') {
            return new Promise((resolve, reject) => {
                resources.load(prefabPath, Prefab, (err, prefab) => {
                    if (err || !prefab) {
                        reject(err || new Error(`[HUIFacade] 预制体加载失败：resources/${prefabPath}`));
                        return;
                    }
                    resolve({
                        node: instantiate(prefab),
                        prefabAsset: prefab,
                        bundleName: 'resources',
                    });
                });
            });
        }

        return this.loadBundle(bundleName).then((bundle) => new Promise<HUILoadedNode>((resolve, reject) => {
            bundle.load(prefabPath, Prefab, (err, prefab) => {
                if (err || !prefab) {
                    reject(err || new Error(`[HUIFacade] 预制体加载失败：${bundleName}/${prefabPath}`));
                    return;
                }
                resolve({
                    node: instantiate(prefab),
                    prefabAsset: prefab,
                    bundleName,
                    bundle,
                });
            });
        }));
    }

    private loadBundle(bundleName: string): Promise<AssetManager.Bundle> {
        const cached = assetManager.getBundle(bundleName);
        if (cached) {
            return Promise.resolve(cached);
        }

        return new Promise((resolve, reject) => {
            assetManager.loadBundle(bundleName, (err, bundle) => {
                if (err || !bundle) {
                    reject(err || new Error(`[HUIFacade] Bundle 加载失败：${bundleName}`));
                    return;
                }
                resolve(bundle);
            });
        });
    }

    // 兼容两种打开方式：传路由 id 使用注册配置，或直接传 HUIOpenOptions 临时配置。
    private resolveOpenInput(input: HUIOpenInput, params?: any, openOptions: Partial<HUIOpenOptions> = {}): HUIOpenOptions {
        if (typeof input === 'string') {
            const registered = this.configs.get(input);
            if (!registered) {
                throw new Error(`[HUIFacade] UI 路由未注册：${input}`);
            }
            return {
                ...registered,
                ...openOptions,
                id: input,
                params: openOptions.params ?? params,
            };
        }

        const id = String(input.id);
        const registered = this.configs.get(id);
        return {
            ...registered,
            ...input,
            ...openOptions,
            id,
            params: openOptions.params ?? input.params ?? params,
        };
    }

    // 统一补齐默认值，保证后续流程不用到处判断 layer/type/cache/mask 等缺省配置。
    private normalizeConfig(config: HUIConfig): HUIConfig {
        const id = String(config.id || '').trim();
        if (!id) {
            throw new Error('[HUIFacade] UI id 不能为空');
        }

        const type = config.type || this.resolveType(config.layer);
        const layer = config.layer || this.resolveLayer(type);
        const cacheMode = config.cacheMode || this.resolveCacheMode(type);
        const group = config.group || this.resolveDefaultGroup(type, layer);
        return {
            ...config,
            id,
            type,
            layer,
            cacheMode,
            group,
            singleton: config.singleton ?? type !== 'tip',
            exclusive: config.exclusive ?? type === 'page',
            blockInput: config.blockInput ?? (type === 'dialog' || type === 'guide' || type === 'loading'),
            showMask: config.showMask ?? (type === 'dialog' || type === 'guide' || type === 'loading'),
            closeOnMask: config.closeOnMask ?? type === 'dialog',
            closeOnBack: config.closeOnBack ?? (type === 'dialog' || type === 'page' || type === 'guide'),
            closeOnBgClose: config.closeOnBgClose ?? true,
            closeThrottleMs: config.closeThrottleMs ?? 300,
            closeStopPropagation: config.closeStopPropagation ?? true,
            mutexGroup: config.mutexGroup || this.resolveDefaultMutexGroup(config, type, layer, group),
        };
    }

    private resolveLayer(type: HUIType): HUILayerName {
        switch (type) {
            case 'page':
                return UILayer.Layer2;
            case 'dialog':
                return UILayer.Layer3;
            case 'tip':
                return UILayer.Tip;
            case 'guide':
                return UILayer.Guide;
            case 'loading':
                return UILayer.Transition;
            default:
                return UILayer.Layer3;
        }
    }

    private resolveType(layer?: HUILayerName): HUIType {
        switch (layer) {
            case UILayer.Layer1:
            case UILayer.Layer2:
                return 'page';
            case UILayer.Tip:
                return 'tip';
            case UILayer.Guide:
                return 'guide';
            case UILayer.Transition:
                return 'loading';
            default:
                return 'dialog';
        }
    }

    private resolveCacheMode(type: HUIType): HUICacheMode {
        switch (type) {
            case 'page':
            case 'loading':
            case 'guide':
                return 'keep';
            case 'tip':
            case 'dialog':
            default:
                return 'destroy';
        }
    }

    private resolveDefaultGroup(type: HUIType, layer: HUILayerName): string {
        return `${type}:${String(layer)}`;
    }

    private resolveDefaultMutexGroup(config: HUIConfig, type: HUIType, layer: HUILayerName, group: string): string {
        if (config.mutexGroup) {
            return config.mutexGroup;
        }

        if (type === 'page') {
            return `page:${String(layer)}`;
        }

        return group;
    }

    // 每个 UI id 一条队列，所有打开/关闭动作串行执行，避免异步动画和资源状态互相打架。
    private enqueueOperation<T>(id: string, task: () => Promise<T>): Promise<T> {
        const previous = this.operationQueues.get(id) || Promise.resolve();
        const current = previous
            .catch(() => undefined)
            .then(task);
        const queue = current.catch(() => undefined).finally(() => {
            if (this.operationQueues.get(id) === queue) {
                this.operationQueues.delete(id);
            }
        });

        this.operationQueues.set(id, queue);

        return current;
    }

    // UI 事件统一从这里发出，便于埋点、性能统计和线上排查打开失败/关闭失败。
    private emitUIEvent(eventName: HUIEventType, target: HUIRecord | HUIConfig, reasonOrError?: unknown, durationMs?: number): void {
        const record = this.isRecord(target) ? target : null;
        const config = record ? record.config : target;
        const event: HUIEvent = {
            name: eventName,
            id: String(config.id),
            type: config.type,
            layer: config.layer,
            timestamp: Date.now(),
            config,
        };

        if (durationMs !== undefined) {
            event.durationMs = durationMs;
        }

        if (eventName.endsWith('_fail')) {
            event.error = reasonOrError;
        } else if (reasonOrError !== undefined) {
            event.reason = String(reasonOrError);
        }

        try {
            this.eventReporter?.(event);
        } catch (error) {
            console.warn('[HUIFacade] eventReporter 执行失败', error);
        }

        this.listeners.get(eventName)?.forEach((listener) => {
            try {
                listener(event);
            } catch (error) {
                console.warn('[HUIFacade] UI 事件监听执行失败', error);
            }
        });
    }

    private isRecord(target: HUIRecord | HUIConfig): target is HUIRecord {
        return (target as HUIRecord).node !== undefined;
    }

    private ensureInit(): void {
        if (!this.root) {
            throw new Error('[HUIFacade] 请先调用 H.ui.init(root) 或 H.init({ uiRoot })');
        }
    }
}
