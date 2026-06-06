import { _decorator, Component, EventTouch, Label, Node, Sprite, Vec2 } from 'cc';
import type { IRuneDefinition, IRuneInventoryStack } from './RuneTypes';
import type { RunePanelController } from './RunePanelController';

const { ccclass, property } = _decorator;

/**
 * 背包单个符纹 item 视图。
 * 负责点击、按下、拖拽手势，不负责真正的装备逻辑。
 */
@ccclass('RuneBagItemView')
export class RuneBagItemView extends Component {
    /** 需要绑定：符纹图标 Sprite。具体图集加载逻辑由你后续接入。 */
    @property(Sprite) iconSprite: Sprite = null!;

    /** 需要绑定：符纹名称文本。 */
    @property(Label) nameLabel: Label = null!;

    /** 需要绑定：堆叠数量文本，例如 x3。 */
    @property(Label) countLabel: Label = null!;

    /** 需要绑定：类型文本，例如 attribute / skill。 */
    @property(Label) typeLabel: Label = null!;

    /** 需要绑定：选中态节点。按下或点击时可高亮显示。 */
    @property(Node) selectedState: Node = null!;

    /** 可选绑定：拖拽预览锚点。当前版本未使用，预留给后续拖拽表现。 */
    @property(Node) dragPreviewAnchor: Node = null!;

    private controller: RunePanelController | null = null;
    private stack: IRuneInventoryStack | null = null;
    private definition: IRuneDefinition | null = null;
    private touchStartPos: Vec2 | null = null;
    private dragging = false;

    onLoad(): void {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    /** 用背包堆叠数据初始化视图。 */
    public init(controller: RunePanelController, stack: IRuneInventoryStack, definition: IRuneDefinition): void {
        this.controller = controller;
        this.stack = { ...stack };
        this.definition = definition;

        if (this.nameLabel) this.nameLabel.string = definition.name;
        if (this.countLabel) this.countLabel.string = `x${stack.count}`;
        if (this.typeLabel) this.typeLabel.string = definition.type;
        if (this.selectedState) this.selectedState.active = false;
    }

    /** 返回当前背包 item 对应的 runeId。 */
    public getRuneId(): number {
        return this.stack?.runeId ?? 0;
    }

    /** 切换选中态。 */
    public setSelected(active: boolean): void {
        if (this.selectedState) {
            this.selectedState.active = active;
        }
    }

    private onTouchStart(event: EventTouch): void {
        this.touchStartPos = event.getUILocation();
        this.dragging = false;
        this.controller?.onBagItemPress(this);
    }

    private onTouchMove(event: EventTouch): void {
        if (!this.touchStartPos) return;
        const location = event.getUILocation();
        if (!this.dragging && Vec2.distance(location, this.touchStartPos) > 12) {
            this.dragging = true;
            this.controller?.beginBagItemDrag(this);
        }
        if (this.dragging) {
            this.controller?.updateBagItemDrag(this, location);
        }
    }

    private onTouchEnd(event: EventTouch): void {
        const location = event.getUILocation();
        if (this.dragging) {
            this.controller?.endBagItemDrag(this, location);
        } else {
            this.controller?.onBagItemClicked(this);
        }
        this.resetTouchState();
    }

    private onTouchCancel(event: EventTouch): void {
        if (this.dragging) {
            this.controller?.cancelBagItemDrag(this, event.getUILocation());
        }
        this.resetTouchState();
    }

    private resetTouchState(): void {
        this.touchStartPos = null;
        this.dragging = false;
    }
}
