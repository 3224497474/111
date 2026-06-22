import { _decorator, Component } from 'cc';
import type { HVMList, HVMListItemRenderer } from './HVMList';

const { ccclass } = _decorator;

/**
 * HVMListItem 是列表 item 脚本基类。
 *
 * 设计说明：
 * - item 节点挂业务子类脚本，业务子类继承 HVMListItem<TItem>。
 * - HVMList 刷新时会自动调用 onVMListItemRefresh，并把 data/index/list 存到基类。
 * - 业务层只需要重写 refreshItem，不需要关心列表节点池、VM 监听和节点回收。
 */
@ccclass('HVMListItem')
export class HVMListItem<TItem = unknown> extends Component implements HVMListItemRenderer<TItem> {
    /** 类型 TItem | undefined。作用：当前 item 绑定的数据。*/
    private itemData: TItem | undefined;

    /** 类型 number。作用：当前 item 在列表中的索引，未绑定时为 -1。*/
    private itemIndex = -1;

    /** 类型 HVMList<TItem> | null。作用：当前 item 所属的列表组件。*/
    private itemList: HVMList<TItem> | null = null;

    /**
     * HVMList 调用的刷新入口。
     *
     * @param data 类型 TItem，作用是当前 item 对应的数据。
     * @param index 类型 number，作用是当前 item 在列表中的索引。
     * @param list 类型 HVMList<TItem>，作用是当前 item 所属的列表组件。
     */
    public onVMListItemRefresh(data: TItem, index: number, list: HVMList<TItem>): void {
        this.itemData = data;
        this.itemIndex = index;
        this.itemList = list;
        this.refreshItem(data, index, list);
    }

    /**
     * 获取当前 item 数据。
     *
     * @returns 类型 TItem | undefined，已绑定时返回数据，否则返回 undefined。
     */
    public getData(): TItem | undefined {
        return this.itemData;
    }

    /**
     * 获取当前 item 索引。
     *
     * @returns 类型 number，已绑定时返回索引，否则返回 -1。
     */
    public getIndex(): number {
        return this.itemIndex;
    }

    /**
     * 获取当前 item 所属列表。
     *
     * @returns 类型 HVMList<TItem> | null，已绑定时返回列表组件，否则返回 null。
     */
    public getList(): HVMList<TItem> | null {
        return this.itemList;
    }

    /**
     * 判断当前 item 是否已经绑定数据。
     *
     * @returns 类型 boolean，true 表示当前 item 已经绑定列表数据。
     */
    public isBound(): boolean {
        return this.itemIndex >= 0;
    }

    /**
     * 业务子类重写的刷新函数。
     *
     * @param data 类型 TItem，作用是当前 item 对应的数据。
     * @param index 类型 number，作用是当前 item 在列表中的索引。
     * @param list 类型 HVMList<TItem>，作用是当前 item 所属的列表组件。
     */
    protected refreshItem(_data: TItem, _index: number, _list: HVMList<TItem>): void {}

    /**
     * Cocos 生命周期：节点被禁用时清理旧绑定，避免节点池复用时读到旧数据。
     */
    protected onDisable(): void {
        this.itemData = undefined;
        this.itemIndex = -1;
        this.itemList = null;
    }
}
