import { _decorator, Label, Node } from 'cc';
import { H } from '../../H';
import { HVMVirtualListItem } from '../components/HVMVirtualListItem';
import { BagVMPath, ProjectVMTag, type BagViewItem } from './ProjectVMTypes';

const { ccclass, property } = _decorator;

/**
 * 背包虚拟列表 item 示例。
 *
 * 注意：item 内部不挂 HVMLabel / HVMState 监听每个字段。
 * 虚拟列表 item 会被复用，最稳的方式是 refreshItem(data) 直接赋值。
 */
@ccclass('BagVirtualListItem')
export class BagVirtualListItem extends HVMVirtualListItem<BagViewItem> {
    @property(Label)
    private nameLabel: Label | null = null;

    @property(Label)
    private countLabel: Label | null = null;

    @property(Node)
    private selectedNode: Node | null = null;

    protected onLoad(): void {
        this.node.on(Node.EventType.TOUCH_END, this.onClickItem, this);
    }

    protected onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_END, this.onClickItem, this);
    }

    protected refreshItem(data: BagViewItem): void {
        if (this.nameLabel) {
            this.nameLabel.string = data.name;
        }

        if (this.countLabel) {
            this.countLabel.string = data.countText;
        }

        if (this.selectedNode) {
            this.selectedNode.active = data.selected;
        }
    }

    protected recycleItem(): void {
        // 停止 tween、动画、异步图片加载等。
    }

    private onClickItem(): void {
        const data = this.getData();
        if (!data) {
            return;
        }

        H.vm.write(ProjectVMTag.Bag, BagVMPath.SelectedId, data.id, {
            reason: 'bag-select',
            immediate: true,
        });
    }
}
