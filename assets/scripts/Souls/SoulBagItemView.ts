import { _decorator, Component, EventTouch, Label, Node, Sprite, Vec2 } from 'cc';
import type { SoulPanelController } from './SoulPanelController';
import { type ISoulData } from './SoulTypes';

const { ccclass, property } = _decorator;

@ccclass('SoulBagItemView')
export class SoulBagItemView extends Component {
    @property(Sprite) iconSprite: Sprite = null!;
    @property(Label) nameLabel: Label = null!;
    @property(Label) rarityLabel: Label = null!;
    @property(Node) selectedState: Node = null!;

    private _controller: SoulPanelController | null = null;
    private _soul: ISoulData | null = null;
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

    public init(controller: SoulPanelController, soul: ISoulData): void {
        this._controller = controller;
        this._soul = {
            ...soul,
            attributes: { ...soul.attributes },
            tags: soul.tags ? [...soul.tags] : undefined,
            metadata: soul.metadata ? { ...soul.metadata } : undefined,
        };

        if (this.nameLabel) {
            this.nameLabel.string = soul.name ?? `Soul ${soul.soulId}`;
        }
        if (this.rarityLabel) {
            this.rarityLabel.string = soul.rarity;
        }
        if (this.selectedState) {
            this.selectedState.active = false;
        }
    }

    public getSoulId(): string {
        return this._soul?.soulId ?? '';
    }

    public setSelected(active: boolean): void {
        if (this.selectedState) {
            this.selectedState.active = active;
        }
    }

    private onTouchStart(event: EventTouch): void {
        this._touchStartPos = event.getUILocation();
        this._dragging = false;
        this._controller?.onBagItemPressed(this);
    }

    private onTouchMove(event: EventTouch): void {
        if (!this._touchStartPos) {
            return;
        }

        const location = event.getUILocation();
        if (!this._dragging && Vec2.distance(location, this._touchStartPos) > 12) {
            this._dragging = true;
            this._controller?.beginBagItemDrag(this);
        }

        if (this._dragging) {
            this._controller?.updateBagItemDrag(this, location);
        }
    }

    private onTouchEnd(event: EventTouch): void {
        if (this._dragging) {
            this._controller?.endBagItemDrag(this, event.getUILocation());
        } else {
            this._controller?.onBagItemClicked(this);
        }
        this.resetTouchState();
    }

    private onTouchCancel(event: EventTouch): void {
        if (this._dragging) {
            this._controller?.cancelBagItemDrag(this, event.getUILocation());
        }
        this.setSelected(false);
        this.resetTouchState();
    }

    private resetTouchState(): void {
        this._touchStartPos = null;
        this._dragging = false;
    }
}
