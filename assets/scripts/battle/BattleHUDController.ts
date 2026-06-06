import { _decorator, Camera, Component, Graphics, Node, Prefab } from 'cc';
import { BattleManager } from './BattleManager';
import { BattleUnitHudView } from './BattleUnitHudView';
import type { IBattleInstance } from './Types';
import { BattleUnit } from './BattleUnit';
import { BattleSceneController } from './BattleSceneController';
import { BattlePoolManager } from './core/BattlePoolManager';

const { ccclass, property } = _decorator;

type HudBindingEntry = {
    unit: BattleUnit;
    worldNode: Node;
};

@ccclass('BattleHUDController')
export class BattleHUDController extends Component {
    private static readonly HUD_INSTANTIATIONS_PER_SLICE = 3;
    private static readonly BAR_LAYER_NAME = 'BattleHudBars';
    private static readonly TEXT_LAYER_NAME = 'BattleHudTexts';

    @property(Camera)
    public battleCamera: Camera | null = null;

    @property(Node)
    public hudRoot: Node | null = null;

    @property(Prefab)
    public unitHudPrefab: Prefab | null = null;

    @property
    public hudPoolWarmCount = 50;

    @property(BattleSceneController)
    public sceneController: BattleSceneController | null = null;

    @property
    public autoBindCurrentBattle = true;

    private battle: IBattleInstance | null = null;
    private readonly hudViews = new Map<string, BattleUnitHudView>();
    private pendingHudBindings: Generator<HudBindingEntry, void, void> | null = null;
    private hudBindingToken = 0;
    private barLayer: Node | null = null;
    private textLayer: Node | null = null;
    private barGraphics: Graphics | null = null;
    private readonly onDamageApplied = (payload?: { source?: BattleUnit; target?: BattleUnit }) => this.handleUnitRefresh(payload);
    private readonly onHealApplied = (payload?: { source?: BattleUnit; target?: BattleUnit }) => this.handleUnitRefresh(payload);
    private readonly onBuiltinSkillTriggered = (payload?: { unit?: BattleUnit }) => this.handleBuiltinRefresh(payload);
    private readonly onControlApplied = (payload?: { unit?: BattleUnit }) => this.handleControlled(payload);
    private readonly onUnitDied = (payload?: { unit?: BattleUnit }) => this.handleUnitDied(payload);
    private readonly onUnitSpawned = (payload?: { unit?: BattleUnit }) => this.handleUnitSpawned(payload);

    start(): void {
        if (!this.autoBindCurrentBattle) {
            return;
        }

        this.bindCurrentBattle();
    }

    onDestroy(): void {
        this.unbindBattle();
        this.clearHudPool();
    }

    update(): void {
        if (!this.battle) {
            return;
        }

        for (const view of this.hudViews.values()) {
            view.syncPosition();
        }

        this.renderSharedBars();
    }

    public bindCurrentBattle(): boolean {
        const battle = BattleManager.getInstance().getCurrentBattle();
        if (!battle) {
            return false;
        }

        this.bindBattle(battle);
        return true;
    }

    public bindBattle(battle: IBattleInstance): void {
        if (this.battle === battle) {
            return;
        }

        this.unbindBattle();
        this.battle = battle;
        this.prewarmPools();
        this.setupHudViews();

        battle.eventBus.subscribe('DamageApplied', this.onDamageApplied, this);
        battle.eventBus.subscribe('HealApplied', this.onHealApplied, this);
        battle.eventBus.subscribe('BuiltinSkillTriggered', this.onBuiltinSkillTriggered, this);
        battle.eventBus.subscribe('ControlApplied', this.onControlApplied, this);
        battle.eventBus.subscribe('UnitDied', this.onUnitDied, this);
        battle.eventBus.subscribe('UnitSpawned', this.onUnitSpawned, this);
    }

    private unbindBattle(): void {
        this.hudBindingToken += 1;
        this.pendingHudBindings = null;

        if (this.battle) {
            this.battle.eventBus.unsubscribe('DamageApplied', this.onDamageApplied, this);
            this.battle.eventBus.unsubscribe('HealApplied', this.onHealApplied, this);
            this.battle.eventBus.unsubscribe('BuiltinSkillTriggered', this.onBuiltinSkillTriggered, this);
            this.battle.eventBus.unsubscribe('ControlApplied', this.onControlApplied, this);
            this.battle.eventBus.unsubscribe('UnitDied', this.onUnitDied, this);
            this.battle.eventBus.unsubscribe('UnitSpawned', this.onUnitSpawned, this);
        }

        for (const view of this.hudViews.values()) {
            this.releaseHudNode(view.node);
        }

        if (this.barGraphics) {
            this.barGraphics.clear();
        }

        this.battle = null;
        this.hudViews.clear();
    }

    private setupHudViews(): void {
        if (!this.battle || !this.battleCamera || !this.hudRoot || !this.unitHudPrefab || !this.sceneController) {
            return;
        }

        this.ensureSharedRenderLayers();
        this.hudViews.clear();
        this.pendingHudBindings = this.createHudBindingGenerator([
            ...this.battle.playerTeam.units,
            ...this.battle.enemyTeam.units,
        ]);

        const token = ++this.hudBindingToken;
        this.consumeHudBindings(token);
    }

    private ensureSharedRenderLayers(): void {
        if (!this.hudRoot) {
            return;
        }

        if (!this.barLayer || !this.barLayer.isValid) {
            this.barLayer = this.hudRoot.getChildByName(BattleHUDController.BAR_LAYER_NAME) ?? new Node(BattleHUDController.BAR_LAYER_NAME);
        }
        this.barLayer.parent = this.hudRoot;

        this.barGraphics = this.barLayer.getComponent(Graphics) ?? this.barLayer.addComponent(Graphics);
        this.barLayer.setSiblingIndex(0);

        if (!this.textLayer || !this.textLayer.isValid) {
            this.textLayer = this.hudRoot.getChildByName(BattleHUDController.TEXT_LAYER_NAME) ?? new Node(BattleHUDController.TEXT_LAYER_NAME);
        }
        this.textLayer.parent = this.hudRoot;

        this.textLayer.setSiblingIndex(this.hudRoot.children.length - 1);
    }

    private *createHudBindingGenerator(units: BattleUnit[]): Generator<HudBindingEntry, void, void> {
        for (let i = 0; i < units.length; i++) {
            const unit = units[i];
            const worldNode = this.sceneController?.getWorldNodeForUnit(unit.unitId);
            if (!worldNode) {
                continue;
            }
            yield {
                unit,
                worldNode,
            };
        }
    }

    private consumeHudBindings(token: number): void {
        if (token !== this.hudBindingToken || !this.pendingHudBindings) {
            return;
        }

        let processed = 0;
        while (processed < BattleHUDController.HUD_INSTANTIATIONS_PER_SLICE) {
            const next = this.pendingHudBindings.next();
            if (next.done) {
                this.pendingHudBindings = null;
                return;
            }

            this.instantiateHudView(next.value.unit, next.value.worldNode);
            processed += 1;
        }

        this.scheduleOnce(() => {
            this.consumeHudBindings(token);
        }, 0);
    }

    private instantiateHudView(unit: BattleUnit, worldNode: Node): void {
        if (!this.battle || !this.battleCamera || !this.hudRoot || !this.unitHudPrefab || !this.textLayer) {
            return;
        }

        const instance = BattlePoolManager.instance.getNode(this.unitHudPrefab);
        instance.parent = this.hudRoot;
        instance.active = true;

        let view = instance.getComponent(BattleUnitHudView);
        if (!view) {
            view = instance.addComponent(BattleUnitHudView);
        }
        if (this.sceneController && !this.sceneController.useXZPlane) {
            view.followHeight = Math.max(view.followHeight, this.sceneController.coordinateScale2D * 0.9);
        }

        view.reuse({
            unit,
            targetNode: worldNode,
            battleCamera: this.battleCamera,
            hudRoot: this.hudRoot,
            sharedTextRoot: this.textLayer,
        });
        view.syncPosition();
        this.hudViews.set(unit.unitId, view);
    }

    private releaseHudNode(node: Node): void {
        if (!node.isValid || !this.unitHudPrefab) {
            return;
        }

        BattlePoolManager.instance.putNode(
            BattlePoolManager.instance.getPrefabKey(this.unitHudPrefab),
            node,
        );
    }

    private prewarmPools(): void {
        if (!this.unitHudPrefab) {
            return;
        }

        BattlePoolManager.instance.initPool(this.unitHudPrefab, this.hudPoolWarmCount);
    }

    private clearHudPool(): void {
        if (!this.unitHudPrefab) {
            return;
        }

        BattlePoolManager.instance.clearPool(
            BattlePoolManager.instance.getPrefabKey(this.unitHudPrefab),
        );
    }

    private renderSharedBars(): void {
        if (!this.barGraphics) {
            return;
        }

        this.barGraphics.clear();
        for (const view of this.hudViews.values()) {
            view.drawBars(this.barGraphics);
        }
    }

    private handleUnitRefresh(payload?: { source?: BattleUnit; target?: BattleUnit }): void {
        if (payload?.source) {
            this.hudViews.get(payload.source.unitId)?.refresh(payload.source);
        }
        if (payload?.target) {
            this.hudViews.get(payload.target.unitId)?.refresh(payload.target);
        }
    }

    private handleBuiltinRefresh(payload?: { unit?: BattleUnit }): void {
        if (!payload?.unit) {
            return;
        }

        this.hudViews.get(payload.unit.unitId)?.refresh(payload.unit);
    }

    private handleControlled(payload?: { unit?: BattleUnit }): void {
        if (!payload?.unit) {
            return;
        }

        this.hudViews.get(payload.unit.unitId)?.refresh(payload.unit);
    }

    private handleUnitDied(payload?: { unit?: BattleUnit }): void {
        if (!payload?.unit) {
            return;
        }

        if (!payload.unit.isAlive()) {
            this.removeHudView(payload.unit.unitId);
            return;
        }

        this.hudViews.get(payload.unit.unitId)?.refresh(payload.unit);
    }

    private handleUnitSpawned(payload?: { unit?: BattleUnit }): void {
        const unit = payload?.unit;
        if (!unit || this.hudViews.has(unit.unitId)) {
            return;
        }

        const worldNode = this.sceneController?.getWorldNodeForUnit(unit.unitId);
        if (!worldNode) {
            return;
        }

        this.instantiateHudView(unit, worldNode);
    }

    private removeHudView(unitId: string): void {
        const view = this.hudViews.get(unitId);
        if (!view) {
            return;
        }

        this.hudViews.delete(unitId);
        this.releaseHudNode(view.node);
    }
}
