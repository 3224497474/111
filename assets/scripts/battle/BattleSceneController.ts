import { _decorator, Camera, Canvas, Color, Component, Label, Node, Prefab, UITransform, Vec3, find } from 'cc';
import { BattleHitEffectController } from './BattleHitEffectController';
import { BattleManager } from './BattleManager';
import { BattleProjectileView } from './BattleProjectileView';
import { BattleUnitView } from './BattleUnitView';
import { TeamType, type IBattleInstance, type IPoint, type IProjectileState } from './Types';
import { BattleUnit } from './BattleUnit';
import { BattlePoolManager } from './core/BattlePoolManager';

const { ccclass, property } = _decorator;
const _cameraFollowPosition = new Vec3();
const _failureTextPosition = new Vec3();

@ccclass('BattleSceneController')
export class BattleSceneController extends Component {
    @property([Node])
    public playerUnitNodes: Node[] = [];

    @property([Node])
    public enemyUnitNodes: Node[] = [];

    @property(Node)
    public playerUnitRoot: Node | null = null;

    @property(Node)
    public enemyUnitRoot: Node | null = null;

    @property(Prefab)
    public playerUnitPrefab: Prefab | null = null;

    @property(Prefab)
    public enemyUnitPrefab: Prefab | null = null;

    @property
    public unitPoolWarmCount = 16;

    @property(Node)
    public projectileRoot: Node | null = null;

    @property(Prefab)
    public projectilePrefab: Prefab | null = null;

    @property(Camera)
    public battleCamera: Camera | null = null;

    @property
    public projectilePoolWarmCount = 32;

    @property
    public autoBindCurrentBattle = true;

    @property
    public useXZPlane = false;

    @property
    public planeY = 0;

    @property
    public force2DMode = true;

    @property
    public coordinateScale2D = 120;

    @property
    public destroyDeadUnitView = true;

    @property
    public showFailureText = true;

    @property
    public failureText = '\u6e38\u620f\u5931\u8d25';

    private battle: IBattleInstance | null = null;
    private readonly unitViews = new Map<string, BattleUnitView>();
    private readonly dynamicUnitIds = new Set<string>();
    private readonly externalUnitIds = new Set<string>();
    private readonly projectileViews = new Map<string, BattleProjectileView>();
    private hitEffectController: BattleHitEffectController | null = null;
    private readonly onBasicAttackFired = (payload?: {
        source?: BattleUnit;
        missed?: boolean;
    }) => this.handleBasicAttack(payload);
    private readonly onSkillCast = (payload?: { caster?: BattleUnit }) => this.handleSkillCast(payload);
    private readonly onBuiltinSkillTriggered = (payload?: { unit?: BattleUnit }) => this.handleBuiltinSkill(payload);
    private readonly onMeleeHitEffectRequested = (payload?: {
        target?: BattleUnit;
        effectId?: string;
    }) => this.handleMeleeHitEffect(payload);
    private readonly onSkillEffectRequested = (payload?: {
        target?: BattleUnit;
        effectId?: string;
    }) => this.handleSkillHitEffect(payload);
    private readonly onUnitSpawned = (payload?: { unit?: BattleUnit }) => this.handleUnitSpawned(payload);
    private readonly onUnitDied = (payload?: { unit?: BattleUnit }) => this.handleUnitDied(payload);
    private readonly onProjectileSpawned = (payload?: IProjectileState) => this.handleProjectileSpawned(payload);
    private readonly onProjectileImpact = (payload?: IProjectileState) => this.handleProjectileImpact(payload);
    private readonly onBattleEnded = (payload?: { winner?: 'player' | 'enemy' | null }) => this.handleBattleEnded(payload);
    private failureTextNode: Node | null = null;
    private readonly battleRootBasePosition = new Vec3();


    protected onLoad(): void {
        console.log('[BattleSceneController] onLoad before force2D', {
            useXZPlane: this.useXZPlane,
            planeY: this.planeY,
            force2DMode: this.force2DMode,
            parent: this.node.parent?.name ?? null,
            hasCanvasAncestor: this.hasCanvasAncestor(),
        });
        this.ensureUiRenderRoot();
        this.battleRootBasePosition.set(this.node.position);
        this.resolveBattleCamera();
        if (!this.force2DMode) {
            return;
        }

        this.useXZPlane = false;
        this.planeY = 0;
        console.log('[BattleSceneController] onLoad after force2D', {
            useXZPlane: this.useXZPlane,
            planeY: this.planeY,
            force2DMode: this.force2DMode,
            parent: this.node.parent?.name ?? null,
            hasCanvasAncestor: this.hasCanvasAncestor(),
        });
    }
    start(): void {
        if (!this.autoBindCurrentBattle) {
            return;
        }

        this.bindCurrentBattle();
    }

    onDestroy(): void {
        this.unbindBattle();
        this.clearProjectilePool();
    }

    public bindCurrentBattle(): boolean {
        const battle = BattleManager.getInstance().getCurrentBattle();
        if (!battle) {
            return false;
        }

        this.bindBattle(battle);
        return true;
    }

    public clearBattleBinding(): void {
        this.unbindBattle();
    }

    public bindBattle(battle: IBattleInstance, options?: { skipUnitSetup?: boolean }): void {
        if (this.battle === battle) {
            return;
        }

        this.unbindBattle();
        this.battle = battle;
        console.log('[BattleSceneController] bindBattle', {
            battleId: battle.battleId,
            useXZPlane: this.useXZPlane,
            planeY: this.planeY,
            coordinateScale2D: this.coordinateScale2D,
            playerUnitRoot: this.playerUnitRoot?.name ?? null,
            enemyUnitRoot: this.enemyUnitRoot?.name ?? null,
            projectileRoot: this.projectileRoot?.name ?? null,
            playerUnits: battle.playerTeam.units.length,
            enemyUnits: battle.enemyTeam.units.length,
        });
        console.log('[BattleSceneController] bindBattle roots', {
            playerUnitRootPosition: this.playerUnitRoot ? { x: this.playerUnitRoot.position.x, y: this.playerUnitRoot.position.y, z: this.playerUnitRoot.position.z } : null,
            enemyUnitRootPosition: this.enemyUnitRoot ? { x: this.enemyUnitRoot.position.x, y: this.enemyUnitRoot.position.y, z: this.enemyUnitRoot.position.z } : null,
            playerUnitRootScale: this.playerUnitRoot ? { x: this.playerUnitRoot.scale.x, y: this.playerUnitRoot.scale.y, z: this.playerUnitRoot.scale.z } : null,
            enemyUnitRootScale: this.enemyUnitRoot ? { x: this.enemyUnitRoot.scale.x, y: this.enemyUnitRoot.scale.y, z: this.enemyUnitRoot.scale.z } : null,
        });
        this.hitEffectController = this.getComponent(BattleHitEffectController) ?? this.addComponent(BattleHitEffectController);
        this.prewarmPools();
        if (!options?.skipUnitSetup) {
            this.setupUnitViews();
        }

        battle.eventBus.subscribe('BasicAttackFired', this.onBasicAttackFired, this);
        battle.eventBus.subscribe('SkillCast', this.onSkillCast, this);
        battle.eventBus.subscribe('BuiltinSkillTriggered', this.onBuiltinSkillTriggered, this);
        battle.eventBus.subscribe('MeleeHitEffectRequested', this.onMeleeHitEffectRequested, this);
        battle.eventBus.subscribe('SkillEffectRequested', this.onSkillEffectRequested, this);
        battle.eventBus.subscribe('UnitSpawned', this.onUnitSpawned, this);
        battle.eventBus.subscribe('UnitDied', this.onUnitDied, this);
        battle.eventBus.subscribe('ProjectileSpawned', this.onProjectileSpawned, this);
        battle.eventBus.subscribe('ProjectileImpact', this.onProjectileImpact, this);
        battle.eventBus.subscribe('BattleEnded', this.onBattleEnded, this);
        this.hideFailureText();
        this.syncUnitViews(0);
        this.syncProjectileViews(0);
    }

    public requestMoveTarget(target: IPoint): void {
        BattleManager.getInstance().setPlayerMoveTarget(target);
    }

    public clearMoveTarget(): void {
        BattleManager.getInstance().clearPlayerMoveTarget();
    }

    public getPlayerAnchorPosition(): IPoint | null {
        if (!this.battle) {
            return null;
        }

        return { ...this.battle.playerTeam.anchorPosition };
    }

    update(deltaSeconds: number): void {
        if (!this.battle) {
            return;
        }

        const alpha = BattleManager.getInstance().getVisualAlpha();
        this.syncUnitViews(alpha);
        this.syncProjectileViews(alpha);
        this.updateCameraFollow(alpha);
    }

    private unbindBattle(): void {
        if (this.battle) {
            this.battle.eventBus.unsubscribe('BasicAttackFired', this.onBasicAttackFired, this);
            this.battle.eventBus.unsubscribe('SkillCast', this.onSkillCast, this);
            this.battle.eventBus.unsubscribe('BuiltinSkillTriggered', this.onBuiltinSkillTriggered, this);
            this.battle.eventBus.unsubscribe('MeleeHitEffectRequested', this.onMeleeHitEffectRequested, this);
            this.battle.eventBus.unsubscribe('SkillEffectRequested', this.onSkillEffectRequested, this);
            this.battle.eventBus.unsubscribe('UnitSpawned', this.onUnitSpawned, this);
            this.battle.eventBus.unsubscribe('UnitDied', this.onUnitDied, this);
            this.battle.eventBus.unsubscribe('ProjectileSpawned', this.onProjectileSpawned, this);
            this.battle.eventBus.unsubscribe('ProjectileImpact', this.onProjectileImpact, this);
            this.battle.eventBus.unsubscribe('BattleEnded', this.onBattleEnded, this);
        }

        for (const unitId of this.dynamicUnitIds) {
            const view = this.unitViews.get(unitId);
            if (!view) {
                continue;
            }
            this.releaseDynamicUnitNode(view.node, unitId);
        }

        for (const unitId of this.externalUnitIds) {
            const view = this.unitViews.get(unitId);
            if (!view?.node.isValid) {
                continue;
            }

            view.node.destroy();
        }

        for (const view of this.projectileViews.values()) {
            this.releaseProjectileNode(view.node);
        }

        this.battle = null;
        this.unitViews.clear();
        this.dynamicUnitIds.clear();
        this.externalUnitIds.clear();
        this.projectileViews.clear();
        this.hideFailureText();
    }

    private setupUnitViews(): void {
        if (!this.battle) {
            return;
        }

        this.unitViews.clear();
        this.dynamicUnitIds.clear();
        this.bindUnitGroup(this.battle.playerTeam.units, this.playerUnitNodes, true);
        this.bindUnitGroup(this.battle.enemyTeam.units, this.enemyUnitNodes, false);
    }

    public getWorldNodeForUnit(unitId: string): Node | null {
        return this.unitViews.get(unitId)?.node ?? null;
    }

    public getUnitRoot(isPlayerTeam: boolean): Node {
        return isPlayerTeam
            ? (this.playerUnitRoot ?? this.node)
            : (this.enemyUnitRoot ?? this.node);
    }

    public registerExternalUnitView(unit: BattleUnit, view: BattleUnitView): void {
        this.unitViews.set(unit.unitId, view);
        this.externalUnitIds.add(unit.unitId);
        console.log('[BattleSceneController] registerExternalUnitView', {
            unitId: unit.unitId,
            nodeName: view.node.name,
            parent: view.node.parent?.name ?? null,
            position: { x: view.node.position.x, y: view.node.position.y, z: view.node.position.z },
            worldPosition: { x: view.node.worldPosition.x, y: view.node.worldPosition.y, z: view.node.worldPosition.z },
            useXZPlane: view.useXZPlane,
        });
    }

    private bindUnitGroup(units: BattleUnit[], nodes: Node[], isPlayerTeam: boolean): void {
        const count = Math.min(units.length, nodes.length);
        for (let i = 0; i < count; i++) {
            const unit = units[i];
            const node = nodes[i];
            this.bindViewToNode(unit, node);
        }

        for (let i = count; i < units.length; i++) {
            this.bindDynamicUnitView(units[i], isPlayerTeam);
        }
    }

    private syncUnitViews(alpha: number): void {
        if (!this.battle) {
            return;
        }

        for (const unit of [...this.battle.playerTeam.units, ...this.battle.enemyTeam.units]) {
            const view = this.unitViews.get(unit.unitId);
            if (!view) continue;
            view.sync(unit, alpha);
        }
    }

    private syncProjectileViews(alpha: number): void {
        if (!this.battle) {
            return;
        }

        for (const projectile of this.battle.projectiles) {
            const view = this.projectileViews.get(projectile.projectileId);
            if (!view) continue;
            view.sync(projectile, alpha);
        }
    }

    private handleBasicAttack(payload?: { source?: BattleUnit; missed?: boolean }): void {
        if (!payload?.source || payload.missed) {
            return;
        }

        this.unitViews.get(payload.source.unitId)?.playAttack();
    }

    private handleSkillCast(payload?: { caster?: BattleUnit }): void {
        if (!payload?.caster) {
            return;
        }

        this.unitViews.get(payload.caster.unitId)?.playSkill(0.24);
    }

    private handleBuiltinSkill(payload?: { unit?: BattleUnit }): void {
        if (!payload?.unit) {
            return;
        }

        this.unitViews.get(payload.unit.unitId)?.playSkill(0.24);
    }

    private handleMeleeHitEffect(payload?: { target?: BattleUnit; effectId?: string }): void {
        this.playHitEffect(payload?.target, 'attack', payload?.effectId);
    }

    private handleSkillHitEffect(payload?: { target?: BattleUnit; effectId?: string }): void {
        this.playHitEffect(payload?.target, 'skill', payload?.effectId);
    }

    private handleUnitSpawned(payload?: { unit?: BattleUnit }): void {
        if (!payload?.unit) {
            return;
        }

        if (this.unitViews.has(payload.unit.unitId)) {
            return;
        }

        this.bindDynamicUnitView(payload.unit, payload.unit.teamType === TeamType.Player);
    }

    private handleUnitDied(payload?: { unit?: BattleUnit }): void {
        const unit = payload?.unit;
        if (!unit || !this.destroyDeadUnitView) {
            return;
        }

        this.removeUnitView(unit.unitId);
    }

    private handleProjectileSpawned(projectile?: IProjectileState): void {
        if (!projectile || !this.projectilePrefab) {
            return;
        }

        const instance = this.acquireProjectileNode();
        const parent = this.projectileRoot ?? this.node;
        instance.parent = parent;
        this.applyLayerRecursively(instance, parent.layer);

        let view = instance.getComponent(BattleProjectileView);
        if (!view) {
            view = instance.addComponent(BattleProjectileView);
        }
        view.useXZPlane = this.useXZPlane;
        view.planeY = this.planeY;
        view.coordinateScale2D = this.coordinateScale2D;
        view.reuse({
            projectileId: projectile.projectileId,
            useXZPlane: this.useXZPlane,
            planeY: this.planeY,
            coordinateScale2D: this.coordinateScale2D,
        });
        view.sync(projectile, 0);
        this.projectileViews.set(projectile.projectileId, view);
    }

    private handleProjectileImpact(projectile?: IProjectileState): void {
        if (!projectile) {
            return;
        }

        const targetUnit = this.findBoundUnit(projectile.targetUnitId);
        this.playHitEffect(
            targetUnit,
            projectile.sourceSkillId ? 'skill' : 'impact',
            projectile.impactEffectId,
        );

        const view = this.projectileViews.get(projectile.projectileId);
        if (!view) {
            return;
        }

        this.projectileViews.delete(projectile.projectileId);
        this.releaseProjectileNode(view.node);
    }

    private playHitEffect(
        target: BattleUnit | undefined | null,
        style: 'attack' | 'skill' | 'impact',
        effectId?: string,
    ): void {
        if (!target) {
            return;
        }

        const view = this.unitViews.get(target.unitId);
        if (!view) {
            return;
        }

        this.hitEffectController?.playOnTarget(view.visualRoot ?? view.node, style, effectId);
    }

    private findBoundUnit(unitId: string): BattleUnit | null {
        if (!this.battle) {
            return null;
        }

        for (const unit of [...this.battle.playerTeam.units, ...this.battle.enemyTeam.units]) {
            if (unit.unitId === unitId) {
                return unit;
            }
        }

        return null;
    }

    private acquireProjectileNode(): Node {
        return BattlePoolManager.instance.getNode(this.projectilePrefab!);
    }

    private releaseProjectileNode(node: Node): void {
        if (!node.isValid || !this.projectilePrefab) {
            return;
        }

        BattlePoolManager.instance.putNode(
            BattlePoolManager.instance.getPrefabKey(this.projectilePrefab),
            node,
        );
    }

    private prewarmPools(): void {
        if (this.playerUnitPrefab) {
            BattlePoolManager.instance.initPool(this.playerUnitPrefab, this.unitPoolWarmCount);
        }
        if (this.enemyUnitPrefab) {
            BattlePoolManager.instance.initPool(this.enemyUnitPrefab, this.unitPoolWarmCount);
        }
        if (!this.projectilePrefab) {
            return;
        }

        BattlePoolManager.instance.initPool(this.projectilePrefab, this.projectilePoolWarmCount);
    }

    private clearProjectilePool(): void {
        if (this.playerUnitPrefab) {
            BattlePoolManager.instance.clearPool(
                BattlePoolManager.instance.getPrefabKey(this.playerUnitPrefab),
            );
        }
        if (this.enemyUnitPrefab) {
            BattlePoolManager.instance.clearPool(
                BattlePoolManager.instance.getPrefabKey(this.enemyUnitPrefab),
            );
        }
        if (!this.projectilePrefab) {
            return;
        }

        BattlePoolManager.instance.clearPool(
            BattlePoolManager.instance.getPrefabKey(this.projectilePrefab),
        );
    }

    private bindDynamicUnitView(unit: BattleUnit, isPlayerTeam: boolean): void {
        const prefab = isPlayerTeam ? this.playerUnitPrefab : this.enemyUnitPrefab;
        const root = isPlayerTeam
            ? (this.playerUnitRoot ?? this.node)
            : (this.enemyUnitRoot ?? this.node);
        if (!prefab || !root) {
            console.warn(`[BattleSceneController] missing dynamic unit prefab/root for ${unit.unitId}`);
            return;
        }

        const instance = BattlePoolManager.instance.getNode(prefab);
        instance.parent = root;
        this.applyLayerRecursively(instance, root.layer);
        instance.active = true;
        let view = instance.getComponent(BattleUnitView);
        if (!view) {
            view = instance.addComponent(BattleUnitView);
        }
        view.reuse({
            unitId: unit.unitId,
            useXZPlane: this.useXZPlane,
            planeY: this.planeY,
            coordinateScale2D: this.coordinateScale2D,
        });
        view = this.bindViewToNode(unit, instance);
        this.dynamicUnitIds.add(unit.unitId);
    }

    private bindViewToNode(unit: BattleUnit, node: Node): BattleUnitView {
        let view = node.getComponent(BattleUnitView);
        if (!view) {
            view = node.addComponent(BattleUnitView);
        }
        view.useXZPlane = this.useXZPlane;
        view.planeY = this.planeY;
        view.coordinateScale2D = this.coordinateScale2D;
        view.bind(unit, this.battle?.eventBus);
        this.unitViews.set(unit.unitId, view);
        return view;
    }

    private applyLayerRecursively(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) {
            this.applyLayerRecursively(child, layer);
        }
    }

    private updateCameraFollow(alpha: number): void {
        if (!this.battle) {
            return;
        }

        const followPosition = this.getInterpolatedPlayerCenter(alpha);
        _cameraFollowPosition.set(
            this.battleRootBasePosition.x - (followPosition.x * this.coordinateScale2D),
            this.battleRootBasePosition.y - (followPosition.y * this.coordinateScale2D),
            this.battleRootBasePosition.z,
        );
        this.node.setPosition(_cameraFollowPosition);
        if (this.failureTextNode?.isValid && this.failureTextNode.active) {
            _failureTextPosition.set(this.battleRootBasePosition.x, this.battleRootBasePosition.y + 220, 0);
            this.failureTextNode.setPosition(_failureTextPosition);
        }
    }

    private getInterpolatedPlayerCenter(alpha: number): IPoint {
        if (!this.battle) {
            return { x: 0, y: 0 };
        }

        const aliveUnits = this.battle.playerTeam.units.filter((unit) => unit.isAlive());
        if (aliveUnits.length === 0) {
            return { ...this.battle.playerTeam.anchorPosition };
        }

        const clampedAlpha = Math.max(0, Math.min(1, alpha));
        let x = 0;
        let y = 0;
        for (const unit of aliveUnits) {
            const previousPosition = unit.getPreviousPosition();
            const currentPosition = unit.getPosition();
            x += previousPosition.x + (currentPosition.x - previousPosition.x) * clampedAlpha;
            y += previousPosition.y + (currentPosition.y - previousPosition.y) * clampedAlpha;
        }

        return {
            x: x / aliveUnits.length,
            y: y / aliveUnits.length,
        };
    }

    private ensureUiRenderRoot(): void {
        if (this.hasCanvasAncestor()) {
            return;
        }

        const canvasNode = find('Canvas');
        if (!canvasNode) {
            console.warn('[BattleSceneController] Canvas not found, BattleEntry stays outside UI render tree.');
            return;
        }

        const worldPosition = this.node.worldPosition.clone();
        this.node.parent = canvasNode;
        this.node.setWorldPosition(worldPosition);
        this.applyLayerRecursively(this.node, canvasNode.layer);
        console.log('[BattleSceneController] BattleEntry reparented under Canvas', {
            parent: this.node.parent?.name ?? null,
            worldPosition: { x: this.node.worldPosition.x, y: this.node.worldPosition.y, z: this.node.worldPosition.z },
            layer: this.node.layer,
        });
    }

    private resolveBattleCamera(): void {
        if (this.battleCamera?.isValid) {
            return;
        }

        this.battleCamera = find('Canvas/Camera')?.getComponent(Camera) ?? null;
    }

    private hasCanvasAncestor(): boolean {
        let current: Node | null = this.node;
        while (current) {
            if (current.getComponent(Canvas)) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    private releaseDynamicUnitNode(node: Node, unitId: string): void {
        if (!node.isValid) {
            return;
        }

        const prefab = this.isPlayerUnitId(unitId) ? this.playerUnitPrefab : this.enemyUnitPrefab;
        if (!prefab) {
            return;
        }

        BattlePoolManager.instance.putNode(
            BattlePoolManager.instance.getPrefabKey(prefab),
            node,
        );
    }

    private removeUnitView(unitId: string): void {
        const view = this.unitViews.get(unitId);
        if (!view) {
            return;
        }

        this.unitViews.delete(unitId);
        if (this.dynamicUnitIds.delete(unitId)) {
            this.releaseDynamicUnitNode(view.node, unitId);
            return;
        }

        this.externalUnitIds.delete(unitId);
        if (view.node.isValid) {
            view.node.destroy();
        }
    }

    private handleBattleEnded(payload?: { winner?: 'player' | 'enemy' | null }): void {
        if (payload?.winner !== 'enemy' || !this.showFailureText) {
            return;
        }

        this.showFailureResult();
    }

    private showFailureResult(): void {
        const parent = find('Canvas');
        if (!parent) {
            return;
        }

        if (!this.failureTextNode || !this.failureTextNode.isValid) {
            const node = new Node('BattleFailureText');
            node.layer = parent.layer;
            const transform = node.addComponent(UITransform);
            transform.setContentSize(400, 80);
            const label = node.addComponent(Label);
            label.fontSize = 48;
            label.lineHeight = 52;
            label.color = new Color(255, 96, 96, 255);
            node.parent = parent;
            this.failureTextNode = node;
        }

        const label = this.failureTextNode.getComponent(Label);
        if (label) {
            label.string = this.failureText;
        }
        _failureTextPosition.set(this.battleRootBasePosition.x, this.battleRootBasePosition.y + 220, 0);
        this.failureTextNode.setPosition(_failureTextPosition);
        this.failureTextNode.active = true;
    }

    private hideFailureText(): void {
        if (this.failureTextNode?.isValid) {
            this.failureTextNode.active = false;
        }
    }

    private isPlayerUnitId(unitId: string): boolean {
        return this.battle?.playerTeam.units.some((unit) => unit.unitId === unitId) ?? false;
    }
}
