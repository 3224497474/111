import type { Node } from 'cc';
import type { HEventBus } from '../../core/HEventBus';
import type { HUIFacade } from '../HUIFacade';
import type { HUICloseReason } from '../HUITypes';
import type {
    HUITabChange,
    HUITabChangedHandler,
    HUITabConfig,
    HUITabId,
    HUITabRouterOptions,
    HUITabSwitchReason,
    HUITabSwitchResult,
} from './HUITabTypes';

/**
 * Tab 页面路由器。
 *
 * 职责：
 * 1. 根据数字 tabId 找到对应 pageId。
 * 2. 通过 H.ui.open / H.ui.close 完成页面切换。
 * 3. 切换成功后通知 HUITabBar 刷新选中态，并通过 H.event 派发 Tab 切换事件。
 *
 * 注意：
 * HUITabRouter 不负责底部标签节点表现，normal/selected/redDot/disabled 这些节点状态由 HUITabBar 管理。
 */
export class HUITabRouter {
    /** UI 门面。类型：HUIFacade | null。作用：打开和关闭 Tab 对应页面。 */
    private ui: HUIFacade | null = null;

    /** 事件总线。类型：HEventBus | null。作用：派发 ui:tab_changed。 */
    private eventBus: HEventBus | null = null;

    /** 当前打开的 Tab id。类型：HUITabId(number)。0 表示当前没有打开 Tab。 */
    private activeTabId: HUITabId = 0;

    /** 默认 Tab id。类型：HUITabId(number)。 */
    private defaultTabId: HUITabId = 0;

    /** 切换时是否关闭上一个页面。类型：boolean。 */
    private closePrevious = true;

    /** 关闭上一个页面时使用的关闭原因。类型：HUICloseReason。 */
    private previousCloseReason: HUICloseReason = 'api';

    /** 是否允许重复切换到当前 Tab。类型：boolean。 */
    private allowRepeatSwitch = false;

    /** 切换队列。类型：Promise<void>。作用：避免 open/close 快速交叉导致 UI 状态错乱。 */
    private operation: Promise<void> = Promise.resolve();

    /** 切换前拦截函数。类型：HUITabRouterOptions['beforeSwitch']。 */
    private beforeSwitch: HUITabRouterOptions['beforeSwitch'];

    /** 单个切换完成回调。类型：HUITabChangedHandler | null。 */
    private onChanged: HUITabChangedHandler | null = null;

    /** Tab 配置表。类型：Map<HUITabId, HUITabConfig>。 */
    private readonly configs = new Map<HUITabId, HUITabConfig>();

    /** 额外监听者列表。类型：Set<HUITabChangedHandler>。 */
    private readonly listeners = new Set<HUITabChangedHandler>();

    /**
     * 构造函数。
     *
     * @param options 类型 HUITabRouterOptions，作用是初始化 UI 门面、事件总线、默认 Tab、切换策略等。
     */
    public constructor(options: HUITabRouterOptions = {}) {
        this.applyOptions(options);
    }

    /**
     * 初始化路由器。
     *
     * @param configs 类型 HUITabConfig[]，作用是注册 tabId 与 pageId 的映射关系。
     * @param options 类型 HUITabRouterOptions，作用是覆盖路由器切换策略。
     */
    public init(configs: HUITabConfig[], options: HUITabRouterOptions = {}): void {
        this.applyOptions(options);
        this.registerTabs(configs);
        this.defaultTabId = options.defaultTabId || this.findDefaultTabId();
    }

    /**
     * 注入 UI 门面。
     *
     * @param ui 类型 HUIFacade | null，作用是提供 H.ui.open/H.ui.close 能力。
     */
    public setUI(ui: HUIFacade | null): void {
        this.ui = ui;
    }

    /**
     * 注入事件总线。
     *
     * @param eventBus 类型 HEventBus | null，作用是派发 Tab 切换事件。
     */
    public setEventBus(eventBus: HEventBus | null): void {
        this.eventBus = eventBus;
    }

    /**
     * 注册 Tab 配置。
     *
     * @param configs 类型 HUITabConfig[]，作用是批量注册 tabId/pageId 映射。
     */
    public registerTabs(configs: HUITabConfig[]): void {
        configs
            .filter((config) => config && config.id > 0)
            .sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id))
            .forEach((config) => this.configs.set(config.id, { ...config }));

        if (!this.defaultTabId) {
            this.defaultTabId = this.findDefaultTabId();
        }
    }

    /**
     * 获取当前打开的 Tab id。
     *
     * @returns 类型 HUITabId(number)，0 表示当前没有打开 Tab。
     */
    public getActiveTabId(): HUITabId {
        return this.activeTabId;
    }

    /**
     * 获取默认 Tab id。
     *
     * @returns 类型 HUITabId(number)。
     */
    public getDefaultTabId(): HUITabId {
        return this.defaultTabId;
    }

    /**
     * 获取单个 Tab 配置。
     *
     * @param tabId 类型 HUITabId(number)，作用是指定要查询的 Tab。
     * @returns 类型 HUITabConfig | null，找不到时返回 null。
     */
    public getConfig(tabId: HUITabId): HUITabConfig | null {
        const config = this.configs.get(tabId);
        return config ? { ...config } : null;
    }

    /**
     * 获取全部 Tab 配置。
     *
     * @returns 类型 HUITabConfig[]，返回配置副本，避免外部直接修改内部状态。
     */
    public getConfigs(): HUITabConfig[] {
        return [...this.configs.values()].map((config) => ({ ...config }));
    }

    /**
     * 设置 Tab 禁用态。
     *
     * @param tabId 类型 HUITabId(number)，作用是指定要禁用或启用的 Tab。
     * @param disabled 类型 boolean，true 表示禁用，false 表示启用。
     */
    public setDisabled(tabId: HUITabId, disabled: boolean): void {
        const config = this.configs.get(tabId);
        if (config) {
            config.disabled = disabled;
        }
    }

    /**
     * 监听 Tab 切换完成。
     *
     * @param listener 类型 HUITabChangedHandler，作用是接收切换完成信息。
     * @returns 类型 () => void，调用后取消监听。
     */
    public onChangedEvent(listener: HUITabChangedHandler): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * 打开默认 Tab。
     *
     * @param params 类型 any，作用是打开默认页面时传入页面的参数。
     * @returns 类型 Promise<HUITabSwitchResult>，表示切换结果。
     */
    public openDefault(params?: any): Promise<HUITabSwitchResult> {
        return this.switchTo(this.defaultTabId || this.findDefaultTabId(), params, 'init', true);
    }

    /**
     * 切换到指定 Tab。
     *
     * @param tabId 类型 HUITabId(number)，作用是目标 Tab id，例如 2 表示任务页。
     * @param params 类型 any，作用是打开目标页面时传入的参数。
     * @param reason 类型 HUITabSwitchReason，作用是记录切换来源，默认 api。
     * @param force 类型 boolean，作用是是否强制切换，true 时允许重复切换到当前 Tab。
     * @returns 类型 Promise<HUITabSwitchResult>，表示切换结果。
     */
    public switchTo(
        tabId: HUITabId,
        params?: any,
        reason: HUITabSwitchReason = 'api',
        force = false,
    ): Promise<HUITabSwitchResult> {
        const task = this.operation.then(() => this.switchImmediately(tabId, params, reason, force));
        this.operation = task.then(() => undefined, () => undefined);
        return task;
    }

    /**
     * 关闭当前 Tab 页面。
     *
     * @param reason 类型 HUICloseReason，作用是关闭当前页面时传入的关闭原因。
     */
    public async closeCurrent(reason: HUICloseReason = 'api'): Promise<void> {
        const config = this.configs.get(this.activeTabId);
        if (!config || !this.ui) {
            return;
        }

        await this.ui.close(config.pageId, false, reason);
        this.activeTabId = 0;
    }

    /**
     * 应用初始化参数。
     *
     * @param options 类型 HUITabRouterOptions，作用是覆盖路由器内部策略。
     */
    private applyOptions(options: HUITabRouterOptions): void {
        if (options.ui !== undefined) {
            this.ui = options.ui;
        }
        if (options.eventBus !== undefined) {
            this.eventBus = options.eventBus;
        }
        if (options.defaultTabId !== undefined) {
            this.defaultTabId = options.defaultTabId;
        }
        if (options.closePrevious !== undefined) {
            this.closePrevious = options.closePrevious;
        }
        if (options.previousCloseReason !== undefined) {
            this.previousCloseReason = options.previousCloseReason;
        }
        if (options.allowRepeatSwitch !== undefined) {
            this.allowRepeatSwitch = options.allowRepeatSwitch;
        }
        if (options.beforeSwitch !== undefined) {
            this.beforeSwitch = options.beforeSwitch;
        }
        if (options.onChanged !== undefined) {
            this.onChanged = options.onChanged;
        }
    }

    /**
     * 立即执行一次 Tab 切换。
     *
     * @param tabId 类型 HUITabId(number)，作用是目标 Tab id。
     * @param params 类型 any，作用是打开目标页面时传入的参数。
     * @param reason 类型 HUITabSwitchReason，作用是记录切换来源。
     * @param force 类型 boolean，作用是是否强制切换。
     * @returns 类型 Promise<HUITabSwitchResult>，表示切换结果。
     */
    private async switchImmediately(
        tabId: HUITabId,
        params: any,
        reason: HUITabSwitchReason,
        force: boolean,
    ): Promise<HUITabSwitchResult> {
        const currentConfig = this.configs.get(tabId);
        if (!currentConfig) {
            throw new Error(`[HUITabRouter] tabId=${tabId} 未注册`);
        }
        if (currentConfig.disabled) {
            return this.createResult(false, tabId, reason, null);
        }
        if (!this.ui) {
            throw new Error('[HUITabRouter] 缺少 HUIFacade，请在 init 时传入 ui');
        }

        const previousId = this.activeTabId;
        const previousConfig = this.configs.get(previousId) || null;
        if (!force && !this.allowRepeatSwitch && previousId === tabId) {
            return this.createResult(false, tabId, reason, this.ui.get(currentConfig.pageId));
        }

        const canSwitch = await this.canSwitch(currentConfig, previousConfig, reason);
        if (!canSwitch) {
            return this.createResult(false, tabId, reason, this.ui.get(currentConfig.pageId));
        }

        if (previousConfig && this.closePrevious && previousConfig.pageId !== currentConfig.pageId) {
            await this.ui.close(previousConfig.pageId, false, this.previousCloseReason);
        }

        const pageNode = await this.ui.open({
            ...(currentConfig.openOptions || {}),
            id: currentConfig.pageId,
            type: 'page',
            params: params !== undefined ? params : currentConfig.params,
        });
        this.activeTabId = tabId;

        const result = this.createResult(true, tabId, reason, pageNode, previousId, previousConfig);
        this.emitChanged(result);
        return result;
    }

    /**
     * 执行切换前拦截。
     *
     * @param next 类型 HUITabConfig，作用是目标 Tab 配置。
     * @param previous 类型 HUITabConfig | null，作用是当前 Tab 配置。
     * @param reason 类型 HUITabSwitchReason，作用是切换来源。
     * @returns 类型 Promise<boolean>，false 表示阻止切换。
     */
    private async canSwitch(
        next: HUITabConfig,
        previous: HUITabConfig | null,
        reason: HUITabSwitchReason,
    ): Promise<boolean> {
        if (!this.beforeSwitch) {
            return true;
        }

        return this.beforeSwitch(next, previous, reason);
    }

    /**
     * 创建切换结果对象。
     *
     * @param changed 类型 boolean，作用是标记是否真的发生切换。
     * @param currentId 类型 HUITabId(number)，作用是当前 Tab id。
     * @param reason 类型 HUITabSwitchReason，作用是切换来源。
     * @param pageNode 类型 Node | null，作用是打开后的页面节点。
     * @param previousId 类型 HUITabId(number)，作用是上一个 Tab id。
     * @param previousConfig 类型 HUITabConfig | null，作用是上一个 Tab 配置。
     * @returns 类型 HUITabSwitchResult。
     */
    private createResult(
        changed: boolean,
        currentId: HUITabId,
        reason: HUITabSwitchReason,
        pageNode: Node | null,
        previousId = this.activeTabId,
        previousConfig: HUITabConfig | null = this.configs.get(this.activeTabId) || null,
    ): HUITabSwitchResult {
        const currentConfig = this.configs.get(currentId);
        if (!currentConfig) {
            throw new Error(`[HUITabRouter] tabId=${currentId} 未注册`);
        }

        return {
            changed,
            previousId,
            currentId,
            previousConfig,
            currentConfig: { ...currentConfig },
            reason,
            pageNode,
        };
    }

    /**
     * 派发 Tab 切换完成通知。
     *
     * @param change 类型 HUITabChange，作用是本次切换变化信息。
     */
    private emitChanged(change: HUITabChange): void {
        this.onChanged?.(change);
        this.listeners.forEach((listener) => {
            try {
                listener(change);
            } catch (error) {
                console.warn('[HUITabRouter] tab changed listener 执行失败', error);
            }
        });

        this.eventBus?.emitUITabChanged(
            change.currentId,
            change.previousId,
            String(change.currentConfig.pageId),
            change.reason,
        );
    }

    /**
     * 查找默认 Tab id。
     *
     * @returns 类型 HUITabId(number)，没有配置时返回 0。
     */
    private findDefaultTabId(): HUITabId {
        const configs = [...this.configs.values()];
        return configs.find((config) => config.default)?.id
            || configs.sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id))[0]?.id
            || 0;
    }
}
