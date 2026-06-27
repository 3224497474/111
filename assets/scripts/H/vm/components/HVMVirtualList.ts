import {
    _decorator,
    Component,
    Enum,
    instantiate,
    Node,
    Prefab,
    ScrollView,
    Size,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';
import { HVMBase } from './HVMBase';
import {
    HVirtualGridLayout,
    HVirtualListDirection,
} from '../layout';
import type { HVirtualVisibleRange } from '../layout';
import type { HVMVirtualListItemRenderer } from './HVMVirtualListItem';

const { ccclass, property } = _decorator;

Enum(HVirtualListDirection);

type LegacyListItemRenderer<TItem = unknown> = {
    onVMListItemRefresh?: (data: TItem, index: number, list: HVMVirtualList<TItem>) => void;
};

/**
 * HVMVirtualList 把 VM 数组字段渲染成虚拟滚动列表。
 *
 * 设计说明：
 * - 继承 HVMBase<TItem[]>，只监听一个 VM 数组字段。
 * - 只创建可见范围 + bufferLine 的 item 节点。
 * - 布局计算委托给 HVirtualGridLayout，组件只负责 ScrollView、节点池和 item 刷新。
 * - content、item 坐标运算统一以左上角为参考原点。
 * - content 锚点不在代码中处理，请在编辑器里按滚动方向设置。
 */
@ccclass('HVMVirtualList')
export class HVMVirtualList<TItem = unknown> extends HVMBase<TItem[]> {
    @property({ type: ScrollView, tooltip: '目标 ScrollView。不填时默认取当前节点上的 ScrollView。' })
    public scrollView: ScrollView | null = null;

    @property({ type: Node, tooltip: '内容容器。通常是 ScrollView/view/content。不填时默认取 scrollView.content。' })
    public content: Node | null = null;

    @property({ type: Prefab, tooltip: '列表项预制体。为空时会尝试使用 templateNode 克隆。' })
    public itemPrefab: Prefab | null = null;

    @property({ type: Node, tooltip: '列表项模板节点。没有 itemPrefab 时克隆它；运行时会自动隐藏。' })
    public templateNode: Node | null = null;

    @property({ type: HVirtualListDirection, tooltip: '滚动方向。Vertical 表示竖向，Horizontal 表示横向。' })
    public direction: HVirtualListDirection = HVirtualListDirection.Vertical;

    @property({ tooltip: 'item 宽度。固定尺寸虚拟列表必须填写。' })
    public itemWidth = 100;

    @property({ tooltip: 'item 高度。固定尺寸虚拟列表必须填写。' })
    public itemHeight = 100;

    @property({ tooltip: '横向间距。' })
    public spacingX = 0;

    @property({ tooltip: '纵向间距。' })
    public spacingY = 0;

    @property({ tooltip: '左边距。' })
    public paddingLeft = 0;

    @property({ tooltip: '右边距。' })
    public paddingRight = 0;

    @property({ tooltip: '上边距。' })
    public paddingTop = 0;

    @property({ tooltip: '下边距。' })
    public paddingBottom = 0;

    @property({ tooltip: '竖向列表表示列数，横向列表表示行数。' })
    public crossCount = 1;

    @property({ tooltip: '可见区域外额外渲染的行数/列数，减少快速滚动露白。' })
    public bufferLine = 1;

    @property({ tooltip: '数据变化时是否保持当前滚动位置。关闭后会回到顶部/左侧。' })
    public keepScrollOffsetOnDataChange = true;

    @property({ tooltip: '数据为空时是否隐藏 content。' })
    public hideContentWhenEmpty = false;

    @property({ tooltip: '回收 item 时是否放入节点池。关闭后会 destroy。' })
    public recycleInactiveItems = true;

    @property({ tooltip: '滚动中是否延迟到 lateUpdate 刷新，避免同一帧多次 ScrollView 事件重复刷新。' })
    public useLateUpdateRefresh = true;

    @property({ tooltip: '是否输出调试日志。' })
    public debug = false;

    private readonly layout = new HVirtualGridLayout();
    private readonly activeItems = new Map<number, Node>();
    private readonly itemPool: Node[] = [];
    private readonly rendererCache = new WeakMap<Node, HVMVirtualListItemRenderer<TItem> | null>();
    private readonly legacyRendererCache = new WeakMap<Node, LegacyListItemRenderer<TItem> | null>();

    private dataList: TItem[] = [];
    private viewSize = new Size();
    private lastRange: HVirtualVisibleRange = { start: -1, end: -1 };
    private pendingRefresh = false;
    private destroyed = false;

    protected onLoad(): void {
        this.tryAutoFindReferences();
        this.hideTemplateNode();
        this.setupLayout();
        this.refreshViewSize();
        this.bindScrollEvents();
    }

    protected onEnable(): void {
        super.onEnable();
        this.markRefreshVisible(true);
    }

    protected onDisable(): void {
        super.onDisable();
        this.pendingRefresh = false;
    }

    protected onDestroy(): void {
        this.destroyed = true;
        this.unbindScrollEvents();
        super.onDestroy();
        this.clearList(true);
    }

    protected lateUpdate(): void {
        if (!this.pendingRefresh || !this.useLateUpdateRefresh) {
            return;
        }
        this.pendingRefresh = false;
        this.refreshVisibleItems(false);
    }

    protected getDefaultValue(): TItem[] {
        return [];
    }

    /**
     * VM 数组变化时刷新列表。
     */
    protected refreshValue(value: TItem[]): void {
        this.setData(Array.isArray(value) ? value : [], !this.keepScrollOffsetOnDataChange);
    }

    /**
     * 手动设置数据。不经过 VM，适合 Demo 或临时列表。
     */
    public setData(dataList: TItem[], resetScroll = false): void {
        if (this.destroyed) {
            return;
        }

        this.dataList = Array.isArray(dataList) ? dataList : [];
        this.layout.setDataCount(this.dataList.length);
        this.refreshContentSize();

        if (resetScroll) {
            this.scrollToStart(0);
        }

        const content = this.getContentNode();
        if (content && this.hideContentWhenEmpty) {
            content.active = this.dataList.length > 0;
        }

        this.lastRange = { start: -1, end: -1 };
        this.markRefreshVisible(true);
    }

    /**
     * 手动刷新全部可见 item。
     */
    public refreshVisible(): void {
        this.activeItems.forEach((node, index) => this.refreshItemNode(node, index));
    }

    /**
     * 手动刷新指定 index。如果该 index 当前不可见，则不会创建节点。 */
    public refreshIndex(index: number): void {
        const node = this.activeItems.get(index);
        if (!node) {
            return;
        }
        this.refreshItemNode(node, index);
    }

    /**
     * 清理列表节点。
     *
     * @param destroyPool true 表示销毁节点池，false 表示保留节点池。
     */
    public clearList(destroyPool = false): void {
        this.activeItems.forEach((node) => this.recycleItem(node));
        this.activeItems.clear();
        this.lastRange = { start: -1, end: -1 };
        this.dataList = [];
        this.layout.setDataCount(0);

        if (destroyPool) {
            this.itemPool.forEach((node) => node.destroy());
            this.itemPool.length = 0;
        }
    }

    public getDataList(): readonly TItem[] {
        return this.dataList;
    }

    public getItemData(index: number): TItem | undefined {
        return this.dataList[index];
    }

    public getItemNode(index: number): Node | null {
        return this.activeItems.get(index) || null;
    }

    public getActiveItemCount(): number {
        return this.activeItems.size;
    }

    public getPooledItemCount(): number {
        return this.itemPool.length;
    }

    public getVisibleRange(): HVirtualVisibleRange {
        return { ...this.lastRange };
    }

    /**
     * 滚动到顶部或左侧。
     */
    public scrollToStart(timeInSecond = 0): void {
        if (!this.scrollView) {
            return;
        }

        if (this.direction === HVirtualListDirection.Vertical) {
            this.scrollView.scrollToTop(timeInSecond);
        } else {
            this.scrollView.scrollToLeft(timeInSecond);
        }
    }

    /**
     * 滚动到底部或右侧。
     */
    public scrollToEnd(timeInSecond = 0): void {
        if (!this.scrollView) {
            return;
        }

        if (this.direction === HVirtualListDirection.Vertical) {
            this.scrollView.scrollToBottom(timeInSecond);
        } else {
            this.scrollView.scrollToRight(timeInSecond);
        }
    }

    /**
     * 滚动到指定 index 所在位置。
     */
    public scrollToIndex(index: number, timeInSecond = 0): void {
        if (!this.scrollView || !this.content || this.dataList.length <= 0) {
            return;
        }

        const safeIndex = Math.max(0, Math.min(this.dataList.length - 1, Math.floor(index)));
        const rect = this.layout.getItemRect(safeIndex);
        const contentSize = this.getContentSize();

        const maxX = Math.max(0, contentSize.width - this.viewSize.width);
        const maxY = Math.max(0, contentSize.height - this.viewSize.height);
        const offset = new Vec2(
            Math.max(0, Math.min(maxX, rect.x - this.paddingLeft)),
            Math.max(0, Math.min(maxY, rect.y - this.paddingTop)),
        );

        const anyScrollView = this.scrollView as ScrollView & {
            scrollToOffset?: (offset: Vec2, timeInSecond?: number, attenuated?: boolean) => void;
        };

        if (typeof anyScrollView.scrollToOffset === 'function') {
            anyScrollView.scrollToOffset(offset, timeInSecond, true);
        } else if (this.direction === HVirtualListDirection.Vertical) {
            this.scrollView.scrollToTop(timeInSecond);
        } else {
            this.scrollView.scrollToLeft(timeInSecond);
        }

        this.markRefreshVisible(true);
    }

    private tryAutoFindReferences(): void {
        if (!this.scrollView) {
            this.scrollView = this.getComponent(ScrollView);
        }

        if (!this.content && this.scrollView) {
            this.content = this.scrollView.content;
        }
    }

    private hideTemplateNode(): void {
        if (this.templateNode) {
            this.templateNode.active = false;
        }
    }

    private bindScrollEvents(): void {
        if (!this.scrollView) {
            return;
        }
        this.scrollView.node.on(ScrollView.EventType.SCROLLING, this.onScrolling, this);
        this.scrollView.node.on(ScrollView.EventType.SCROLL_ENDED, this.onScrolling, this);
    }

    private unbindScrollEvents(): void {
        if (!this.scrollView) {
            return;
        }
        this.scrollView.node.off(ScrollView.EventType.SCROLLING, this.onScrolling, this);
        this.scrollView.node.off(ScrollView.EventType.SCROLL_ENDED, this.onScrolling, this);
    }

    private setupLayout(): void {
        this.layout.setup({
            direction: this.direction,
            itemWidth: this.itemWidth,
            itemHeight: this.itemHeight,
            spacingX: this.spacingX,
            spacingY: this.spacingY,
            padding: {
                left: this.paddingLeft,
                right: this.paddingRight,
                top: this.paddingTop,
                bottom: this.paddingBottom,
            },
            crossCount: this.crossCount,
            bufferLine: this.bufferLine,
        });
        this.layout.setDataCount(this.dataList.length);
    }

    private refreshViewSize(): void {
        const viewNode = this.getViewNode();
        const transform = viewNode?.getComponent(UITransform);
        if (!transform) {
            this.viewSize = new Size();
            return;
        }
        this.viewSize = new Size(transform.width, transform.height);
    }

    private refreshContentSize(): void {
        this.setupLayout();
        this.refreshViewSize();

        const content = this.getContentNode();
        const transform = content?.getComponent(UITransform);
        if (!content || !transform) {
            return;
        }

        const contentSize = this.layout.getContentSize(this.viewSize);
        transform.setContentSize(contentSize);
    }

    private getContentSize(): Size {
        const content = this.getContentNode();
        const transform = content?.getComponent(UITransform);
        if (!transform) {
            return new Size();
        }
        return new Size(transform.width, transform.height);
    }

    private getViewNode(): Node | null {
        if (!this.scrollView) {
            return null;
        }
        const anyScrollView = this.scrollView as ScrollView & { view?: Node };
        return anyScrollView.view || this.scrollView.node;
    }

    private getContentNode(): Node | null {
        return this.content || this.scrollView?.content || null;
    }

    private onScrolling(): void {
        this.markRefreshVisible(false);
    }

    private markRefreshVisible(force: boolean): void {
        if (!this.node.activeInHierarchy) {
            return;
        }

        if (this.useLateUpdateRefresh && !force) {
            this.pendingRefresh = true;
            return;
        }

        this.pendingRefresh = false;
        this.refreshVisibleItems(force);
    }

    private refreshVisibleItems(force: boolean): void {
        if (!this.scrollView || !this.getContentNode() || !this.itemPrefab && !this.templateNode) {
            return;
        }

        this.refreshContentSize();

        const offset = this.getScrollOffsetFromTopLeft();
        const range = this.layout.getVisibleRange(offset.x, offset.y, this.viewSize);

        if (!force && range.start === this.lastRange.start && range.end === this.lastRange.end) {
            return;
        }

        this.lastRange = range;
        this.recycleInvisibleItems(range.start, range.end);
        this.createVisibleItems(range.start, range.end);

        if (this.debug) {
            console.log('[HVMVirtualList] visible range', range.start, range.end, 'active', this.activeItems.size, 'pool', this.itemPool.length);
        }
    }

    /**
     * 把 Cocos content.position 转成左上角逻辑滚动偏移。
     *
     * 要求：
     * - 竖向滚动时 content.anchorY = 1。
     * - 横向滚动时 content.anchorX = 0。
     */
    private getScrollOffsetFromTopLeft(): { x: number; y: number } {
        const content = this.getContentNode();
        if (!content) {
            return { x: 0, y: 0 };
        }

        const pos = content.position;
        return {
            x: Math.max(0, -pos.x),
            y: Math.max(0, pos.y),
        };
    }

    private recycleInvisibleItems(start: number, end: number): void {
        const removeIndexes: number[] = [];

        this.activeItems.forEach((_node, index) => {
            if (index < start || index > end) {
                removeIndexes.push(index);
            }
        });

        for (const index of removeIndexes) {
            const node = this.activeItems.get(index);
            if (!node) {
                continue;
            }
            this.activeItems.delete(index);
            this.recycleItem(node);
        }
    }

    private createVisibleItems(start: number, end: number): void {
        const content = this.getContentNode();
        if (!content || end < start) {
            return;
        }

        for (let index = start; index <= end; index++) {
            if (index < 0 || index >= this.dataList.length) {
                continue;
            }
            if (this.activeItems.has(index)) {
                continue;
            }

            const node = this.obtainItem();
            if (node.parent !== content) {
                content.addChild(node);
            }

            const pos = this.layout.getItemPosition(index);
            node.setPosition(new Vec3(pos.x, pos.y, 0));
            node.active = true;
            this.activeItems.set(index, node);
            this.refreshItemNode(node, index);
        }
    }

    private obtainItem(): Node {
        const pooled = this.itemPool.pop();
        if (pooled) {
            return pooled;
        }

        if (this.itemPrefab) {
            return instantiate(this.itemPrefab);
        }

        if (this.templateNode) {
            const node = instantiate(this.templateNode);
            node.active = true;
            return node;
        }

        throw new Error('[HVMVirtualList] itemPrefab or templateNode is required');
    }

    private recycleItem(node: Node): void {
        this.callRecycle(node);

        node.active = false;
        node.removeFromParent();

        if (this.recycleInactiveItems && !this.destroyed) {
            this.itemPool.push(node);
        } else {
            node.destroy();
        }
    }

    private refreshItemNode(node: Node, index: number): void {
        const data = this.dataList[index];
        const renderer = this.findRenderer(node);
        if (renderer) {
            renderer.onVMVirtualListItemRefresh(data, index, this);
            return;
        }

        const legacy = this.findLegacyRenderer(node);
        if (legacy?.onVMListItemRefresh) {
            legacy.onVMListItemRefresh(data, index, this);
            return;
        }

        this.onRefreshItem(node, data, index);
    }

    /**
     * 子类可重写的 item 刷新入口。
     *
     * 如果 item prefab 上没有实现 HVMVirtualListItemRenderer，则会调用这里。
     */
    protected onRefreshItem(_node: Node, _data: TItem, _index: number): void {}

    private callRecycle(node: Node): void {
        const renderer = this.findRenderer(node);
        renderer?.onVMVirtualListItemRecycle?.();
    }

    private findRenderer(node: Node): HVMVirtualListItemRenderer<TItem> | null {
        if (this.rendererCache.has(node)) {
            return this.rendererCache.get(node) || null;
        }

        const renderer = this.scanRenderer(node);
        this.rendererCache.set(node, renderer);
        return renderer;
    }

    private scanRenderer(node: Node): HVMVirtualListItemRenderer<TItem> | null {
        const components = node.getComponents(Component);
        for (const component of components) {
            const renderer = component as unknown as HVMVirtualListItemRenderer<TItem>;
            if (typeof renderer.onVMVirtualListItemRefresh === 'function') {
                return renderer;
            }
        }

        const childComponents = node.getComponentsInChildren(Component);
        for (const component of childComponents) {
            const renderer = component as unknown as HVMVirtualListItemRenderer<TItem>;
            if (typeof renderer.onVMVirtualListItemRefresh === 'function') {
                return renderer;
            }
        }

        return null;
    }

    private findLegacyRenderer(node: Node): LegacyListItemRenderer<TItem> | null {
        if (this.legacyRendererCache.has(node)) {
            return this.legacyRendererCache.get(node) || null;
        }

        const renderer = this.scanLegacyRenderer(node);
        this.legacyRendererCache.set(node, renderer);
        return renderer;
    }

    private scanLegacyRenderer(node: Node): LegacyListItemRenderer<TItem> | null {
        const components = node.getComponents(Component);
        for (const component of components) {
            const renderer = component as unknown as LegacyListItemRenderer<TItem>;
            if (typeof renderer.onVMListItemRefresh === 'function') {
                return renderer;
            }
        }

        const childComponents = node.getComponentsInChildren(Component);
        for (const component of childComponents) {
            const renderer = component as unknown as LegacyListItemRenderer<TItem>;
            if (typeof renderer.onVMListItemRefresh === 'function') {
                return renderer;
            }
        }

        return null;
    }
}
