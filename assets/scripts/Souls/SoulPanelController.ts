import { _decorator, Component, instantiate, Label, Node, Prefab, ScrollView, UITransform, Vec2 } from 'cc';
import { SoulBagItemView } from './SoulBagItemView';
import { SoulSlotView } from './SoulSlotView';
import { SoulSystem } from './SoulSystem';
import { SOUL_SLOT_ORDER, SoulSlotType, type ISoulOperationResult } from './SoulTypes';

const { ccclass, property } = _decorator;

@ccclass('SoulPanelController')
export class SoulPanelController extends Component {
    @property(Node) mainSlotNode: Node = null!;
    @property(Node) subSlotNode1: Node = null!;
    @property(Node) subSlotNode2: Node = null!;
    @property(Node) bagDropZone: Node = null!;
    @property(ScrollView) bagScrollView: ScrollView = null!;
    @property(Node) bagListRoot: Node = null!;
    @property(Prefab) bagItemPrefab: Prefab = null!;
    @property(Label) statusLabel: Label = null!;

    private readonly _system = SoulSystem.instance;
    private readonly _slotViews = new Map<SoulSlotType, SoulSlotView>();
    private _selectedSlot: SoulSlotType = SoulSlotType.Main;
    private _selectedBagItem: SoulBagItemView | null = null;
    private readonly _onDataChanged = () => this.refreshUI();

    onLoad(): void {
        this.setupSlotViews();
    }

    onEnable(): void {
        this._system.subscribe(this._onDataChanged);
        this.refreshUI();
    }

    onDisable(): void {
        this._system.unsubscribe(this._onDataChanged);
    }

    public onSlotClicked(view: SoulSlotView): void {
        this._selectedSlot = view.getSlotType();
        this.clearBagSelection();

        const equippedSoul = this._system.getSlotSoul(view.getSlotType());
        if (!equippedSoul) {
            this.refreshSlotViews();
            return;
        }

        const result = this._system.unequipSoul(view.getSlotType());
        this.handleOperationResult(result);
    }

    public onBagItemPressed(view: SoulBagItemView): void {
        this.clearBagSelection();
        this._selectedBagItem = view;
        this._selectedBagItem.setSelected(true);
    }

    public onBagItemClicked(view: SoulBagItemView): void {
        this.onBagItemPressed(view);
        const result = this._system.equipSoul(this._selectedSlot, view.getSoulId());
        this.handleOperationResult(result);
    }

    public beginBagItemDrag(_view: SoulBagItemView): void {
        this.clearSlotHighlights();
    }

    public updateBagItemDrag(_view: SoulBagItemView, location: Vec2): void {
        this.clearSlotHighlights();
        const slotView = this.findSlotAt(location);
        if (!slotView) {
            return;
        }

        slotView.setHighlighted(true);
    }

    public endBagItemDrag(view: SoulBagItemView, location: Vec2): void {
        const slotView = this.findSlotAt(location);
        this.clearSlotHighlights();
        if (!slotView) {
            return;
        }

        this._selectedSlot = slotView.getSlotType();
        const result = this._system.equipSoul(slotView.getSlotType(), view.getSoulId());
        this.handleOperationResult(result);
    }

    public cancelBagItemDrag(_view: SoulBagItemView, _location: Vec2): void {
        this.clearSlotHighlights();
    }

    public beginSlotDrag(_view: SoulSlotView): void {
        this.clearSlotHighlights();
    }

    public updateSlotDrag(_view: SoulSlotView, _location: Vec2): void {}

    public endSlotDrag(view: SoulSlotView, location: Vec2): void {
        if (!this.isPointInsideNode(location, this.getBagDropTarget())) {
            return;
        }

        const result = this._system.unequipSoul(view.getSlotType());
        this.handleOperationResult(result);
    }

    public cancelSlotDrag(_view: SoulSlotView, _location: Vec2): void {
        this.clearSlotHighlights();
    }

    private setupSlotViews(): void {
        this.setupSlotView(this.mainSlotNode, SoulSlotType.Main, 'Main Soul');
        this.setupSlotView(this.subSlotNode1, SoulSlotType.Sub1, 'Sub Soul 1');
        this.setupSlotView(this.subSlotNode2, SoulSlotType.Sub2, 'Sub Soul 2');
    }

    private setupSlotView(node: Node | null, slotType: SoulSlotType, slotName: string): void {
        if (!node) {
            return;
        }

        let slotView = node.getComponent(SoulSlotView);
        if (!slotView) {
            slotView = node.addComponent(SoulSlotView);
        }
        slotView.init(this, slotType, slotName);
        this._slotViews.set(slotType, slotView);
    }

    private refreshUI(): void {
        this.refreshSlotViews();
        this.refreshBagList();
    }

    private refreshSlotViews(): void {
        for (const slot of SOUL_SLOT_ORDER) {
            const slotView = this._slotViews.get(slot);
            if (!slotView) {
                continue;
            }

            slotView.render(this._system.getSlotSoul(slot), slot === this._selectedSlot);
        }
    }

    private refreshBagList(): void {
        const content = this.getBagContentRoot();
        if (!content || !this.bagItemPrefab) {
            return;
        }

        const souls = this._system.getAvailableSouls();
        content.removeAllChildren();
        this._selectedBagItem = null;

        for (const soul of souls) {
            const itemNode = instantiate(this.bagItemPrefab);
            const itemView = itemNode.getComponent(SoulBagItemView) || itemNode.addComponent(SoulBagItemView);
            itemView.init(this, soul);
            content.addChild(itemNode);
        }
    }

    private clearBagSelection(): void {
        this._selectedBagItem?.setSelected(false);
        this._selectedBagItem = null;
    }

    private findSlotAt(point: Vec2): SoulSlotView | null {
        for (const slotView of this._slotViews.values()) {
            if (this.isPointInsideNode(point, slotView.node)) {
                return slotView;
            }
        }
        return null;
    }

    private isPointInsideNode(point: Vec2, node: Node | null): boolean {
        if (!node) {
            return false;
        }

        const transform = node.getComponent(UITransform);
        if (!transform) {
            return false;
        }

        return transform.getBoundingBoxToWorld().contains(point);
    }

    private clearSlotHighlights(): void {
        for (const slotView of this._slotViews.values()) {
            slotView.setHighlighted(false);
        }
    }

    private getBagContentRoot(): Node | null {
        return this.bagScrollView?.content ?? this.bagListRoot;
    }

    private getBagDropTarget(): Node | null {
        return this.bagDropZone ?? this.bagScrollView?.node ?? this.bagListRoot;
    }

    private handleOperationResult(result: ISoulOperationResult): void {
        if (this.statusLabel) {
            this.statusLabel.string = result.message;
        }

        if (result.success) {
            this.node.emit('soul-operation-success', result.message);
        } else {
            this.node.emit('soul-operation-failed', result.message);
        }

        this.refreshUI();
    }
}
