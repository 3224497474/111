import { H } from '../../H';
import { BagVMPath, ProjectVMTag, type BagItemData } from './ProjectVMTypes';

/**
 * 背包 VM 初始化示例。
 */
export function initBagVM(): void {
    const items: BagItemData[] = [];
    for (let i = 0; i < 1000; i++) {
        items.push({
            id: `item_${i}`,
            name: `道具 ${i + 1}`,
            count: Math.floor(Math.random() * 999) + 1,
            quality: Math.floor(Math.random() * 5) + 1,
            iconKey: `icon_${i % 20}`,
        });
    }

    H.vm.add({
        [BagVMPath.Items]: items,
        [BagVMPath.SortType]: 'quality',
        [BagVMPath.SelectedId]: '',
        [BagVMPath.ViewItems]: [],
    }, ProjectVMTag.Bag, {
        overwrite: true,
        active: true,
    });
}
