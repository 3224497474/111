import { _decorator, Component, Node, ScrollView, Label, UITransform, Vec2, Vec3, EventTouch, instantiate, Prefab } from "cc";
const { ccclass, property } = _decorator;

@ccclass
export class ScrollSelector extends Component {
    @property({
        type: Prefab
    })
    itemPrefab: Prefab = null!;

    @property({
        type: ScrollView
    })
    scrollView: ScrollView = null!;

    @property
    itemHeight: number = 50;

    @property
    visibleCount: number = 5;

    private items: Label[] = [];
    private data: string[] = [];
    private selectedIndex: number = 0;
    private contentNode: Node = null!;

    onLoad() {
        this.initScrollView();
    }

    /**
     * 初始化滚动视图
     */
    private initScrollView() {
        if (!this.scrollView) return;
        
        this.contentNode = this.scrollView.content!;
        const contentUITransform = this.contentNode.getComponent(UITransform);
        if (contentUITransform) {
            contentUITransform.height = this.itemHeight * this.visibleCount;
        }
        
        this.scrollView.node.on(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnded, this);
    }

    /**
     * 设置选择器数据
     * @param data 数据数组
     * @param selectedIndex 选中的索引
     */
    public setData(data: string[], selectedIndex: number = 0) {
        this.data = data;
        this.selectedIndex = Math.max(0, Math.min(selectedIndex, data.length - 1));
        this.refreshItems();
        this.scrollToSelected();
    }

    /**
     * 获取选中的值
     */
    public getSelectedValue(): string {
        return this.data[this.selectedIndex];
    }

    /**
     * 获取选中的索引
     */
    public getSelectedIndex(): number {
        return this.selectedIndex;
    }

    /**
     * 刷新列表项目
     */
    private refreshItems() {
        // 清空现有项目
        this.contentNode.removeAllChildren();
        this.items = [];

        // 创建新项目
        for (let i = 0; i < this.data.length; i++) {
            const itemNode = instantiate(this.itemPrefab)!;
            this.contentNode.addChild(itemNode);

            const label = itemNode.getComponent(Label);
            if (label) {
                label.string = this.data[i];
            }

            const uiTransform = itemNode.getComponent(UITransform);
            if (uiTransform) {
                uiTransform.height = this.itemHeight;
                itemNode.setPosition(0, -(i * this.itemHeight + this.itemHeight / 2), 0);
            }

            this.items.push(label!);
        }

        // 更新 content 的高度
        const contentUITransform = this.contentNode.getComponent(UITransform);
        if (contentUITransform) {
            contentUITransform.height = this.itemHeight * this.data.length;
        }
    }

    /**
     * 滚动到选中项
     */
    private scrollToSelected() {
        if (!this.scrollView || !this.contentNode) return;

        const targetY = this.selectedIndex * this.itemHeight;
        const contentUITransform = this.contentNode.getComponent(UITransform);
        const viewHeight = (this.scrollView.node.getComponent(UITransform) as UITransform).height;

        // 计算应该滚动到的位置，使选中项居中
        const maxScroll = Math.max(0, contentUITransform!.height - viewHeight);
        const scrollY = Math.min(maxScroll, targetY - (viewHeight / 2 - this.itemHeight / 2));

        this.scrollView.scrollToOffset(new Vec2(0, scrollY), 0.3);
    }

    /**
     * 滚动停止时的回调
     */
    private onScrollEnded() {
        if (!this.scrollView || !this.contentNode) return;

        const scrollOffset = this.scrollView.getScrollOffset();
        const viewHeight = (this.scrollView.node.getComponent(UITransform) as UITransform).height;
        
        // 根据滚动偏移计算选中项
        const centerY = scrollOffset.y + viewHeight / 2;
        const newIndex = Math.round(centerY / this.itemHeight);
        
        this.selectedIndex = Math.max(0, Math.min(newIndex, this.data.length - 1));
        this.scrollToSelected();
        this.updateItemStyle();
    }

    /**
     * 更新项目样式（选中项高亮）
     */
    private updateItemStyle() {
        this.items.forEach((label, index) => {
            if (index === this.selectedIndex) {
                label.node.scale = new Vec3(1.1, 1.1, 1);
            } else {
                label.node.scale = new Vec3(1, 1, 1);
            }
        });
    }
}
