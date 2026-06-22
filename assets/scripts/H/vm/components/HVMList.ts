import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import { HVMBase } from './HVMBase';

const { ccclass, property } = _decorator;

/**
 * VM 列表项脚本接口。
 *
 * 说明：
 * - itemPrefab 根节点或子节点上的脚本只要实现 onVMListItemRefresh 即可接收数据。
 * - 框架不关心具体业务字段，业务 item 自己渲染自己的 Label/Icon/Button。
 */
export interface HVMListItemRenderer<TItem = unknown> {
    /**
     * 刷新列表项。
     *
     * @param data 类型 TItem，作用是当前 item 对应的数据。
     * @param index 类型 number，作用是当前 item 在列表中的索引。
     * @param list 类型 HVMList<TItem>，作用是当前列表组件实例。
     */
    onVMListItemRefresh(data: TItem, index: number, list: HVMList<TItem>): void;
}

/**
 * HVMList 把 VM 数组字段渲染成节点列表。
 *
 * 设计说明：
 * - 适合背包、任务、排行榜、小型商城列表等普通列表。
 * - 使用节点池复用 item，避免数据变化时整表 destroy/instantiate。
 * - 当前版本不是虚拟列表；超长滚动列表后续应扩展 HVMVirtualList。
 */
@ccclass('HVMList')
export class HVMList<TItem = unknown> extends HVMBase<TItem[]> {
    @property({ type: Node, tooltip: '列表内容容器。通常是 ScrollView/view/content。' })
    public content: Node | null = null;

    @property({ type: Prefab, tooltip: '列表项预制体。为空时会尝试使用 templateNode 克隆。' })
    public itemPrefab: Prefab | null = null;

    @property({ type: Node, tooltip: '列表项模板节点。没有 itemPrefab 时克隆它；运行时会自动隐藏。' })
    public templateNode: Node | null = null;

    @property({ tooltip: '最多渲染数量。0 表示不限制。' })
    public maxRenderCount = 0;

    @property({ tooltip: '数据为空时是否隐藏列表容器。' })
    public hideContentWhenEmpty = false;

    @property({ tooltip: '禁用 item 节点时是否放回节点池。' })
    public recycleInactiveItems = true;

    /** 类型 Node[]。作用：当前正在显示的 item 节点。 */
    private readonly activeItems: Node[] = [];

    /** 类型 Node[]。作用：可复用的 item 节点池。 */
    private readonly itemPool: Node[] = [];

    /** 类型 WeakMap。作用：缓存每个 item 节点上的渲染脚本，避免列表刷新时重复查找组件。*/
    private readonly rendererCache = new WeakMap<Node, HVMListItemRenderer<TItem> | null>();

    /** 类型 TItem[]。作用：保存当前列表数据引用，便于 item 或外部逻辑查询。*/
    private currentList: TItem[] = [];

    /**
     * Cocos 生命周期：加载时隐藏模板节点。
     */
    protected onLoad(): void {
        if (this.templateNode) {
            this.templateNode.active = false;
        }
    }

    /**
     * Cocos 生命周期：销毁时清空节点池引用。
     */
    protected onDestroy(): void {
        super.onDestroy();
        this.activeItems.forEach((node) => node.destroy());
        this.itemPool.forEach((node) => node.destroy());
        this.activeItems.length = 0;
        this.itemPool.length = 0;
        this.currentList = [];
    }

    /**
     * 获取默认值。
     *
     * @returns 类型 TItem[]，字段不存在时使用空数组。
     */
    protected getDefaultValue(): TItem[] {
        return [];
    }

    /**
     * VM 数组变化时刷新列表。
     *
     * @param value 类型 TItem[]，作用是当前 VM 数组数据。
     */
    protected refreshValue(value: TItem[]): void {
        const list = Array.isArray(value) ? value : [];
        this.currentList = list;
        const count = this.maxRenderCount > 0
            ? Math.min(list.length, this.maxRenderCount)
            : list.length;

        this.ensureActiveCount(count);

        for (let index = 0; index < count; index++) {
            const node = this.activeItems[index];
            node.active = true;
            this.refreshItem(node, list[index], index);
        }

        const content = this.getContentNode();
        if (content && content !== this.node && this.hideContentWhenEmpty) {
            content.active = count > 0;
        }
    }

    /**
     * 手动清理列表节点。
     */
    public clearList(): void {
        this.currentList = [];
        this.recycleFromIndex(0);
    }

    /**
     * 获取当前显示 item 数量。
     *
     * @returns 类型 number，当前 activeItems 数量。
     */
    public getActiveItemCount(): number {
        return this.activeItems.length;
    }

    /**
     * 获取当前显示中的 item 节点。
     *
     * @param index 类型 number，作用是要查询的 item 索引。
     * @returns 类型 Node | null，索引有效时返回对应 item 节点，否则返回 null。
     */
    public getItemNode(index: number): Node | null {
        return this.activeItems[index] || null;
    }

    /**
     * 获取当前列表中的数据项。
     *
     * @param index 类型 number，作用是要查询的数据索引。
     * @returns 类型 TItem | undefined，索引有效时返回数据项，否则返回 undefined。
     */
    public getItemData(index: number): TItem | undefined {
        return this.currentList[index];
    }

    /**
     * 获取当前列表数据。
     *
     * @returns 类型 readonly TItem[]，作用是只读查看当前 VM 数组引用。
     */
    public getDataList(): readonly TItem[] {
        return this.currentList;
    }

    private ensureActiveCount(count: number): void {
        if (this.activeItems.length > count) {
            this.recycleFromIndex(count);
        }

        while (this.activeItems.length < count) {
            const item = this.obtainItem();
            const content = this.getContentNode();
            if (content && item.parent !== content) {
                content.addChild(item);
            }
            item.active = true;
            this.activeItems.push(item);
        }
    }

    private recycleFromIndex(startIndex: number): void {
        const removed = this.activeItems.splice(startIndex);
        removed.forEach((node) => {
            node.active = false;
            if (this.recycleInactiveItems) {
                this.itemPool.push(node);
            } else {
                node.destroy();
            }
        });
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

        throw new Error('[HVMList] itemPrefab or templateNode is required');
    }

    private refreshItem(node: Node, data: TItem, index: number): void {
        const renderer = this.findRenderer(node);
        if (renderer) {
            renderer.onVMListItemRefresh(data, index, this);
            return;
        }

        this.onRefreshItem(node, data, index);
    }

    /**
     * 子类可重写的列表项刷新入口。
     *
     * @param node 类型 Node，作用是当前 item 节点。
     * @param data 类型 TItem，作用是当前 item 数据。
     * @param index 类型 number，作用是当前 item 索引。
     */
    protected onRefreshItem(_node: Node, _data: TItem, _index: number): void {}

    private findRenderer(node: Node): HVMListItemRenderer<TItem> | null {
        if (this.rendererCache.has(node)) {
            return this.rendererCache.get(node) || null;
        }

        const renderer = this.scanRenderer(node);
        this.rendererCache.set(node, renderer);
        return renderer;
    }

    private scanRenderer(node: Node): HVMListItemRenderer<TItem> | null {
        const components = node.getComponents(Component);
        for (const component of components) {
            const renderer = component as unknown as HVMListItemRenderer<TItem>;
            if (typeof renderer.onVMListItemRefresh === 'function') {
                return renderer;
            }
        }

        const childComponents = node.getComponentsInChildren(Component);
        for (const component of childComponents) {
            const renderer = component as unknown as HVMListItemRenderer<TItem>;
            if (typeof renderer.onVMListItemRefresh === 'function') {
                return renderer;
            }
        }

        return null;
    }

    private getContentNode(): Node | null {
        return this.content || this.node;
    }
}
