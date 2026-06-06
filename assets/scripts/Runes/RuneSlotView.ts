import { _decorator, Component, EventTouch, Label, Node, Sprite, Vec2 } from 'cc';
import type { IRuneDefinition } from './RuneTypes';
import { RuneSlotType } from './RuneTypes';
import type { RunePanelController } from './RunePanelController';

const { ccclass, property } = _decorator;

/**
 * 单个符纹槽位视图。
 * 负责显示槽位状态，以及点击/拖拽卸下交互。
 */
@ccclass('RuneSlotView')
export class RuneSlotView extends Component {
    /** 需要绑定：槽位名称文本，例如“技能槽1”。 */
    @property(Label) slotNameLabel: Label = null!;

    /** 需要绑定：符纹图标 Sprite。具体图标加载逻辑由你后续接入。 */
    @property(Sprite) iconSprite: Sprite = null!;

    /** 需要绑定：已装备符纹名称文本。 */
    @property(Label) runeNameLabel: Label = null!;

    /** 可选绑定：数量文本。当前装备位默认单件，先保留扩展口。 */
    @property(Label) stackLabel: Label = null!;

    /** 需要绑定：空槽状态节点。没有装备时显示。 */
    @property(Node) emptyState: Node = null!;

    /** 需要绑定：已装备状态节点。装备后显示。 */
    @property(Node) equippedState: Node = null!;

    /** 需要绑定：拖拽高亮节点。兼容槽位被拖到时显示。 */
    @property(Node) highlightState: Node = null!;

    private controller: RunePanelController | null = null;
    private slotType: RuneSlotType = RuneSlotType.ATTRIBUTE;
    private slotIndex = 0;
    private runeId: number | null = null;
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

    /** 初始化槽位元数据。 */
    public init(controller: RunePanelController, slotType: RuneSlotType, slotIndex: number, slotName: string): void {
        this.controller = controller;
        this.slotType = slotType;
        this.slotIndex = slotIndex;
        if (this.slotNameLabel) {
            this.slotNameLabel.string = slotName;
        }
        this.setHighlighted(false);
    }

    /** 根据当前装备的符纹定义刷新 UI。 */
    public render(definition: IRuneDefinition | null): void {
        this.runeId = definition?.runeId ?? null;
        if (this.runeNameLabel) {
            this.runeNameLabel.string = definition?.name ?? '';
        }
        if (this.stackLabel) {
            this.stackLabel.string = '';
        }
        if (this.emptyState) {
            this.emptyState.active = definition === null;
        }
        if (this.equippedState) {
            this.equippedState.active = definition !== null;
        }
        this.setHighlighted(false);
    }

    public getSlotType(): RuneSlotType {
        return this.slotType;
    }

    public getSlotIndex(): number {
        return this.slotIndex;
    }

    public getRuneId(): number | null {
        return this.runeId;
    }

    /** 切换拖拽高亮状态。 */
    public setHighlighted(active: boolean): void {
        if (this.highlightState) {
            this.highlightState.active = active;
        }
    }

    private onTouchStart(event: EventTouch): void {
        if (this.runeId === null) return;
        this.touchStartPos = event.getUILocation();
        this.dragging = false;
    }

    private onTouchMove(event: EventTouch): void {
        if (this.runeId === null || !this.touchStartPos) return;
        const location = event.getUILocation();
        if (!this.dragging && Vec2.distance(location, this.touchStartPos) > 12) {
            this.dragging = true;
            this.controller?.beginSlotDrag(this);
        }
        if (this.dragging) {
            this.controller?.updateSlotDrag(this, location);
        }
    }

    private onTouchEnd(event: EventTouch): void {
        if (this.runeId === null) return;
        if (this.dragging) {
            this.controller?.endSlotDrag(this, event.getUILocation());
        } else {
            this.controller?.onSlotClicked(this);
        }
        this.resetTouchState();
    }

    private onTouchCancel(event: EventTouch): void {
        if (this.dragging) {
            this.controller?.cancelSlotDrag(this, event.getUILocation());
        }
        this.resetTouchState();
    }

    private resetTouchState(): void {
        this.touchStartPos = null;
        this.dragging = false;
    }
}
