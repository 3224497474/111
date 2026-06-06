import { _decorator, Component, EventTouch, Label, Node, Sprite, Vec2 } from 'cc';
import type { SoulPanelController } from './SoulPanelController';
import { SoulSlotType, type ISoulData } from './SoulTypes';

const { ccclass, property } = _decorator;

@ccclass('SoulSlotView')
export class SoulSlotView extends Component {
    @property(Label) slotNameLabel: Label = null!;
    @property(Sprite) iconSprite: Sprite = null!;
    @property(Label) soulNameLabel: Label = null!;
    @property(Node) emptyState: Node = null!;
    @property(Node) equippedState: Node = null!;
    @property(Node) selectedState: Node = null!;
    @property(Node) highlightState: Node = null!;

    private _controller: SoulPanelController | null = null;
    private _slotType: SoulSlotType = SoulSlotType.Main;
    private _equippedSoul: ISoulData | null = null;
    private _touchStartPos: Vec2 | null = null;
    private _dragging = false;

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

    public init(controller: SoulPanelController, slotType: SoulSlotType, slotName: string): void {
        this._controller = controller;
        this._slotType = slotType;
        if (this.slotNameLabel) {
            this.slotNameLabel.string = slotName;
        }
    }

    public render(soul: ISoulData | null, selected: boolean): void {
        this._equippedSoul = soul
            ? {
                  ...soul,
                  attributes: { ...soul.attributes },
                  tags: soul.tags ? [...soul.tags] : undefined,
                  metadata: soul.metadata ? { ...soul.metadata } : undefined,
              }
            : null;

        if (this.soulNameLabel) {
            this.soulNameLabel.string = soul?.name ?? '';
        }
        if (this.emptyState) {
            this.emptyState.active = soul === null;
        }
        if (this.equippedState) {
            this.equippedState.active = soul !== null;
        }
        if (this.selectedState) {
            this.selectedState.active = selected;
        }
        this.setHighlighted(false);
    }

    public getSlotType(): SoulSlotType {
        return this._slotType;
    }

    public getEquippedSoulId(): string | null {
        return this._equippedSoul?.soulId ?? null;
    }

    public setHighlighted(active: boolean): void {
        if (this.highlightState) {
            this.highlightState.active = active;
        }
    }

    private onTouchStart(event: EventTouch): void {
        if (!this._equippedSoul) {
            return;
        }

        this._touchStartPos = event.getUILocation();
        this._dragging = false;
    }

    private onTouchMove(event: EventTouch): void {
        if (!this._equippedSoul || !this._touchStartPos) {
            return;
        }

        const location = event.getUILocation();
        if (!this._dragging && Vec2.distance(location, this._touchStartPos) > 12) {
            this._dragging = true;
            this._controller?.beginSlotDrag(this);
        }

        if (this._dragging) {
            this._controller?.updateSlotDrag(this, location);
        }
    }

    private onTouchEnd(event: EventTouch): void {
        if (this._dragging) {
            this._controller?.endSlotDrag(this, event.getUILocation());
        } else {
            this._controller?.onSlotClicked(this);
        }
        this.resetTouchState();
    }

    private onTouchCancel(event: EventTouch): void {
        if (this._dragging) {
            this._controller?.cancelSlotDrag(this, event.getUILocation());
        }
        this.resetTouchState();
    }

    private resetTouchState(): void {
        this._touchStartPos = null;
        this._dragging = false;
    }
}
