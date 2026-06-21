import { _decorator, Color, EventTouch, Label, Node } from 'cc';
import { HPageView } from '../HPageView';
import type { HUIViewBindContext } from '../HUITypes';
import { HUITabRouter } from './HUITabRouter';
import type {
    HUITabBarOptions,
    HUITabChange,
    HUITabChangedHandler,
    HUITabConfig,
    HUITabId,
    HUITabSwitchReason,
    HUITabSwitchResult,
} from './HUITabTypes';

const { ccclass, property } = _decorator;

/**
 * Tab 节点运行时记录。
 *
 * 作用：把数字 tabId、普通节点、配置数据绑定在一起，方便点击时反查当前 Tab。
 */
interface HUITabNodeRecord {
    /** 类型：HUITabId(number)。作用：当前节点对应的 Tab id。 */
    tabId: HUITabId;

    /** 类型：Node。作用：底部 Tab 标签节点。 */
    node: Node;

    /** 类型：HUITabConfig。作用：当前 Tab 的配置副本。 */
    config: HUITabConfig;

    /** 类型：Node | null。作用：缓存未选中态节点，刷新时不重复查找。 */
    normalNode: Node | null;

    /** 类型：Node | null。作用：缓存选中态节点，刷新时不重复查找。 */
    selectedNode: Node | null;

    /** 类型：Node | null。作用：缓存红点节点，刷新时不重复查找。 */
    redDotNode: Node | null;

    /** 类型：Node | null。作用：缓存禁用态节点，刷新时不重复查找。 */
    disabledNode: Node | null;

    /** 类型：Label | null。作用：缓存标题文本组件，刷新时不重复查找。 */
    titleLabel: Label | null;
}

/**
 * 底部 TabBar 页面基类。
 *
 * 推荐用法：
 * 主界面脚本继承 HUITabBar，底部 tabHome/tabTask/tabShop 等标签节点不需要单独挂脚本。
 *
 * 生命周期：
 * onBind 阶段读取 getTabConfigs/getTabOptions 并绑定 Tab 节点点击事件。
 * onEnableView 阶段根据 autoSwitch 决定是否打开默认 Tab 页面。
 * onRemove 阶段清理 Tab 节点事件，避免 UI 销毁后残留监听。
 */
@ccclass('HUITabBar')
export class HUITabBar<TParams = any> extends HPageView<TParams> {
    @property({ type: Node, tooltip: '底部 Tab 容器。不填时使用当前 UI 根节点。' })
    public tabRoot: Node | null = null;

    @property({ type: [Node], tooltip: '底部 Tab 节点列表。不填时默认使用 tabRoot 的直接子节点。' })
    public tabNodes: Node[] = [];

    @property({ tooltip: '默认选中的数字 Tab id，例如 1。' })
    public defaultTabId = 1;

    @property({ tooltip: '点击切换间隔，单位毫秒，用于防止快速连点。' })
    public switchThrottleMs = 300;

    @property({ tooltip: '重复点击当前 Tab 时是否继续触发切换。' })
    public allowRepeatClick = false;

    @property({ tooltip: '没有手动拖入 tabNodes 时，是否自动使用 tabRoot 的直接子节点作为 Tab。' })
    public autoCollectNodes = true;

    @property({ tooltip: '选中态节点名，多个名字用英文逗号分隔。' })
    public selectedNodeNames = 'selected,select,on,checked';

    @property({ tooltip: '未选中态节点名，多个名字用英文逗号分隔。' })
    public normalNodeNames = 'normal,off,unchecked';

    @property({ tooltip: '红点节点名，多个名字用英文逗号分隔。' })
    public redDotNodeNames = 'redDot,reddot,RedDot';

    @property({ tooltip: '禁用态节点名，多个名字用英文逗号分隔。' })
    public disabledNodeNames = 'disabled,disable,Disabled,Disable';

    @property({ tooltip: '标题文本节点名，多个名字用英文逗号分隔。' })
    public titleNodeNames = 'label,title,text,Label,Title,Text';

    @property({ type: Color, tooltip: '未选中文字颜色。' })
    public normalTextColor = new Color(160, 168, 186, 255);

    @property({ type: Color, tooltip: '选中文字颜色。' })
    public selectedTextColor = new Color(255, 255, 255, 255);

    /** 类型：HUITabRouter。作用：负责 tabId -> pageId 的页面切换。 */
    private router: HUITabRouter = new HUITabRouter();

    /** 类型：HUITabId(number)。作用：当前选中的 Tab id；0 表示尚未选中。 */
    private activeTabId: HUITabId = 0;

    /** 类型：number。作用：记录上次点击时间戳，用于点击节流。 */
    private lastClickAt = 0;

    /** 类型：HUITabChangedHandler | null。作用：切换完成回调。 */
    private onChanged: HUITabChangedHandler | null = null;

    /** 类型：Map<HUITabId, HUITabConfig>。作用：保存 Tab 配置表。 */
    private readonly configs = new Map<HUITabId, HUITabConfig>();

    /** 类型：Map<HUITabId, HUITabNodeRecord>。作用：保存 Tab 节点运行时记录。 */
    private readonly records = new Map<HUITabId, HUITabNodeRecord>();

    /** 类型：Array<() => void>。作用：保存节点事件取消函数，remove 时统一清理。 */
    private readonly tabNodeUnlisteners: Array<() => void> = [];

    /** 类型：boolean。作用：标记 TabBar 是否已经初始化，避免重复绑定事件。 */
    private tabInitialized = false;

    /** 类型：boolean。作用：是否在 onEnableView 阶段自动打开默认 Tab。 */
    private autoSwitchOnEnable = false;

    /**
     * UI 绑定生命周期。
     *
     * @param context 类型 HUIViewBindContext<TParams>，作用是 HUIViewBase 注入的 UI 上下文。
     */
    protected async onBind(context: HUIViewBindContext<TParams>): Promise<void> {
        await super.onBind(context);

        const configs = this.getTabConfigs();
        if (configs.length > 0 && !this.tabInitialized) {
            this.init(configs, this.getTabOptions());
        }
    }

    /**
     * UI 移除生命周期。
     *
     * 作用：释放 Tab 节点点击事件，防止 UI 被销毁后继续响应点击。
     */
    protected async onRemove(): Promise<void> {
        this.clearTabNodeEvents();
        await super.onRemove();
    }

    /**
     * UI 启用生命周期。
     *
     * 作用：当 autoSwitch=true 且当前没有打开 Tab 时，自动打开默认 Tab 页面。
     */
    protected async onEnableView(): Promise<void> {
        await super.onEnableView();
        if (this.autoSwitchOnEnable && this.activeTabId <= 0) {
            await this.openDefault();
        }
    }

    /**
     * 初始化 TabBar。
     *
     * @param configs 类型 HUITabConfig[]，作用是声明 tabId、pageId、节点绑定、默认参数等配置。
     * @param options 类型 HUITabBarOptions，作用是声明默认 Tab、点击节流、是否自动打开默认页面等策略。
     */
    public init(configs: HUITabConfig[], options: HUITabBarOptions = {}): void {
        this.clearTabNodeEvents();
        this.configs.clear();
        this.records.clear();
        configs.forEach((config) => this.configs.set(config.id, { ...config }));

        this.defaultTabId = options.defaultTabId || this.findDefaultTabId(configs) || this.defaultTabId;
        this.switchThrottleMs = options.switchThrottleMs ?? this.switchThrottleMs;
        this.allowRepeatClick = options.allowRepeatClick ?? this.allowRepeatClick;
        this.autoCollectNodes = options.autoCollectNodes ?? this.autoCollectNodes;
        this.onChanged = options.onChanged || null;
        this.autoSwitchOnEnable = !!options.autoSwitch;

        this.router = new HUITabRouter({
            ...options,
            ui: options.ui || this.manager,
            eventBus: options.eventBus || this.eventBus,
            defaultTabId: this.defaultTabId,
            onChanged: (change) => this.handleRouterChanged(change),
        });
        this.router.registerTabs(configs);

        this.bindTabNodes(configs);
        this.refreshSelected(this.activeTabId || this.defaultTabId);

        this.tabInitialized = true;
    }

    /**
     * 替换内部路由器。
     *
     * @param router 类型 HUITabRouter，作用是注入自定义路由器实例。
     */
    public setRouter(router: HUITabRouter): void {
        this.router = router;
    }

    /**
     * 获取内部路由器。
     *
     * @returns 类型 HUITabRouter。
     */
    public getRouter(): HUITabRouter {
        return this.router;
    }

    /**
     * 获取当前选中的 Tab id。
     *
     * @returns 类型 HUITabId(number)，0 表示尚未选中。
     */
    public getActiveTabId(): HUITabId {
        return this.activeTabId;
    }

    /**
     * 打开默认 Tab 页面。
     *
     * @param params 类型 any，作用是传给默认页面的打开参数。
     * @returns 类型 Promise<HUITabSwitchResult>，表示切换结果。
     */
    public openDefault(params?: any): Promise<HUITabSwitchResult> {
        return this.switchTo(this.defaultTabId, params, 'init', true);
    }

    /**
     * 切换到指定 Tab。
     *
     * @param tabId 类型 HUITabId(number)，作用是目标 Tab id，例如 2 表示任务页。
     * @param params 类型 any，作用是传给目标页面的打开参数。
     * @param reason 类型 HUITabSwitchReason，作用是记录切换来源，默认 api。
     * @param force 类型 boolean，作用是是否强制切换，true 时允许重复切换到当前 Tab。
     * @returns 类型 Promise<HUITabSwitchResult>，表示切换结果。
     */
    public async switchTo(
        tabId: HUITabId,
        params?: any,
        reason: HUITabSwitchReason = 'api',
        force = false,
    ): Promise<HUITabSwitchResult> {
        const result = await this.router.switchTo(tabId, params, reason, force);
        if (result.changed || force) {
            this.activeTabId = result.currentId;
            this.refreshSelected(result.currentId);
        }
        return result;
    }

    /**
     * 只刷新底部 Tab 选中态。
     *
     * @param tabId 类型 HUITabId(number)，作用是要显示为选中的 Tab id。
     */
    public setSelected(tabId: HUITabId): void {
        this.activeTabId = tabId;
        this.refreshSelected(tabId);
    }

    /**
     * 设置 Tab 禁用态。
     *
     * @param tabId 类型 HUITabId(number)，作用是目标 Tab id。
     * @param disabled 类型 boolean，true 表示禁用，false 表示启用。
     */
    public setDisabled(tabId: HUITabId, disabled: boolean): void {
        this.router.setDisabled(tabId, disabled);
        const config = this.configs.get(tabId);
        if (config) {
            config.disabled = disabled;
        }

        const record = this.records.get(tabId);
        if (record) {
            record.config.disabled = disabled;
            this.refreshDisabled(record);
        }
    }

    /**
     * 设置 Tab 红点显示状态。
     *
     * @param tabId 类型 HUITabId(number)，作用是目标 Tab id。
     * @param visible 类型 boolean，true 表示显示红点，false 表示隐藏红点。
     */
    public setRedDotVisible(tabId: HUITabId, visible: boolean): void {
        const record = this.records.get(tabId);
        if (record?.redDotNode) {
            record.redDotNode.active = visible;
        }
    }

    /**
     * 子类声明 Tab 配置。
     *
     * @returns 类型 HUITabConfig[]，默认返回空数组。主界面子类应重写这个方法。
     */
    protected getTabConfigs(): HUITabConfig[] {
        return [];
    }

    /**
     * 子类声明 TabBar 初始化选项。
     *
     * @returns 类型 HUITabBarOptions，默认返回空对象。主界面子类可重写这个方法。
     */
    protected getTabOptions(): HUITabBarOptions {
        return {};
    }

    /**
     * 绑定所有 Tab 节点。
     *
     * @param configs 类型 HUITabConfig[]，作用是提供 Tab 配置和节点绑定关系。
     */
    private bindTabNodes(configs: HUITabConfig[]): void {
        const sortedConfigs = configs
            .filter((config) => config && config.id > 0)
            .sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id));
        const nodes = this.resolveTabNodes(sortedConfigs);

        sortedConfigs.forEach((config, index) => {
            const node = this.resolveNode(config, nodes[index]);
            if (!node) {
                console.warn(`[HUITabBar] tabId=${config.id} 没有找到对应 Tab 节点`);
                return;
            }

            const record: HUITabNodeRecord = {
                tabId: config.id,
                node,
                config: { ...config },
                normalNode: this.findStateNode(node, this.normalNodeNames),
                selectedNode: this.findStateNode(node, this.selectedNodeNames),
                redDotNode: this.findStateNode(node, this.redDotNodeNames),
                disabledNode: this.findStateNode(node, this.disabledNodeNames),
                titleLabel: this.findLabel(node),
            };
            this.records.set(config.id, record);
            this.applyConfigToNode(record);
            this.tabNodeUnlisteners.push(
                this.listenNode(node, Node.EventType.TOUCH_END, this.onTabNodeTouchEnd, this, { clearOn: 'remove' }),
            );
        });
    }

    /**
     * 清理 Tab 节点事件。
     *
     * 作用：执行 listenNode 返回的取消函数，释放节点事件监听。
     */
    private clearTabNodeEvents(): void {
        while (this.tabNodeUnlisteners.length > 0) {
            const unlisten = this.tabNodeUnlisteners.pop();
            try {
                unlisten?.();
            } catch (error) {
                console.warn('[HUITabBar] tab 节点事件注销失败', error);
            }
        }
    }

    /**
     * Tab 节点点击回调。
     *
     * @param event 类型 EventTouch | undefined，作用是 Cocos 触摸事件对象。
     */
    private onTabNodeTouchEnd(event?: EventTouch): void {
        const target = event?.currentTarget as Node | undefined;
        const record = target ? this.findRecordByNode(target) : null;
        if (!record || record.config.disabled || record.tabId <= 0) {
            return;
        }

        event?.stopPropagation();
        this.handleTabClick(record.tabId);
    }

    /**
     * 处理 Tab 点击逻辑。
     *
     * @param tabId 类型 HUITabId(number)，作用是被点击的 Tab id。
     */
    private handleTabClick(tabId: HUITabId): void {
        const now = Date.now();
        if (now - this.lastClickAt < this.switchThrottleMs) {
            return;
        }
        if (!this.allowRepeatClick && this.activeTabId === tabId) {
            return;
        }

        this.lastClickAt = now;
        void this.switchTo(tabId, undefined, 'click').catch((error) => {
            console.warn(`[HUITabBar] tabId=${tabId} 切换失败`, error);
        });
    }

    /**
     * Router 切换完成回调。
     *
     * @param change 类型 HUITabChange，作用是本次切换的变化信息。
     */
    private handleRouterChanged(change: HUITabChange): void {
        this.activeTabId = change.currentId;
        this.refreshSelected(change.currentId);
        this.onChanged?.(change);
    }

    /**
     * 刷新所有 Tab 节点的选中态。
     *
     * @param tabId 类型 HUITabId(number)，作用是当前应该显示为选中的 Tab id。
     */
    private refreshSelected(tabId: HUITabId): void {
        this.records.forEach((record) => {
            const selected = record.tabId === tabId;
            if (record.normalNode) {
                record.normalNode.active = !selected;
            }
            if (record.selectedNode) {
                record.selectedNode.active = selected;
            }

            if (record.titleLabel) {
                record.titleLabel.color = selected ? this.selectedTextColor : this.normalTextColor;
            }

            this.refreshDisabled(record);
        });
    }

    /**
     * 把配置应用到 Tab 节点。
     *
     * @param record 类型 HUITabNodeRecord，作用是当前 Tab 的节点运行时记录。
     */
    private applyConfigToNode(record: HUITabNodeRecord): void {
        record.node.active = record.config.visible !== false;
        if (record.titleLabel && record.config.title) {
            record.titleLabel.string = record.config.title;
        }

        this.refreshDisabled(record);
    }

    /**
     * 刷新禁用态节点。
     *
     * @param record 类型 HUITabNodeRecord，作用是当前 Tab 的节点运行时记录。
     */
    private refreshDisabled(record: HUITabNodeRecord): void {
        if (record.disabledNode) {
            record.disabledNode.active = !!record.config.disabled;
        }
    }

    /**
     * 解析可用的 Tab 节点列表。
     *
     * @param _configs 类型 HUITabConfig[]，作用是保留参数位，便于后续按配置扩展节点收集策略。
     * @returns 类型 Node[]，返回待绑定的 Tab 节点列表。
     */
    private resolveTabNodes(_configs: HUITabConfig[]): Node[] {
        if (this.tabNodes.length > 0) {
            return this.tabNodes.filter((node) => !!node);
        }
        if (!this.autoCollectNodes) {
            return [];
        }

        this.tabNodes = this.getTabRootNode().children.slice();
        return this.tabNodes;
    }

    /**
     * 解析单个配置对应的 Tab 节点。
     *
     * @param config 类型 HUITabConfig，作用是当前 Tab 配置。
     * @param fallback 类型 Node | undefined，作用是按顺序绑定时的备用节点。
     * @returns 类型 Node | null，找不到节点时返回 null。
     */
    private resolveNode(config: HUITabConfig, fallback: Node | undefined): Node | null {
        return config.node
            || (config.nodeName ? this.findChildDeep(this.getTabRootNode(), config.nodeName) : null)
            || fallback
            || null;
    }

    /**
     * 获取 Tab 根节点。
     *
     * @returns 类型 Node，优先返回 tabRoot，没有配置时返回当前 UI 根节点。
     */
    private getTabRootNode(): Node {
        return this.tabRoot || this.node;
    }

    /**
     * 根据节点反查 Tab 记录。
     *
     * @param node 类型 Node，作用是被点击的 Tab 节点。
     * @returns 类型 HUITabNodeRecord | null，找不到时返回 null。
     */
    private findRecordByNode(node: Node): HUITabNodeRecord | null {
        for (const record of this.records.values()) {
            if (record.node === node) {
                return record;
            }
        }

        return null;
    }

    /**
     * 查找状态节点。
     *
     * @param root 类型 Node，作用是查找起点，通常是单个 Tab 节点。
     * @param names 类型 string，作用是逗号分隔的候选节点名。
     * @returns 类型 Node | null，找不到时返回 null。
     */
    private findStateNode(root: Node, names: string): Node | null {
        for (const name of this.parseNames(names)) {
            const found = this.findChildDeep(root, name);
            if (found) {
                return found;
            }
        }

        return null;
    }

    /**
     * 查找标题文本组件。
     *
     * @param root 类型 Node，作用是查找起点，通常是单个 Tab 节点。
     * @returns 类型 Label | null，找不到时返回 null。
     */
    private findLabel(root: Node): Label | null {
        for (const name of this.parseNames(this.titleNodeNames)) {
            const labelNode = this.findChildDeep(root, name);
            const label = labelNode?.getComponent(Label);
            if (label) {
                return label;
            }
        }

        return this.findLabelDeep(root);
    }

    /**
     * 递归查找指定名称的子节点。
     *
     * @param root 类型 Node，作用是查找起点。
     * @param name 类型 string，作用是目标节点名。
     * @returns 类型 Node | null，找不到时返回 null。
     */
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

    /**
     * 递归查找 Label 组件。
     *
     * @param root 类型 Node，作用是查找起点。
     * @returns 类型 Label | null，找不到时返回 null。
     */
    private findLabelDeep(root: Node): Label | null {
        const label = root.getComponent(Label);
        if (label) {
            return label;
        }

        for (const child of root.children) {
            const found = this.findLabelDeep(child);
            if (found) {
                return found;
            }
        }

        return null;
    }

    /**
     * 解析逗号分隔的节点名配置。
     *
     * @param names 类型 string，作用是逗号分隔的节点名列表。
     * @returns 类型 string[]，返回去掉空白后的节点名数组。
     */
    private parseNames(names: string): string[] {
        return String(names || '')
            .split(',')
            .map((name) => name.trim())
            .filter((name) => !!name);
    }

    /**
     * 查找默认 Tab id。
     *
     * @param configs 类型 HUITabConfig[]，作用是候选 Tab 配置列表。
     * @returns 类型 HUITabId(number)，没有配置时返回 0。
     */
    private findDefaultTabId(configs: HUITabConfig[]): HUITabId {
        return configs.find((config) => config.default)?.id
            || configs.sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id))[0]?.id
            || 0;
    }
}
