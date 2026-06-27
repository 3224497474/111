/**
 * 项目层 VM tag / path 示例。
 *
 * 框架层不应该写死 user、bag、task 这些业务名。
 * 项目层用枚举约束，避免 UI 里到处散写字符串。
 */
export enum ProjectVMTag {
    Bag = 'bag',
    User = 'user',
}

export enum BagVMPath {
    Items = 'items',
    SortType = 'sortType',
    SelectedId = 'selectedId',
    ViewItems = 'viewItems',
}

export interface BagItemData {
    id: string;
    name: string;
    count: number;
    quality: number;
    iconKey: string;
}

export interface BagViewItem {
    id: string;
    name: string;
    countText: string;
    quality: number;
    iconKey: string;
    selected: boolean;
}
