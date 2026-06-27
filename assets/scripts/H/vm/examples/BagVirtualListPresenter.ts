import { _decorator } from 'cc';
import { HVMListPresenterComponent } from '../components/HVMListPresenterComponent';
import type { HVMListBuildContext, HVMListSourceConfig, HVMListTargetConfig } from '../HVMListPresenter';
import { BagVMPath, ProjectVMTag, type BagItemData, type BagViewItem } from './ProjectVMTypes';

const { ccclass } = _decorator;

/**
 * 背包展示列表 Presenter 示例。
 *
 * 注意：这个文件是项目层示例，不是框架核心。
 * 如果你的目录结构不同，请把 import 路径改成项目自己的 HVM 路径。
 */
@ccclass('BagVirtualListPresenter')
export class BagVirtualListPresenter extends HVMListPresenterComponent<BagViewItem> {
    protected getSources(): HVMListSourceConfig[] {
        return [
            { tag: ProjectVMTag.Bag, path: BagVMPath.Items, defaultValue: [] },
            { tag: ProjectVMTag.Bag, path: BagVMPath.SortType, defaultValue: 'quality' },
            { tag: ProjectVMTag.Bag, path: BagVMPath.SelectedId, defaultValue: '' },
        ];
    }

    protected getTarget(): HVMListTargetConfig {
        return {
            tag: ProjectVMTag.Bag,
            path: BagVMPath.ViewItems,
        };
    }

    protected buildList(ctx: HVMListBuildContext<BagViewItem>): BagViewItem[] {
        const items = ctx.getSource<BagItemData[]>(0, []);
        const sortType = ctx.getSource<string>(1, 'quality');
        const selectedId = ctx.getSource<string>(2, '');

        const sorted = items.slice().sort((a, b) => {
            if (sortType === 'count') {
                return b.count - a.count;
            }
            return b.quality - a.quality;
        });

        return sorted.map((item) => ({
            id: item.id,
            name: item.name,
            countText: String(item.count),
            quality: item.quality,
            iconKey: item.iconKey,
            selected: item.id === selectedId,
        }));
    }
}
