import {
    _decorator,
    Button,
    Component,
    instantiate,
    Label,
    Node,
    Prefab,
    ScrollView,
    UITransform,
    Vec2,
} from 'cc';
import { RuneSystem } from './RuneSystem';
import { RuneBagItemView } from './RuneBagItemView';
import { RuneSlotView } from './RuneSlotView';
import { type IRuneOperationResult, RuneSlotType, slotTypeForRuneType } from './RuneTypes';

const { ccclass, property } = _decorator;

/**
 * 绗︾汗鎬婚潰鏉挎帶鍒跺櫒銆? *
 * 鎺ㄨ崘 UI 缁撴瀯锛? * RunesPanel
 * - RoleHeader
 *   - RoleNameLabel
 *   - RoleDescLabel
 * - EquippedArea
 *   - AttributeGroup (12 涓?RuneSlotView)
 *   - ChargeGroup    (3 涓?RuneSlotView)
 *   - SkillGroup     (3 涓?RuneSlotView)
 *   - UltimateGroup  (1 涓?RuneSlotView)
 * - BagArea
 *   - CapacityLabel
 *   - BagDropZone
 *     - ScrollView
 *       - view
 *         - content
 * - ActionPopup
 *   - ConfirmButton
 *     - Label
 *   - CancelButton
 *
 * 瀵瑰浜嬩欢锛? * - rune-operation-success
 * - rune-operation-failed
 */
@ccclass('RunePanelController')
export class RunePanelController extends Component {
    /** 褰撳墠鏄剧ず鐨勮鑹叉。妗?ID銆?*/
    @property
    roleId = 'character_000001';

    /** 闇€瑕佺粦瀹氾細鑳屽寘澶у尯鍩熻妭鐐广€傝澶囨Ы鎷栧洖杩欓噷鏃朵細鎵ц鍗镐笅銆?*/
    @property(Node) bagDropZone: Node = null!;

    /** 闇€瑕佺粦瀹氾細鑳屽寘 ScrollView锛岃剼鏈細寰€瀹冪殑 content 涓嬬敓鎴?item銆?*/
    @property(ScrollView) bagScrollView: ScrollView = null!;

    /** 闇€瑕佺粦瀹氾細鑳屽寘 item 棰勫埗浣擄紝棰勫埗浣撲笂瑕佹寕 RuneBagItemView銆?*/
    @property(Prefab) bagItemPrefab: Prefab = null!;

    /** 闇€瑕佺粦瀹氾細12 涓睘鎬фЫ鑺傜偣銆?*/
    @property([Node]) attributeSlots: Node[] = [];

    /** 闇€瑕佺粦瀹氾細3 涓緵鑳芥Ы鑺傜偣銆?*/
    @property([Node]) chargeSlots: Node[] = [];

    /** 闇€瑕佺粦瀹氾細3 涓妧鑳芥Ы鑺傜偣銆?*/
    @property([Node]) skillSlots: Node[] = [];

    /** 闇€瑕佺粦瀹氾細1 涓粓鏋佹Ы鑺傜偣銆?*/
    @property(Node) ultimateSlot: Node = null!;

    /** 鍙€夌粦瀹氾細鎿嶄綔寮圭獥鏍硅妭鐐广€?*/
    @property(Node) actionPopup: Node = null!;

    /** 鍙€夌粦瀹氾細鎿嶄綔寮圭獥纭鎸夐挳銆?*/
    @property(Button) actionConfirmButton: Button = null!;

    /** 鍙€夌粦瀹氾細鎿嶄綔寮圭獥鍙栨秷鎸夐挳銆?*/
    @property(Button) actionCancelButton: Button = null!;

    /** 鍙€夌粦瀹氾細纭鎸夐挳鏂囨湰锛岀敤浜庢樉绀衡€滆澶?鍗镐笅鈥濄€?*/
    @property(Label) actionConfirmLabel: Label = null!;

    /** 鍙€夌粦瀹氾細瑙掕壊鍚嶆枃鏈€?*/
    @property(Label) roleNameLabel: Label = null!;

    /** 鍙€夌粦瀹氾細瑙掕壊鎻忚堪鏂囨湰銆?*/
    @property(Label) roleDescLabel: Label = null!;

    /** 鍙€夌粦瀹氾細鑳屽寘瀹归噺鏂囨湰锛屼緥濡?3/12銆?*/
    @property(Label) capacityLabel: Label = null!;

    private readonly system = RuneSystem.instance;
    private readonly slotViews = new Map<string, RuneSlotView>();
    private selectedBagItem: RuneBagItemView | null = null;
    private pendingAction:
        | { kind: 'equip'; runeId: number }
        | { kind: 'unequip'; slotType: RuneSlotType; slotIndex: number }
        | null = null;
    private readonly onSystemChanged = () => this.refreshUI();

    onLoad(): void {
        this.bindButtons();
        this.setupSlotViews();
        this.system.ensureRoleProfile(this.roleId, this.roleId);
        if (this.actionPopup) {
            this.actionPopup.active = false;
        }
    }

    onEnable(): void {
        this.system.subscribe(this.onSystemChanged);
        this.refreshUI();
    }

    onDisable(): void {
        this.system.unsubscribe(this.onSystemChanged);
    }

    /** 鍒囨崲褰撳墠鏄剧ず鐨勮鑹叉。妗堛€?*/
    public setRole(roleId: string, displayName?: string): void {
        this.roleId = roleId;
        this.system.ensureRoleProfile(roleId, displayName);
        this.refreshUI();
    }

    /** 鑳屽寘 item 鎸変笅鏃跺彧鍒囨崲閫変腑鎬併€?*/
    public onBagItemPress(view: RuneBagItemView): void {
        this.selectedBagItem?.setSelected(false);
        this.selectedBagItem = view;
        this.selectedBagItem.setSelected(true);
    }

    /** 鑳屽寘 item 鐐瑰嚮鏃跺皾璇曡嚜鍔ㄨ澶囥€?*/
    public onBagItemClicked(view: RuneBagItemView): void {
        this.selectedBagItem = view;
        this.requestEquip(view.getRuneId());
    }

    public beginBagItemDrag(_view: RuneBagItemView): void {
        this.clearSlotHighlights();
    }

    /** 鎷栨嫿鑳屽寘 item 鏃讹紝楂樹寒榧犳爣涓嬪吋瀹圭殑妲戒綅銆?*/
    public updateBagItemDrag(view: RuneBagItemView, location: Vec2): void {
        const slotView = this.findSlotAt(location);
        this.clearSlotHighlights();
        if (!slotView) return;

        const definition = this.system.getRuneDefinition(view.getRuneId());
        if (!definition) return;
        if (slotView.getSlotType() === slotTypeForRuneType(definition.type)) {
            slotView.setHighlighted(true);
        }
    }

    /** 鑳屽寘 item 鎷栨嫿缁撴潫鍚庯紝濡傛灉钀藉湪妲戒綅涓婂氨灏濊瘯瑁呭銆?*/
    public endBagItemDrag(view: RuneBagItemView, location: Vec2): void {
        const slotView = this.findSlotAt(location);
        this.clearSlotHighlights();
        if (!slotView) return;

        const result = this.system.equipRune(
            this.roleId,
            view.getRuneId(),
            slotView.getSlotType(),
            slotView.getSlotIndex(),
        );
        this.emitOperationResult(result);
        this.refreshUI();
    }

    public cancelBagItemDrag(_view: RuneBagItemView, _location: Vec2): void {
        this.clearSlotHighlights();
    }

    /** 鐐瑰嚮瑁呭妲戒綅鏃跺脊鍑哄嵏涓嬫搷浣溿€?*/
    public onSlotClicked(view: RuneSlotView): void {
        this.requestUnequip(view.getSlotType(), view.getSlotIndex());
    }

    public beginSlotDrag(_view: RuneSlotView): void {
        this.clearSlotHighlights();
    }

    /** 绗竴鐗堝彧鏀寔鎷栧洖鑳屽寘鍖哄煙鍗镐笅锛屼笉鏀寔妲戒綅鎹綅銆?*/
    public updateSlotDrag(_view: RuneSlotView, _location: Vec2): void {}

    /** 宸茶澶囨Ы浣嶆嫋鍒拌儗鍖呭尯鍩熸椂鎵ц鍗镐笅銆?*/
    public endSlotDrag(view: RuneSlotView, location: Vec2): void {
        if (!this.isPointInsideNode(location, this.bagDropZone)) {
            return;
        }

        const result = this.system.unequipRune(this.roleId, view.getSlotType(), view.getSlotIndex());
        this.emitOperationResult(result);
        this.refreshUI();
    }

    public cancelSlotDrag(_view: RuneSlotView, _location: Vec2): void {}

    private bindButtons(): void {
        if (this.actionConfirmButton) {
            this.actionConfirmButton.node.on(Node.EventType.TOUCH_END, this.onActionConfirm, this);
        }
        if (this.actionCancelButton) {
            this.actionCancelButton.node.on(Node.EventType.TOUCH_END, this.onActionCancel, this);
        }
    }

    /** 鎵归噺鍒濆鍖栧悇绫绘Ы浣嶈妭鐐广€?*/
    private setupSlotViews(): void {
        this.setupSlotGroup(this.attributeSlots, RuneSlotType.ATTRIBUTE, 'Attribute Slot');
        this.setupSlotGroup(this.chargeSlots, RuneSlotType.CHARGE, 'Charge Slot');
        this.setupSlotGroup(this.skillSlots, RuneSlotType.SKILL, 'Skill Slot');
        if (this.ultimateSlot) {
            this.setupSlotGroup([this.ultimateSlot], RuneSlotType.ULTIMATE, 'Ultimate Slot');
        }
    }

    private setupSlotGroup(nodes: Node[], slotType: RuneSlotType, labelPrefix: string): void {
        nodes.forEach((node, index) => {
            let slotView = node.getComponent(RuneSlotView);
            if (!slotView) {
                slotView = node.addComponent(RuneSlotView);
            }
            slotView.init(this, slotType, index, `${labelPrefix}${index + 1}`);
            this.slotViews.set(this.getSlotKey(slotType, index), slotView);
        });
    }

    /** 鍒锋柊鏁翠釜闈㈡澘銆?*/
    private refreshUI(): void {
        this.refreshHeader();
        this.refreshCapacityLabel();
        this.refreshSlotViews();
        this.refreshBagItems();
    }

    private refreshHeader(): void {
        const profile = this.system.ensureRoleProfile(this.roleId, this.roleId);
        if (this.roleNameLabel) {
            this.roleNameLabel.string = profile.displayName;
        }
        if (this.roleDescLabel) {
            this.roleDescLabel.string = profile.description ?? '';
        }
    }

    private refreshCapacityLabel(): void {
        if (!this.capacityLabel) return;
        this.capacityLabel.string = `${this.system.getBagUsedSlots()}/${this.system.getBagCapacity()}`;
    }

    /** 鐢ㄥ綋鍓?roleId 鐨勬Ы浣嶆暟鎹埛鏂拌澶囧尯銆?*/
    private refreshSlotViews(): void {
        const loadout = this.system.getLoadout(this.roleId);
        this.slotViews.forEach((slotView) => {
            const runeId = loadout.getSlotRune(slotView.getSlotType(), slotView.getSlotIndex());
            const definition = runeId !== null ? this.system.getRuneDefinition(runeId) ?? null : null;
            slotView.render(definition);
        });
    }

    /** 閲嶅缓鑳屽寘鍒楄〃銆?*/
    private refreshBagItems(): void {
        if (!this.bagScrollView?.content || !this.bagItemPrefab) return;
        const content = this.bagScrollView.content;
        content.removeAllChildren();

        this.selectedBagItem = null;
        const stacks = this.system.getInventoryStacks();
        for (const stack of stacks) {
            const definition = this.system.getRuneDefinition(stack.runeId);
            if (!definition) continue;
            const node = instantiate(this.bagItemPrefab);
            const view = node.getComponent(RuneBagItemView) || node.addComponent(RuneBagItemView);
            view.init(this, stack, definition);
            content.addChild(node);
        }
    }

    /** 璇锋眰瑁呭锛涘鏋滄病鎺ュ脊绐楋紝灏辩洿鎺ユ墽琛屻€?*/
    private requestEquip(runeId: number): void {
        if (!this.actionPopup || !this.actionConfirmButton) {
            this.emitOperationResult(this.system.autoEquipRune(this.roleId, runeId));
            this.refreshUI();
            return;
        }

        this.pendingAction = { kind: 'equip', runeId };
        if (this.actionConfirmLabel) {
            this.actionConfirmLabel.string = '瑁呭';
        }
        this.actionPopup.active = true;
    }

    /** 璇锋眰鍗镐笅锛涘鏋滄病鎺ュ脊绐楋紝灏辩洿鎺ユ墽琛屻€?*/
    private requestUnequip(slotType: RuneSlotType, slotIndex: number): void {
        if (!this.actionPopup || !this.actionConfirmButton) {
            this.emitOperationResult(this.system.unequipRune(this.roleId, slotType, slotIndex));
            this.refreshUI();
            return;
        }

        this.pendingAction = { kind: 'unequip', slotType, slotIndex };
        if (this.actionConfirmLabel) {
            this.actionConfirmLabel.string = '鍗镐笅';
        }
        this.actionPopup.active = true;
    }

    private onActionConfirm(): void {
        if (!this.pendingAction) return;

        let result: IRuneOperationResult = { success: false, message: '娌℃湁鍙墽琛岀殑鎿嶄綔' };
        if (this.pendingAction.kind === 'equip') {
            result = this.system.autoEquipRune(this.roleId, this.pendingAction.runeId);
        } else {
            result = this.system.unequipRune(
                this.roleId,
                this.pendingAction.slotType,
                this.pendingAction.slotIndex,
            );
        }

        this.pendingAction = null;
        if (this.actionPopup) {
            this.actionPopup.active = false;
        }
        this.emitOperationResult(result);
        this.refreshUI();
    }

    private onActionCancel(): void {
        this.pendingAction = null;
        if (this.actionPopup) {
            this.actionPopup.active = false;
        }
    }

    /** 鎵惧埌灞忓箷鍧愭爣涓嬪懡涓殑妲戒綅銆?*/
    private findSlotAt(point: Vec2): RuneSlotView | null {
        for (const slotView of this.slotViews.values()) {
            if (this.isPointInsideNode(point, slotView.node)) {
                return slotView;
            }
        }
        return null;
    }

    /** 鍒ゆ柇鏌愪釜涓栫晫鍧愭爣鏄惁鍦ㄨ妭鐐瑰尯鍩熷唴銆?*/
    private isPointInsideNode(point: Vec2, node: Node | null): boolean {
        if (!node) return false;
        const transform = node.getComponent(UITransform);
        if (!transform) return false;
        return transform.getBoundingBoxToWorld().contains(point);
    }

    private clearSlotHighlights(): void {
        this.slotViews.forEach((slotView) => slotView.setHighlighted(false));
    }

    private getSlotKey(slotType: RuneSlotType, slotIndex: number): string {
        return `${slotType}:${slotIndex}`;
    }

    /** 瀵瑰鎶涚粺涓€鎴愬姛/澶辫触浜嬩欢锛屾柟渚夸綘鎺ユ彁绀恒€?*/
    private emitOperationResult(result: IRuneOperationResult): void {
        if (result.success) {
            this.node.emit('rune-operation-success', result.message);
        } else {
            this.node.emit('rune-operation-failed', result.message);
        }
    }
}
