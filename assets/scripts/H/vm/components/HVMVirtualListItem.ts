import { _decorator, Component } from 'cc';
import type { HVMVirtualList } from './HVMVirtualList';

const { ccclass } = _decorator;

/**
 * VM 虚拟列表 item 渲染接口。
 *
 * itemPrefab 根节点或子节点上的任意脚本，只要实现这个接口，就可以接收虚拟列表刷新。
 */
export interface HVMVirtualListItemRenderer<TItem = unknown> {
    /**
     * 虚拟列表刷新 item 时调用。
     */
    onVMVirtualListItemRefresh(data: TItem, index: number, list: HVMVirtualList<TItem>): void;

    /**
     * item 被虚拟列表回收前调用。
     */
    onVMVirtualListItemRecycle?(): void;
}

/**
 * HVMVirtualListItem 是虚拟列表 item 基类。
 *
 * 设计说明：
 * - 业务 item 继承它，只重写 refreshItem / recycleItem。
 * - 不在 item 内部创建 VM watcher。
 * - item 被节点池复用时，由 HVMVirtualList 重新传入 data/index/list。
 */
@ccclass('HVMVirtualListItem')
export class HVMVirtualListItem<TItem = unknown> extends Component implements HVMVirtualListItemRenderer<TItem> {
    private itemData: TItem | undefined;
    private itemIndex = -1;
    private itemList: HVMVirtualList<TItem> | null = null;

    /**
     * HVMVirtualList 调用的刷新入口。
     */
    public onVMVirtualListItemRefresh(data: TItem, index: number, list: HVMVirtualList<TItem>): void {
        this.itemData = data;
        this.itemIndex = index;
        this.itemList = list;
        this.refreshItem(data, index, list);
    }

    /**
     * HVMVirtualList 回收 item 前调用。
     */
    public onVMVirtualListItemRecycle(): void {
        this.recycleItem();
        this.clearBinding();
    }

    public getData(): TItem | undefined {
        return this.itemData;
    }

    public getIndex(): number {
        return this.itemIndex;
    }

    public getList(): HVMVirtualList<TItem> | null {
        return this.itemList;
    }

    public isBound(): boolean {
        return this.itemIndex >= 0;
    }

    /**
     * 业务子类重写：刷新 item 显示。
     */
    protected refreshItem(_data: TItem, _index: number, _list: HVMVirtualList<TItem>): void {}

    /**
     * 业务子类重写：回收前清理动画、tween、临时状态、异步图片请求标记等。
     */
    protected recycleItem(): void {}

    protected onDisable(): void {
        // 当父 UI 被隐藏或节点池回收时，避免业务读到旧数据。
        this.clearBinding();
    }

    private clearBinding(): void {
        this.itemData = undefined;
        this.itemIndex = -1;
        this.itemList = null;
    }
}
