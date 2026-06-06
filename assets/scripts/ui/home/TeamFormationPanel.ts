import {
    _decorator,
    Button,
    Component,
    director,
    instantiate,
    Label,
    Layout,
    Node,
    Prefab,
    Sprite,
} from 'cc';
import { GameFacade } from '../../app/GameFacade';
import { ConfigManager } from '../../config/ConfigManager';
import { TransitionManager } from '../../remote/TransitionManager';
import { RouteMap, RouteType } from '../../remote/config-Button/TransitionRoute';

const { ccclass, property } = _decorator;
const DEFAULT_LEVEL_ID = 'level_001';
const DEFAULT_HERO_ID = '000001';
const DEFAULT_ENEMY_IDS = ['010001', '010001'];
const DEFAULT_SKILL_IDS = [1002, 1004];

type SoulRow = {
    id: number | string;
    name?: string;
    cost?: number | string;
};

type SoulItemRefs = {
    icon: Sprite | null;
    nameLabel: Label | null;
    costLabel: Label | null;
};

@ccclass('TeamFormationPanel')
export class TeamFormationPanel extends Component {
    private readonly MAX_TEAM_COST = 10;
    private equippedSoulIds: string[] = [];
    private currentCost = 0;
    private readonly soulConfigMap = new Map<string, SoulRow>();
    private startBattleBound = false;

    @property(Node)
    public soulListContent: Node | null = null;

    @property(Node)
    public equippedSlotsNode: Node | null = null;

    @property(Label)
    public costLabel: Label | null = null;

    @property(Prefab)
    public soulItemPrefab: Prefab | null = null;

    @property(Button)
    public btnStartBattle: Button | null = null;

    protected onEnable(): void {
        if (!this.startBattleBound && this.btnStartBattle) {
            this.btnStartBattle.node.on(Button.EventType.CLICK, this.onClickStartBattle, this);
            this.startBattleBound = true;
        }

        void this.initializePanel();
    }

    protected onDisable(): void {
        if (this.startBattleBound && this.btnStartBattle) {
            this.btnStartBattle.node.off(Button.EventType.CLICK, this.onClickStartBattle, this);
            this.startBattleBound = false;
        }
    }

    private async initializePanel(): Promise<void> {
        this.resetPanelState();

        try {
            await ConfigManager.loadAllConfigs();
        } catch (error) {
            console.error('[TeamFormationPanel] Failed to load soul configs.', error);
            return;
        }

        const soulTable = (ConfigManager.tables as unknown as {
            TbSoul?: { getDataList?: () => SoulRow[] };
        })?.TbSoul;
        const soulList = soulTable?.getDataList?.() ?? [];
        if (soulList.length === 0) {
            console.warn('[TeamFormationPanel] TbSoul is empty or unavailable.');
            return;
        }

        this.soulConfigMap.clear();
        for (const soul of soulList) {
            const soulId = String(soul.id).trim();
            if (!soulId) {
                continue;
            }

            this.soulConfigMap.set(soulId, soul);
            this.createSoulListItem(soulId, soul);
        }

        this.soulListContent?.getComponent(Layout)?.updateLayout();
    }

    private resetPanelState(): void {
        this.equippedSoulIds = [];
        this.currentCost = 0;
        this.soulListContent?.removeAllChildren();
        this.equippedSlotsNode?.removeAllChildren();
        this.updateCostUI();
    }

    private createSoulListItem(soulId: string, soul: SoulRow): void {
        if (!this.soulListContent || !this.soulItemPrefab) {
            console.warn('[TeamFormationPanel] Missing soul list container or soul item prefab.');
            return;
        }

        const cost = this.getSoulCost(soul);
        const itemNode = instantiate(this.soulItemPrefab);
        this.fillSoulItem(itemNode, soul, cost);
        itemNode.on(Button.EventType.CLICK, () => {
            this.equipSoul(soulId, cost);
        });
        this.soulListContent.addChild(itemNode);
    }

    private equipSoul(soulId: string, cost: number): void {
        if (!this.equippedSlotsNode || !this.soulItemPrefab) {
            console.warn('[TeamFormationPanel] Missing equipped slots container or soul item prefab.');
            return;
        }

        const soul = this.soulConfigMap.get(soulId);
        if (!soul) {
            console.warn(`[TeamFormationPanel] Soul config not found: ${soulId}`);
            return;
        }

        if (this.currentCost + cost > this.MAX_TEAM_COST) {
            console.warn(`[TeamFormationPanel] Team cost exceeded: ${this.currentCost + cost}/${this.MAX_TEAM_COST}`);
            return;
        }

        this.equippedSoulIds.push(soulId);
        this.currentCost += cost;
        this.updateCostUI();

        const equippedNode = instantiate(this.soulItemPrefab);
        this.fillSoulItem(equippedNode, soul, cost);
        equippedNode.on(Button.EventType.CLICK, () => {
            this.unequipSoul(equippedNode, soulId, cost);
        });
        this.equippedSlotsNode.addChild(equippedNode);
        this.equippedSlotsNode.getComponent(Layout)?.updateLayout();
    }

    private unequipSoul(node: Node, soulId: string, cost: number): void {
        const index = this.equippedSoulIds.indexOf(soulId);
        if (index < 0) {
            console.warn(`[TeamFormationPanel] Equipped soul not found: ${soulId}`);
            return;
        }

        this.equippedSoulIds.splice(index, 1);
        this.currentCost = Math.max(0, this.currentCost - cost);
        node.destroy();
        this.updateCostUI();
        this.equippedSlotsNode?.getComponent(Layout)?.updateLayout();
    }

    private fillSoulItem(itemNode: Node, soul: SoulRow, cost: number): void {
        const refs = this.resolveSoulItemRefs(itemNode);
        if (refs.nameLabel) {
            refs.nameLabel.string = soul.name?.trim() || `Soul ${String(soul.id)}`;
        }
        if (refs.costLabel) {
            refs.costLabel.string = `Cost: ${cost}`;
        }
        if (refs.icon) {
            refs.icon.node.active = true;
        }
    }

    private resolveSoulItemRefs(itemNode: Node): SoulItemRefs {
        const labels = itemNode.getComponentsInChildren(Label);
        const nameNode = itemNode.getChildByName('Name')
            ?? itemNode.getChildByName('name')
            ?? itemNode.getChildByName('LabelName');
        const costNode = itemNode.getChildByName('Cost')
            ?? itemNode.getChildByName('cost')
            ?? itemNode.getChildByName('LabelCost');
        const iconNode = itemNode.getChildByName('Icon')
            ?? itemNode.getChildByName('icon')
            ?? itemNode.getChildByName('Avatar');

        return {
            icon: iconNode?.getComponent(Sprite) ?? itemNode.getComponentInChildren(Sprite),
            nameLabel: nameNode?.getComponent(Label) ?? labels[0] ?? null,
            costLabel: costNode?.getComponent(Label) ?? labels[1] ?? null,
        };
    }

    private getSoulCost(soul: SoulRow): number {
        const cost = Number(soul.cost ?? 0);
        return Number.isFinite(cost) ? cost : 0;
    }

    private updateCostUI(): void {
        if (!this.costLabel) {
            return;
        }

        this.costLabel.string = `Cost: ${this.currentCost} / ${this.MAX_TEAM_COST}`;
    }

    private async onClickStartBattle(): Promise<void> {
        const heroId = DEFAULT_HERO_ID;
        const success = await GameFacade.instance.battle.startBattle({
            levelId: DEFAULT_LEVEL_ID,
            heroId,
            equippedSoulIds: [...this.equippedSoulIds],
            equippedSkillIds: [...DEFAULT_SKILL_IDS],
            builtinSkillId: null,
            equippedRuneIds: GameFacade.instance.home.collectEquippedRuneIds(heroId),
            enemyIds: [...DEFAULT_ENEMY_IDS],
        });
        if (!success) {
            console.warn('[TeamFormationPanel] Failed to start battle.');
            return;
        }

        GameFacade.instance.saveGame();

        const battleRoute = RouteMap[RouteType.HomeToBattle];
        if (!battleRoute) {
            director.loadScene('Battle');
            return;
        }

        await TransitionManager.instance.gotoScene(
            battleRoute.sceneName,
            battleRoute.bundles,
            battleRoute.tips,
        );
    }
}
