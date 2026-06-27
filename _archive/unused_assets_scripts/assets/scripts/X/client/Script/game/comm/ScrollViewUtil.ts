import { _decorator, Component, instantiate, Node, Prefab, ScrollView } from "cc";

const { ccclass, property } = _decorator;

type RenderItem = (itemUI: Node, item: any, index: number) => void;

@ccclass("ScrollViewUtil")
export class ScrollViewUtil extends Component {
    @property(Prefab)
    itemPrefab: Prefab | null = null;

    private _data: any[] = [];
    private _renderItem: RenderItem | null = null;

    setData(arr: any[], renderItem: RenderItem) {
        this._data = Array.isArray(arr) ? arr : [];
        this._renderItem = renderItem;
        this.renderAll();
    }

    refreshList() {
        this.renderAll();
    }

    refreshIndex(index: number, item?: any) {
        if (index < 0 || index >= this._data.length) {
            return;
        }
        if (item !== undefined) {
            this._data[index] = item;
        }
        const content = this.getContentNode();
        const child = content.children[index];
        if (!child || !this._renderItem) {
            return;
        }
        (child as any).index = index;
        this._renderItem(child, this._data[index], index);
    }

    scrollToIndex(index: number, time = 0) {
        const scrollView = this.getComponent(ScrollView);
        const content = this.getContentNode();
        const child = content.children[index];
        if (!scrollView || !child) {
            return;
        }
        scrollView.scrollToOffset(scrollView.getScrollOffset(), time);
    }

    private renderAll() {
        const content = this.getContentNode();
        content.removeAllChildren();

        if (!this.itemPrefab || !this._renderItem) {
            return;
        }

        this._data.forEach((item, index) => {
            const itemNode = instantiate(this.itemPrefab!);
            (itemNode as any).index = index;
            content.addChild(itemNode);
            this._renderItem!(itemNode, item, index);
        });
    }

    private getContentNode() {
        return this.getComponent(ScrollView)?.content ?? this.node;
    }
}
