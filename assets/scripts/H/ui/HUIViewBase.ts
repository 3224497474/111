import { _decorator, Component, EventTouch, Node, Tween, tween, UIOpacity, Vec3, isValid } from 'cc';
import type {
    HUICloseReason,
    HUIAutoClearScope,
    HUIAnimationConfig,
    HUIAnimationType,
    HUIConfig,
    HUIEventListenOptions,
    HUIModelWatchConfig,
    HUIStatus,
    HUITimerOptions,
    HUIViewBindContext,
} from './HUITypes';
import type { HEventBus, HEventId, HEventListener } from '../core/HEventBus';
import type { HEventNameLike, HEventPayload } from '../core/HEventNames';
import { HLifecycleScope } from '../core/HLifecycleScope';
import type { HLifecycleKind } from '../core/HLifecycleScope';
import type { HStoreFacade } from '../store/HStoreFacade';
import type { HStoreChange, HStoreSetOptions, HStoreState, HStoreWatchOptions } from '../store/HStoreTypes';
import type { HUIFacade } from './HUIFacade';
import { HUIBindingComponent } from './binding/HUIBindingComponent';
import { HUIBindingWatcher } from './binding/HUIBindingWatcher';
import type { HUIBindingConfig } from './binding/HUIBindingTypes';

const { ccclass } = _decorator;

/**
 * HUIViewBase 是所有业务 UI 的基础类。
 *
 * 业务脚本只建议重写 onBind/onOpen/onEnableView/onRefresh/onRefreshDirty/onDisableView/onBeforeClose/onClose/onRemove/onBack。
 * 框架内部会调用 _hBind/_hOpen/_hClose/_hRemove，并统一处理动画、bgclose、状态流转和 await close。
 */
@ccclass('HUIViewBase')
export class HUIViewBase<TParams = any> extends Component {
    // 对外可读的运行时信息，方便在调试器里快速看到当前 UI id、参数和状态。
    public uiId = '';
    public uiConfig: HUIConfig | null = null;
    public uiParams: TParams | null = null;
    public uiStatus: HUIStatus = 'idle';

    // 业务子类使用 protected 字段即可读取管理器、参数和配置，不需要自己查找单例。
    protected manager: HUIFacade = null!;
    protected store: HStoreFacade | null = null;
    protected eventBus: HEventBus | null = null;
    protected params: TParams = null as TParams;
    protected config: HUIConfig = null!;

    // lifeVersion 用于判断异步流程是否已经过期，动画基础变换用于打开/关闭后恢复节点状态。
    private bound = false;
    private lifeVersion = 0;
    private bgCloseNode: Node | null = null;
    private basePosition = new Vec3();
    private baseScale = new Vec3(1, 1, 1);
    private baseOpacity = 255;
    private capturedTransform = false;
    private storeRefreshScheduled = false;
    private autoModelWatchConnected = false;
    private readonly autoModelWatchCleanupIds: number[] = [];
    private readonly storeWatchCleanupIds: number[] = [];
    private readonly pendingStoreChanges: HStoreChange[] = [];
    private readonly manualDataBindings: HUIBindingConfig[] = [];
    private bindingWatcher: HUIBindingWatcher | null = null;
    private readonly lifecycle = new HLifecycleScope('HUIViewBase');
    private readonly eventCleanupIds = new Map<HEventId, number>();

    // 框架绑定入口，只执行一次：注入上下文、记录初始变换、绑定 bgclose、调用业务 onBind。
    public async _hBind(context: HUIViewBindContext<TParams> & { manager: HUIFacade }): Promise<void> {
        if (this.bound) {
            return;
        }

        this.uiStatus = 'binding';
        this.uiId = context.id;
        this.uiConfig = context.config;
        this.uiParams = context.params ?? null;
        this.params = context.params as TParams;
        this.config = context.config;
        this.manager = context.manager;
        this.store = context.store || null;
        this.eventBus = context.eventBus || null;
        this.bound = true;

        this.captureBaseTransform();
        this.bindBgClose();
        await this.onBind(context);
        this.setupDataBindings();
        this.uiStatus = 'closed';
    }

    // 框架打开入口：onOpen -> 打开动画 -> onEnableView -> onRefresh。
    public async _hOpen(params?: TParams): Promise<void> {
        if (this.uiStatus === 'opening' || this.uiStatus === 'closing') {
            return;
        }

        if (this.uiStatus === 'opened') {
            await this._hRefresh(params);
            return;
        }

        this.setParams(params);
        this.nextLifeVersion();
        this.uiStatus = 'opening';
        this.node.active = true;

        this.connectAutoModelWatches();
        this.startDataBindings();
        await this.onOpen(this.params);
        await this.playOpenAnimation();

        this.uiStatus = 'opened';
        await this.onEnableView();
        await this._hRefresh(this.params);
        await this.flushStoreChanges();
    }

    // 刷新数据入口。重复打开已打开的 UI 时会直接转成 refresh。
    public async _hRefresh(params?: TParams): Promise<void> {
        if (this.uiStatus === 'removed' || this.uiStatus === 'destroyed') {
            return;
        }

        this.setParams(params);
        const previousStatus = this.uiStatus;
        this.uiStatus = 'refreshing';
        await this.onRefresh(this.params);
        this.uiStatus = previousStatus === 'refreshing' ? 'opened' : previousStatus;
    }

    // Store 数据变化由这里进入 UI，基类会合并到下一轮刷新，避免同一帧多次刷界面。
    public _hStoreChange(change: HStoreChange): void {
        if (this.uiStatus === 'removed' || this.uiStatus === 'destroyed') {
            return;
        }

        this.pendingStoreChanges.push(this.mergeStoreChange(change));
        if (this.uiStatus === 'opened' || this.uiStatus === 'refreshing') {
            this.scheduleStoreRefresh();
        }
    }

    // 关闭前的禁用阶段，用于暂停按钮、倒计时、监听等可恢复状态。
    public async _hDisable(): Promise<void> {
        if (this.uiStatus !== 'opened' && this.uiStatus !== 'refreshing') {
            return;
        }

        this.uiStatus = 'disabling';
        await this.onDisableView();
        this.clearLifecycleCleanups('disable');
        this.autoModelWatchConnected = false;
    }

    // 关闭确认入口，业务可以在 onBeforeClose 里做二次确认或拦截。
    public async _hCanClose(reason: HUICloseReason): Promise<boolean> {
        return this.onBeforeClose(reason);
    }

    // 框架关闭入口：onDisableView -> onClose -> 关闭动画 -> 恢复节点初始变换。
    public async _hClose(reason: HUICloseReason): Promise<void> {
        if (this.uiStatus === 'closing'
            || this.uiStatus === 'closed'
            || this.uiStatus === 'removed'
            || this.uiStatus === 'destroyed') {
            return;
        }

        await this._hDisable();
        this.disconnectAutoModelWatches();
        this.stopDataBindings();
        this.nextLifeVersion();
        this.uiStatus = 'closing';
        await this.onClose(reason);
        await this.playCloseAnimation();
        this.restoreBaseTransform();
        this.uiStatus = 'closed';
    }

    // 真正销毁/移除前调用，业务在 onRemove 里释放一次性资源和事件监听。
    public async _hRemove(): Promise<void> {
        if (this.uiStatus === 'removed' || this.uiStatus === 'destroyed') {
            return;
        }

        this.unbindBgClose();
        this.clearStoreWatchers();
        this.stopDataBindings();
        this.clearDataBindings();
        this.clearLifecycleCleanups('remove', true);
        await this.onRemove();
        this.nextLifeVersion();
        this.uiStatus = 'removed';
    }

    public _hBack(): boolean {
        return this.onBack();
    }

    // 业务内部推荐 await this.close()，这样后续逻辑会等关闭动画和框架状态处理完成。
    public close(reason: HUICloseReason = 'api'): Promise<void> {
        if (!this.manager || !this.uiId) {
            return Promise.resolve();
        }

        return this.manager.close(this.uiId, false, reason);
    }

    public remove(): Promise<void> {
        if (!this.manager || !this.uiId) {
            return Promise.resolve();
        }

        return this.manager.remove(this.uiId);
    }

    public refresh(params?: TParams): Promise<void> {
        if (!this.manager || !this.uiId) {
            return Promise.resolve();
        }

        return this.manager.refresh(this.uiId, params);
    }

    // 订阅 H.event 全局事件，默认在 UI disable/close 时自动取消。
    protected listenEvent<TName extends HEventNameLike, TPayload = HEventPayload<TName>>(
        eventName: TName,
        listener: HEventListener<TPayload>,
        options: HUIEventListenOptions = {},
    ): HEventId {
        if (!this.eventBus) {
            return 0;
        }

        // H.event.on 返回唯一 eventId；UI 基类把这个 id 绑定到生命周期清理表。
        const eventId = this.eventBus.on(eventName, listener, {
            owner: options.owner || this.uiId || this.node.name,
        });
        this.bindEventCleanup(eventId, options.clearOn || 'disable');
        return eventId;
    }

    protected emitEvent<TName extends HEventNameLike, TPayload = HEventPayload<TName>>(
        eventName: TName,
        payload?: TPayload,
    ): void {
        this.eventBus?.emit<TName, TPayload>(eventName, payload);
    }

    // 接入函数式事件 API，例如 this.listenEventApi(() => ProjectEvent.onCoinChanged(this.onCoinChanged))。
    protected listenEventApi(register: () => HEventId, options?: HUIEventListenOptions): HEventId;
    protected listenEventApi(register: () => () => void, options?: HUIEventListenOptions): () => void;
    protected listenEventApi(register: () => HEventId | (() => void), options: HUIEventListenOptions = {}): HEventId | (() => void) {
        const result = register();
        if (typeof result === 'number') {
            this.bindEventCleanup(result, options.clearOn || 'disable');
            return result;
        }

        // 兼容第三方或旧代码返回取消函数的写法，框架仍然统一托管销毁。
        const cleanupId = this.addLifecycleCleanup(result, options.clearOn || 'disable', 'event');
        return () => this.runLifecycleCleanup(cleanupId);
    }

    protected clearEvent(eventId: HEventId): void {
        const cleanupId = this.eventCleanupIds.get(eventId);
        if (cleanupId !== undefined) {
            this.runLifecycleCleanup(cleanupId);
            return;
        }

        this.eventBus?.off(eventId);
    }

    // 订阅节点或任意 on/off 风格事件源，默认在 UI disable/close 时自动取消。
    protected listenNode(
        target: { on?: (...args: any[]) => any; off?: (...args: any[]) => any } | null | undefined,
        eventName: string,
        listener: (...args: any[]) => void,
        thisArg: any = this,
        options: HUIEventListenOptions = {},
    ): () => void {
        if (!target?.on || !target?.off) {
            return () => undefined;
        }

        target.on(eventName, listener, thisArg);
        const cleanupId = this.addLifecycleCleanup(() => {
            target.off?.(eventName, listener, thisArg);
        }, options.clearOn || 'disable', 'node-event');
        return () => this.runLifecycleCleanup(cleanupId);
    }

    protected setTimer(callback: () => void, intervalMs: number, options: HUITimerOptions = {}): number {
        const delayMs = Math.max(0, Math.floor(intervalMs));
        const repeat = options.repeat !== false;
        let cleanupId = 0;
        const run = () => {
            try {
                callback();
            } catch (error) {
                console.warn('[HUIViewBase] timer callback 执行失败', error);
            } finally {
                if (!repeat) {
                    this.lifecycle.remove(cleanupId);
                }
            }
        };
        const handle = repeat
            ? setInterval(run, delayMs)
            : setTimeout(run, delayMs);
        cleanupId = this.addLifecycleCleanup(() => {
            if (repeat) {
                clearInterval(handle as ReturnType<typeof setInterval>);
            } else {
                clearTimeout(handle as ReturnType<typeof setTimeout>);
            }
        }, options.clearOn || 'disable', 'timer');

        if (options.immediate && repeat) {
            callback();
        }
        return cleanupId;
    }

    protected setOnceTimer(callback: () => void, delayMs: number, options: Omit<HUITimerOptions, 'repeat'> = {}): number {
        return this.setTimer(callback, delayMs, { ...options, repeat: false });
    }

    protected clearTimer(timerId: number): void {
        this.runLifecycleCleanup(timerId);
    }

    protected clearAllTimers(scope?: HUIAutoClearScope): void {
        this.clearLifecycleCleanups(scope, scope === 'remove', 'timer');
    }

    protected addCleanup(dispose: () => void, clearOn: HUIAutoClearScope = 'disable'): () => void {
        const cleanupId = this.addLifecycleCleanup(dispose, clearOn, 'custom');
        return () => this.runLifecycleCleanup(cleanupId);
    }

    // 订阅模块数据变化，关闭或销毁时基类会自动取消订阅。
    protected watchModel<TState extends HStoreState = HStoreState>(
        moduleName: string,
        paths?: string | string[],
        options: HStoreWatchOptions = {},
    ): () => void {
        if (!this.store) {
            return () => undefined;
        }

        const unwatch = this.store.watch<TState>(moduleName, paths, (change) => this._hStoreChange(change), options);
        let cleanupId = 0;
        cleanupId = this.addLifecycleCleanup(() => {
            this.safeUnwatch(unwatch, 'store unwatch');
            this.removeCleanupId(this.storeWatchCleanupIds, cleanupId);
        }, 'disable', 'vm-watch');
        if (cleanupId) {
            this.storeWatchCleanupIds.push(cleanupId);
        }
        return () => this.runLifecycleCleanup(cleanupId);
    }

    protected getModel<TState extends HStoreState = HStoreState>(moduleName: string, defaultValue: TState = {} as TState): TState {
        if (!this.store) {
            return defaultValue;
        }
        return this.store.get<TState>(moduleName, defaultValue);
    }

    protected setModel<TState extends HStoreState = HStoreState>(moduleName: string, value: TState, options: HStoreSetOptions = {}): void {
        this.store?.set<TState>(moduleName, value, options);
    }

    protected patchModel<TState extends HStoreState = HStoreState>(
        moduleName: string,
        patch: Partial<TState>,
        options: HStoreSetOptions = {},
    ): TState {
        if (!this.store) {
            return {} as TState;
        }
        return this.store.patch<TState>(moduleName, patch, options);
    }

    protected getModelValue<TValue>(moduleName: string, path: string, defaultValue: TValue): TValue {
        if (!this.store) {
            return defaultValue;
        }
        return this.store.getValue<TValue>(moduleName, path, defaultValue);
    }

    protected setModelValue<TValue>(moduleName: string, path: string, value: TValue, options: HStoreSetOptions = {}): void {
        this.store?.setValue<TValue>(moduleName, path, value, options);
    }

    /**
     * 声明当前 UI 的数据绑定。
     *
     * @returns 类型 HUIBindingConfig[]，作用是把 Store 字段绑定到 UI 节点。
     */
    protected getDataBindings(): HUIBindingConfig[] {
        return [];
    }

    /**
     * 手动追加一条数据绑定。
     *
     * @param binding 类型 HUIBindingConfig，作用是声明 module/path 与目标节点的绑定关系。
     */
    protected addDataBinding(binding: HUIBindingConfig): void {
        this.manualDataBindings.push(binding);
        this.setupDataBindings();
    }

    /**
     * 手动刷新数据绑定。
     *
     * @param moduleName 类型 string | undefined，作用是指定 Store 模块；不传则刷新全部。
     * @param paths 类型 string | string[] | undefined，作用是指定字段路径；不传则刷新模块全部绑定。
     */
    protected refreshDataBindings(moduleName?: string, paths?: string | string[]): void {
        this.bindingWatcher?.refresh(moduleName, paths);
    }

    /**
     * 通过绑定体系写入 Store 字段。
     *
     * @param moduleName 类型 string，作用是 Store 模块名。
     * @param path 类型 string，作用是模块内字段路径。
     * @param value 类型 TValue，作用是要写入的字段值。
     * @param options 类型 HStoreSetOptions，作用是 Store 写入选项。
     */
    protected setBindingValue<TValue>(moduleName: string, path: string, value: TValue, options: HStoreSetOptions = {}): void {
        this.setModelValue(moduleName, path, value, options);
    }

    // 生命周期钩子区：子类只重写这些方法，不直接依赖 Cocos onLoad/start 承载业务 UI 流程。
    protected onBind(_context: HUIViewBindContext<TParams>): void | Promise<void> {}

    protected onOpen(_params: TParams): void | Promise<void> {}

    protected onEnableView(): void | Promise<void> {}

    protected onRefresh(_params: TParams): void | Promise<void> {}

    protected async onRefreshDirty(changes: HStoreChange[]): Promise<void> {
        for (const change of changes) {
            await this.onStoreChange(change);
        }
    }

    protected onStoreChange(_change: HStoreChange): void | Promise<void> {}

    protected getModelWatches(): HUIModelWatchConfig[] {
        return [];
    }

    protected onDisableView(): void | Promise<void> {}

    protected onBeforeClose(_reason: HUICloseReason): boolean | Promise<boolean> {
        return true;
    }

    protected onClose(_reason: HUICloseReason): void | Promise<void> {}

    protected onRemove(): void | Promise<void> {}

    protected onBack(): boolean {
        return false;
    }

    // 每次打开/关闭/销毁递增版本号，异步回调可用 isAlive(version) 防止过期写 UI。
    protected nextLifeVersion(): number {
        this.lifeVersion += 1;
        return this.lifeVersion;
    }

    protected isAlive(version: number): boolean {
        return this.lifeVersion === version
            && this.uiStatus !== 'removed'
            && this.uiStatus !== 'destroyed'
            && isValid(this.node);
    }

    protected getAnimationTargetNode(): Node {
        return this.node;
    }

    // 默认查找名为 bgclose 的子节点作为关闭热区，项目可通过 bgCloseName 改名。
    protected getBgCloseNode(): Node | null {
        const name = this.config?.bgCloseName || 'bgclose';
        return this.findChildDeep(this.node, name);
    }

    protected onDestroy(): void {
        this.unbindBgClose();
        this.clearStoreWatchers();
        this.stopDataBindings();
        this.clearDataBindings();
        this.lifecycle.destroy();
        this.eventCleanupIds.clear();
        this.nextLifeVersion();
        this.uiStatus = 'destroyed';
    }

    private addLifecycleCleanup(
        dispose: () => void,
        scope: HUIAutoClearScope,
        kind: HLifecycleKind,
    ): number {
        return this.lifecycle.add(dispose, {
            kind,
            scope,
            label: this.uiId || this.node.name,
        });
    }

    private bindEventCleanup(eventId: HEventId, scope: HUIAutoClearScope): void {
        if (!eventId || !this.eventBus) {
            return;
        }

        const cleanupId = this.addLifecycleCleanup(() => {
            this.eventBus?.off(eventId);
            this.eventCleanupIds.delete(eventId);
        }, scope, 'event');
        if (cleanupId) {
            this.eventCleanupIds.set(eventId, cleanupId);
        }
    }

    private runLifecycleCleanup(id: number): void {
        this.lifecycle.remove(id);
    }

    private clearLifecycleCleanups(scope?: HUIAutoClearScope, includeAll = false, kind?: HLifecycleKind): void {
        this.lifecycle.clear(scope, includeAll, kind);
    }

    private safeUnwatch(unwatch: (() => void) | undefined, label: string): void {
        try {
            unwatch?.();
        } catch (error) {
            console.warn(`[HUIViewBase] ${label} 执行失败`, error);
        }
    }

    private removeCleanupId(list: number[], cleanupId: number): void {
        const index = list.indexOf(cleanupId);
        if (index >= 0) {
            list.splice(index, 1);
        }
    }

    private connectAutoModelWatches(): void {
        if (this.autoModelWatchConnected || !this.store) {
            return;
        }

        const watches = [
            ...(this.config?.modelWatches || []),
            ...this.getModelWatches(),
        ].filter((watch) => !!watch.module);

        watches.forEach((watch) => {
            const unwatch = this.store!.watch(
                watch.module,
                watch.paths || '*',
                (change) => this._hStoreChange(change),
                {
                    immediate: watch.immediate !== false,
                    includeChildren: watch.includeChildren,
                    once: watch.once,
                },
            );
            let cleanupId = 0;
            cleanupId = this.addLifecycleCleanup(() => {
                this.safeUnwatch(unwatch, 'auto model unwatch');
                this.removeCleanupId(this.autoModelWatchCleanupIds, cleanupId);
                if (this.autoModelWatchCleanupIds.length <= 0) {
                    this.autoModelWatchConnected = false;
                }
            }, 'disable', 'vm-watch');
            if (cleanupId) {
                this.autoModelWatchCleanupIds.push(cleanupId);
            }
        });

        this.autoModelWatchConnected = true;
    }

    private disconnectAutoModelWatches(): void {
        while (this.autoModelWatchCleanupIds.length > 0) {
            this.runLifecycleCleanup(this.autoModelWatchCleanupIds.pop()!);
        }
        this.autoModelWatchConnected = false;
    }

    private scheduleStoreRefresh(): void {
        if (this.storeRefreshScheduled) {
            return;
        }

        this.storeRefreshScheduled = true;
        setTimeout(() => {
            this.storeRefreshScheduled = false;
            if (this.uiStatus === 'opened' || this.uiStatus === 'refreshing') {
                void this.flushStoreChanges();
            }
        }, 0);
    }

    private async flushStoreChanges(): Promise<void> {
        if (this.pendingStoreChanges.length <= 0) {
            return;
        }

        const changes = this.pendingStoreChanges.splice(0, this.pendingStoreChanges.length);
        await this.onRefreshDirty(changes);
    }

    private mergeStoreChange(change: HStoreChange): HStoreChange {
        const index = this.pendingStoreChanges.findIndex((item) => item.module === change.module);
        if (index < 0) {
            return change;
        }

        const previous = this.pendingStoreChanges.splice(index, 1)[0];
        const paths = [...previous.paths, ...change.paths]
            .filter((path, pathIndex, list) => list.indexOf(path) === pathIndex);
        return {
            ...change,
            paths,
            previous: previous.previous || change.previous,
            has: (path: string) => previous.has(path) || change.has(path) || this.storePathsInclude(paths, path),
        };
    }

    private storePathsInclude(paths: string[], targetPath: string): boolean {
        const target = String(targetPath || '*').trim() || '*';
        return paths.some((path) => {
            if (path === '*' || target === '*') {
                return true;
            }
            return path === target
                || path.startsWith(`${target}.`)
                || target.startsWith(`${path}.`);
        });
    }

    private clearStoreWatchers(): void {
        this.disconnectAutoModelWatches();
        while (this.storeWatchCleanupIds.length > 0) {
            this.runLifecycleCleanup(this.storeWatchCleanupIds.pop()!);
        }
        this.pendingStoreChanges.length = 0;
        this.storeRefreshScheduled = false;
    }

    private setupDataBindings(): void {
        if (!this.store) {
            return;
        }

        const bindings = this.collectDataBindings();
        if (bindings.length <= 0) {
            this.bindingWatcher?.stop();
            this.bindingWatcher = null;
            return;
        }

        if (!this.bindingWatcher) {
            this.bindingWatcher = new HUIBindingWatcher(this.node, this.store, {
                owner: this.uiId || this.node.name,
                debug: this.config?.dataBindingDebug === true,
            });
        }

        this.bindingWatcher.setBindings(bindings);
        if (this.uiStatus === 'opened' || this.uiStatus === 'refreshing') {
            this.bindingWatcher.start();
        }
    }

    private startDataBindings(): void {
        if (!this.bindingWatcher) {
            this.setupDataBindings();
        }
        this.bindingWatcher?.start();
    }

    private stopDataBindings(): void {
        this.bindingWatcher?.stop();
    }

    private clearDataBindings(): void {
        this.bindingWatcher?.stop();
        this.bindingWatcher = null;
        this.manualDataBindings.length = 0;
    }

    private collectDataBindings(): HUIBindingConfig[] {
        const fromRoute = this.config?.dataBindings || [];
        const fromCode = this.getDataBindings();
        const fromManual = this.manualDataBindings;
        const fromComponents = this.node
            .getComponentsInChildren(HUIBindingComponent)
            .map((component) => component.toBindingConfig())
            .filter((binding): binding is HUIBindingConfig => !!binding);

        return [
            ...fromRoute,
            ...fromCode,
            ...fromManual,
            ...fromComponents,
        ];
    }

    private setParams(params?: TParams): void {
        if (params !== undefined) {
            this.params = params;
            this.uiParams = params;
        }
    }

    // bgclose 由基类统一绑定，避免每个弹窗重复写关闭按钮和事件注销逻辑。
    private bindBgClose(): void {
        if (this.config?.closeOnBgClose === false) {
            return;
        }

        this.bgCloseNode = this.getBgCloseNode();
        if (!this.bgCloseNode) {
            return;
        }

        this.bgCloseNode.off(Node.EventType.TOUCH_END, this.onBgCloseTouch, this);
        this.bgCloseNode.on(Node.EventType.TOUCH_END, this.onBgCloseTouch, this);
    }

    private unbindBgClose(): void {
        if (!this.bgCloseNode || !this.bgCloseNode.isValid) {
            this.bgCloseNode = null;
            return;
        }

        this.bgCloseNode.off(Node.EventType.TOUCH_END, this.onBgCloseTouch, this);
        this.bgCloseNode = null;
    }

    private onBgCloseTouch(event?: EventTouch): void {
        if (this.config?.closeStopPropagation !== false) {
            this.stopTouchPropagation(event);
        }

        void this.close('bgclose');
    }

    private stopTouchPropagation(event?: EventTouch): void {
        const maybeEvent = event as any;
        if (maybeEvent && typeof maybeEvent.stopPropagation === 'function') {
            maybeEvent.stopPropagation();
        }
    }

    // 打开动画统一从配置解析，默认弹窗/奖励 fade-scale，页面/loading/tip/guide/error fade。
    private async playOpenAnimation(): Promise<void> {
        const target = this.getAnimationTargetNode();
        const config = this.resolveAnimationConfig();
        const animation = config.open || 'none';
        const duration = config.openDuration ?? config.duration ?? this.getDefaultAnimationDuration();
        if (animation === 'none' || duration <= 0 || !isValid(target)) {
            this.restoreBaseTransform();
            return;
        }

        const opacity = this.ensureOpacity(target);
        this.stopAnimation(target, opacity);
        this.prepareOpenAnimation(target, opacity, animation, config.distance ?? 96);

        await Promise.all([
            this.tweenNode(target, duration, this.basePosition.clone(), this.baseScale.clone(), 'backOut'),
            this.tweenOpacity(opacity, duration, this.baseOpacity, 'quadOut'),
        ]);
        this.restoreBaseTransform();
    }

    // close() 返回 Promise，只有关闭动画结束后才 resolve，方便弹窗串行和奖励结算。
    private async playCloseAnimation(): Promise<void> {
        const target = this.getAnimationTargetNode();
        const config = this.resolveAnimationConfig();
        const animation = config.close || config.open || 'none';
        const duration = config.closeDuration ?? config.duration ?? this.getDefaultAnimationDuration();
        if (animation === 'none' || duration <= 0 || !isValid(target)) {
            return;
        }

        const opacity = this.ensureOpacity(target);
        const closeTarget = this.getCloseAnimationTarget(animation, config.distance ?? 96);
        this.stopAnimation(target, opacity);

        await Promise.all([
            this.tweenNode(target, duration, closeTarget.position, closeTarget.scale, 'quadIn'),
            this.tweenOpacity(opacity, duration, closeTarget.opacity, 'quadIn'),
        ]);
    }

    private resolveAnimationConfig(): Required<Pick<HUIAnimationConfig, 'open' | 'close'>> & HUIAnimationConfig {
        const raw = this.config?.animation;
        const defaultAnimation = this.getDefaultAnimationType();
        if (!raw) {
            return {
                open: defaultAnimation,
                close: defaultAnimation,
            };
        }

        if (typeof raw === 'string') {
            return {
                open: raw,
                close: raw,
            };
        }

        return {
            ...raw,
            open: raw.open || defaultAnimation,
            close: raw.close || raw.open || defaultAnimation,
        };
    }

    private getDefaultAnimationType(): HUIAnimationType {
        switch (this.config?.type) {
            case 'dialog':
            case 'reward':
                return 'fade-scale';
            case 'page':
            case 'tip':
            case 'loading':
            case 'guide':
            case 'error':
                return 'fade';
            default:
                return 'none';
        }
    }

    private getDefaultAnimationDuration(): number {
        switch (this.config?.type) {
            case 'dialog':
            case 'reward':
                return 0.18;
            case 'page':
                return 0.14;
            default:
                return 0.12;
        }
    }

    private prepareOpenAnimation(node: Node, opacity: UIOpacity, animation: HUIAnimationType, distance: number): void {
        this.captureBaseTransform();
        opacity.opacity = this.animationUsesFade(animation) ? 0 : this.baseOpacity;
        node.setPosition(this.getSlideStartPosition(animation, distance));
        if (animation === 'scale' || animation === 'fade-scale') {
            node.setScale(this.baseScale.x * 0.86, this.baseScale.y * 0.86, this.baseScale.z);
        } else {
            node.setScale(this.baseScale);
        }
    }

    private getCloseAnimationTarget(animation: HUIAnimationType, distance: number): { position: Vec3; scale: Vec3; opacity: number } {
        const scale = (animation === 'scale' || animation === 'fade-scale')
            ? new Vec3(this.baseScale.x * 0.88, this.baseScale.y * 0.88, this.baseScale.z)
            : this.baseScale.clone();

        return {
            position: this.getSlideEndPosition(animation, distance),
            scale,
            opacity: this.animationUsesFade(animation) ? 0 : this.baseOpacity,
        };
    }

    private getSlideStartPosition(animation: HUIAnimationType, distance: number): Vec3 {
        switch (animation) {
            case 'slide-up':
                return new Vec3(this.basePosition.x, this.basePosition.y - distance, this.basePosition.z);
            case 'slide-down':
                return new Vec3(this.basePosition.x, this.basePosition.y + distance, this.basePosition.z);
            case 'slide-left':
                return new Vec3(this.basePosition.x + distance, this.basePosition.y, this.basePosition.z);
            case 'slide-right':
                return new Vec3(this.basePosition.x - distance, this.basePosition.y, this.basePosition.z);
            default:
                return this.basePosition.clone();
        }
    }

    private getSlideEndPosition(animation: HUIAnimationType, distance: number): Vec3 {
        switch (animation) {
            case 'slide-up':
                return new Vec3(this.basePosition.x, this.basePosition.y + distance, this.basePosition.z);
            case 'slide-down':
                return new Vec3(this.basePosition.x, this.basePosition.y - distance, this.basePosition.z);
            case 'slide-left':
                return new Vec3(this.basePosition.x - distance, this.basePosition.y, this.basePosition.z);
            case 'slide-right':
                return new Vec3(this.basePosition.x + distance, this.basePosition.y, this.basePosition.z);
            default:
                return this.basePosition.clone();
        }
    }

    private animationUsesFade(animation: HUIAnimationType): boolean {
        return animation === 'fade'
            || animation === 'fade-scale'
            || animation === 'slide-up'
            || animation === 'slide-down'
            || animation === 'slide-left'
            || animation === 'slide-right';
    }

    // 记录预制体原始位置/缩放/透明度，动画结束后恢复，避免反复打开造成节点偏移。
    private captureBaseTransform(): void {
        if (this.capturedTransform) {
            return;
        }

        const target = this.getAnimationTargetNode();
        this.basePosition = target.position.clone();
        this.baseScale = target.scale.clone();
        this.baseOpacity = this.ensureOpacity(target).opacity;
        this.capturedTransform = true;
    }

    private restoreBaseTransform(): void {
        const target = this.getAnimationTargetNode();
        if (!isValid(target)) {
            return;
        }

        target.setPosition(this.basePosition);
        target.setScale(this.baseScale);
        this.ensureOpacity(target).opacity = this.baseOpacity;
    }

    private ensureOpacity(node: Node): UIOpacity {
        let opacity = node.getComponent(UIOpacity);
        if (!opacity) {
            opacity = node.addComponent(UIOpacity);
        }
        return opacity;
    }

    private stopAnimation(node: Node, opacity: UIOpacity): void {
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);
    }

    private tweenNode(node: Node, duration: number, position: Vec3, scale: Vec3, easing: string): Promise<void> {
        return new Promise((resolve) => {
            tween(node)
                .to(duration, { position, scale }, { easing })
                .call(resolve)
                .start();
        });
    }

    private tweenOpacity(opacity: UIOpacity, duration: number, targetOpacity: number, easing: string): Promise<void> {
        return new Promise((resolve) => {
            tween(opacity)
                .to(duration, { opacity: targetOpacity }, { easing })
                .call(resolve)
                .start();
        });
    }

    private findChildDeep(root: Node, name: string): Node | null {
        for (const child of root.children) {
            if (child.name === name) {
                return child;
            }

            const found = this.findChildDeep(child, name);
            if (found) {
                return found;
            }
        }

        return null;
    }
}
