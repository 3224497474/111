import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import { GameFacade } from '../app/GameFacade';
import { RuneLoadout } from '../Runes/RuneLoadout';
import { RuneSystem } from '../Runes/RuneSystem';
import { RuneSlotType, slotTypeForRuneType } from '../Runes/RuneTypes';
import {
    type IBattleContext,
    type IPlayerFormation,
    type IPreparedBattleData,
} from '../data/GameContext';
import { RemotePrefabCache } from '../remote/RemotePrefabCache';
import { BattleHUDController } from './BattleHUDController';
import { BattleInputController } from './BattleInputController';
import { BattleManager } from './BattleManager';
import { BattleSceneController } from './BattleSceneController';
import { BattleUnit } from './BattleUnit';
import { BattleUnitView } from './BattleUnitView';
import { BattleState, TeamType, type IBattleInstance } from './Types';
import { BattleUnitFactory } from './core/BattleUnitFactory';

const { ccclass, property } = _decorator;

const BATTLE_PREFAB_BUNDLE = 'Battle';
const MAX_FRAME_DELTA_SECONDS = 0.2;

@ccclass('BattleBootstrap')
export class BattleBootstrap extends Component {
    @property(BattleSceneController)
    public sceneController: BattleSceneController | null = null;

    @property(BattleHUDController)
    public hudController: BattleHUDController | null = null;

    @property
    public autoStartBattle = true;

    private started = false;
    private accumulator = 0;
    private readonly spawnedViewNodes: Node[] = [];
    private readonly retainedPrefabRefs: string[] = [];
    private readonly handleBattleEnded = (payload?: { winner?: 'player' | 'enemy' | null }): void => {
        this.settleBattleFromRuntime(payload?.winner ?? null);
    };

    public async start(): Promise<void> {
        if (!this.autoStartBattle) {
            return;
        }

        await this.startSampleBattle();
    }

    public update(deltaTime: number): void {
        if (!this.started) {
            return;
        }

        const battleManager = BattleManager.getInstance();
        const battle = battleManager.getCurrentBattle();
        if (!battle || battle.state !== BattleState.ONGOING) {
            this.accumulator = 0;
            battleManager.visualTick(0);
            return;
        }

        const clampedDelta = Math.max(0, Math.min(deltaTime, MAX_FRAME_DELTA_SECONDS));
        this.accumulator += clampedDelta;

        while (this.accumulator >= BattleManager.FIXED_LOGIC_STEP) {
            battleManager.capturePrevState();
            battleManager.logicTick(BattleManager.FIXED_LOGIC_STEP);
            this.accumulator -= BattleManager.FIXED_LOGIC_STEP;

            const currentBattle = battleManager.getCurrentBattle();
            if (!currentBattle || currentBattle.state !== BattleState.ONGOING) {
                this.accumulator = 0;
                break;
            }
        }

        battleManager.visualTick(this.accumulator / BattleManager.FIXED_LOGIC_STEP);
    }

    protected onDestroy(): void {
        this.unbindBattleLifecycle();

        const battleManager = BattleManager.getInstance();
        const currentBattle = battleManager.getCurrentBattle();
        if (currentBattle?.state === BattleState.ONGOING) {
            GameFacade.instance.battle.abortBattle();
            GameFacade.instance.saveGame();
        }

        battleManager.stopBattle();
        this.clearSpawnedUnitViews();
    }

    public async startSampleBattle(): Promise<void> {
        if (this.started) {
            return;
        }

        this.clearSpawnedUnitViews();

        if (this.sceneController) {
            this.sceneController.useXZPlane = false;
            this.sceneController.planeY = 0;
            console.log('[BattleBootstrap] forced scene controller to 2D mode', {
                useXZPlane: this.sceneController.useXZPlane,
                planeY: this.sceneController.planeY,
                force2DMode: this.sceneController.force2DMode,
            });
        }
        this.ensureInputController();

        const progress = GameFacade.instance.progress;
        const battleContext = progress.getBattleContext();
        const formation = this.getResolvedFormation(progress.getFormation());
        const randomSeed = battleContext.randomSeed;
        const enemyIds = this.getResolvedEnemyIds(battleContext.currentLevelEnemyIds);
        const preparedBattle = this.getPreparedBattleData(battleContext);

        console.log('[BattleBootstrap] startSampleBattle context', {
            formation,
            enemyIds,
            playerPreparedCount: preparedBattle.playerUnits.length,
            enemyPreparedCount: preparedBattle.enemyUnits.length,
            randomSeed,
            useXZPlane: this.sceneController?.useXZPlane,
            playerUnitRoot: this.sceneController?.playerUnitRoot?.name ?? null,
            enemyUnitRoot: this.sceneController?.enemyUnitRoot?.name ?? null,
        });

        this.syncPlayerRuneLoadout(formation.heroId, progress.getEquippedRuneIds());

        const playerTeam = this.createPlayerTeam(preparedBattle);
        if (playerTeam.length === 0) {
            console.error('[BattleBootstrap] Player team generation failed.');
            return;
        }

        const enemyTeam = this.createEnemyTeam(preparedBattle);
        if (enemyTeam.length === 0) {
            console.error('[BattleBootstrap] Enemy team generation failed.');
            return;
        }

        console.log('[BattleBootstrap] created battle teams', {
            playerTeam: playerTeam.map((unit) => ({
                unitId: unit.unitId,
                configId: unit.configId,
                position: unit.getPosition(),
                attackRange: unit.attackRange,
            })),
            enemyTeam: enemyTeam.map((unit) => ({
                unitId: unit.unitId,
                configId: unit.configId,
                position: unit.getPosition(),
                attackRange: unit.attackRange,
            })),
        });

        const battleManager = BattleManager.getInstance();
        const battle = battleManager.initializeBattleFromUnits(playerTeam, enemyTeam, randomSeed);
        if (!battle) {
            console.error('[BattleBootstrap] BattleManager failed to create battle instance.');
            return;
        }

        this.sceneController?.bindBattle(battle, { skipUnitSetup: true });

        if (!this.spawnTeamViews(playerTeam, true, battle) || !this.spawnTeamViews(enemyTeam, false, battle)) {
            console.error('[BattleBootstrap] Failed to spawn one or more battle unit views.');
            this.sceneController?.clearBattleBinding();
            this.clearSpawnedUnitViews();
            battleManager.stopBattle();
            return;
        }

        this.hudController?.bindBattle(battle);
        this.bindBattleLifecycle(battle);
        battleManager.startBattle(battle);
        battleManager.visualTick(0);
        this.accumulator = 0;
        this.started = true;
    }

    private bindBattleLifecycle(battle: IBattleInstance): void {
        battle.eventBus.subscribe('BattleEnded', this.handleBattleEnded, this);
    }

    private unbindBattleLifecycle(): void {
        const battle = BattleManager.getInstance().getCurrentBattle();
        if (!battle) {
            return;
        }

        battle.eventBus.unsubscribe('BattleEnded', this.handleBattleEnded, this);
    }

    private settleBattleFromRuntime(winner: 'player' | 'enemy' | null): void {
        const battle = BattleManager.getInstance().getCurrentBattle();
        if (!battle) {
            return;
        }

        const battleProgress = GameFacade.instance.progress.getBattleProgress();
        const levelId = battleProgress.activeLevelId;
        if (!levelId) {
            console.warn('[BattleBootstrap] Missing active level when battle ended.');
            return;
        }

        try {
            GameFacade.instance.battle.settleBattle({
                levelId,
                outcome: winner === 'player' ? 'victory' : 'defeat',
                starCount: winner === 'player' ? 1 : 0,
                durationSeconds: Math.max(0, Math.floor(battle.elapsedSeconds)),
                enemyCount: battle.enemyTeam.units.length,
            });
            GameFacade.instance.saveGame();
        } catch (error) {
            console.error('[BattleBootstrap] Failed to settle battle.', error);
        }
    }

    private getResolvedFormation(formation: IPlayerFormation): IPlayerFormation {
        const heroId = formation.heroId.trim();
        if (!heroId) {
            throw new Error('[BattleBootstrap] Invalid battle context.');
        }

        return {
            heroId,
            equippedSoulIds: [...formation.equippedSoulIds],
        };
    }

    private getResolvedEnemyIds(enemyIds: readonly string[]): string[] {
        if (enemyIds.length === 0) {
            throw new Error('[BattleBootstrap] Invalid battle context.');
        }

        const resolvedEnemyIds = enemyIds.map((enemyId) => enemyId.trim());
        if (resolvedEnemyIds.some((enemyId) => !enemyId)) {
            throw new Error('[BattleBootstrap] Invalid battle context.');
        }

        return resolvedEnemyIds;
    }

    private getPreparedBattleData(battleContext: IBattleContext): IPreparedBattleData {
        if (battleContext.preparedBattle.playerUnits.length === 0 || battleContext.preparedBattle.enemyUnits.length === 0) {
            throw new Error('[BattleBootstrap] Invalid battle context.');
        }

        return battleContext.preparedBattle;
    }

    private syncPlayerRuneLoadout(heroId: string, equippedRuneIds: readonly number[]): void {
        const runeSystem = RuneSystem.instance;
        const loadout = runeSystem.getLoadout(this.getPlayerRuneRoleId(heroId));

        this.clearLoadout(loadout);
        this.restoreLoadoutFromRuneIds(loadout, equippedRuneIds, runeSystem);
    }

    private clearLoadout(loadout: RuneLoadout): void {
        const slotTypes = [
            RuneSlotType.ATTRIBUTE,
            RuneSlotType.CHARGE,
            RuneSlotType.SKILL,
            RuneSlotType.ULTIMATE,
        ];

        for (const slotType of slotTypes) {
            const slotCount = loadout.getSlotCount(slotType);
            for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
                loadout.clearSlot(slotType, slotIndex);
            }
        }
    }

    private restoreLoadoutFromRuneIds(
        loadout: RuneLoadout,
        runeIds: readonly number[],
        runeSystem: RuneSystem,
    ): void {
        for (const runeId of runeIds) {
            const definition = runeSystem.getRuneDefinition(runeId);
            if (!definition) {
                console.warn(`[BattleBootstrap] Rune definition not found while restoring loadout: ${runeId}`);
                continue;
            }

            const slotType = slotTypeForRuneType(definition.type);
            const slotIndex = loadout.findFirstEmptySlot(slotType);
            if (slotIndex < 0) {
                console.warn(`[BattleBootstrap] No empty rune slot available for rune ${runeId} (${slotType}).`);
                continue;
            }

            loadout.setSlotRune(slotType, slotIndex, runeId);
        }
    }

    private getPlayerRuneRoleId(heroId: string): string {
        return `character_${heroId}`;
    }

    private createPlayerTeam(preparedBattle: IPreparedBattleData): BattleUnit[] {
        return BattleUnitFactory.createPlayerTeamFromPreparedConfigs(preparedBattle.playerUnits);
    }

    private createEnemyTeam(preparedBattle: IPreparedBattleData): BattleUnit[] {
        return BattleUnitFactory.createEnemyTeamFromPreparedConfigs(preparedBattle.enemyUnits);
    }

    private ensureInputController(): void {
        if (!this.sceneController) {
            return;
        }

        let inputController = this.sceneController.getComponent(BattleInputController);
        if (!inputController) {
            inputController = this.sceneController.addComponent(BattleInputController);
        }

        inputController.sceneController = this.sceneController;
        inputController.battleCamera = this.sceneController.battleCamera;
        inputController.enabledInput = true;
        inputController.enableKeyboardInput = true;
        inputController.groundPlaneY = this.sceneController.planeY;
        inputController.groundPlaneZ = 0;
        console.log('[BattleBootstrap] ensured BattleInputController', {
            node: this.sceneController.node.name,
            hasCamera: !!this.sceneController.battleCamera,
            enabledInput: inputController.enabledInput,
            enableKeyboardInput: inputController.enableKeyboardInput,
        });
    }

    private spawnTeamViews(units: readonly BattleUnit[], isPlayerTeam: boolean, battle: IBattleInstance): boolean {
        for (const unit of units) {
            const prefabPaths = this.resolveUnitPrefabPaths(unit, isPlayerTeam);
            if (!this.spawnUnitView(unit, prefabPaths, battle)) {
                return false;
            }
        }

        return true;
    }

    private resolveUnitPrefabPaths(unit: BattleUnit, isPlayerTeam: boolean): string[] {
        const configId = unit.configId.toString().padStart(6, '0');
        if (!isPlayerTeam) {
            return [
                `prefabs/monsters/${configId}`,
                `prefabs/${configId}`,
            ];
        }

        if (unit.unitId.startsWith('soul_')) {
            return [
                `prefabs/souls/${configId}`,
                `prefabs/${configId}`,
            ];
        }

        return [
            `prefabs/characters/${configId}`,
            `prefabs/${configId}`,
        ];
    }

    private spawnUnitView(unit: BattleUnit, prefabPaths: readonly string[], battle: IBattleInstance): boolean {
        let prefab: Prefab | null = null;
        let resolvedPath = '';
        for (const prefabPath of prefabPaths) {
            prefab = RemotePrefabCache.get(BATTLE_PREFAB_BUNDLE, prefabPath) as Prefab | null;
            if (!prefab) {
                continue;
            }

            resolvedPath = prefabPath;
            break;
        }

        if (!prefab) {
            console.error(`[BattleBootstrap] Cached prefab not found: ${BATTLE_PREFAB_BUNDLE}/${prefabPaths.join(', ')}`);
            return false;
        }

        try {
            const node = instantiate(prefab);
            const parent = this.sceneController?.getUnitRoot(unit.teamType === TeamType.Player) ?? this.node;
            node.parent = parent;
            this.applyLayerRecursively(node, parent.layer);

            let view = node.getComponent(BattleUnitView);
            if (!view) {
                view = node.addComponent(BattleUnitView);
            }

            if (this.sceneController) {
                view.useXZPlane = this.sceneController.useXZPlane;
                view.planeY = this.sceneController.planeY;
                view.coordinateScale2D = this.sceneController.coordinateScale2D;
            }
            view.bind(unit, battle.eventBus);
            console.log('[BattleBootstrap] spawned unit view', {
                unitId: unit.unitId,
                configId: unit.configId,
                resolvedPath,
                parent: parent.name,
                nodeName: node.name,
                localPosition: { x: node.position.x, y: node.position.y, z: node.position.z },
                useXZPlane: view.useXZPlane,
                visualRoot: view.visualRoot?.name ?? null,
                active: node.active,
            });
            console.log('[BattleBootstrap] spawned unit view details', {
                unitId: unit.unitId,
                parentLayer: parent.layer,
                nodeLayer: node.layer,
                activeInHierarchy: node.activeInHierarchy,
                worldPosition: { x: node.worldPosition.x, y: node.worldPosition.y, z: node.worldPosition.z },
                scale: { x: node.scale.x, y: node.scale.y, z: node.scale.z },
                visualRootActive: view.visualRoot?.active ?? null,
                visualRootLayer: view.visualRoot?.layer ?? null,
                childNames: node.children.map((child) => child.name),
            });
            this.sceneController?.registerExternalUnitView(unit, view);
            this.spawnedViewNodes.push(node);
            this.retainedPrefabRefs.push(resolvedPath);
            return true;
        } finally {
        }
    }

    private applyLayerRecursively(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) {
            this.applyLayerRecursively(child, layer);
        }
    }

    private clearSpawnedUnitViews(): void {
        for (const node of this.spawnedViewNodes) {
            if (!node.isValid) {
                continue;
            }

            node.destroy();
        }

        this.spawnedViewNodes.length = 0;
        for (const path of this.retainedPrefabRefs) {
            RemotePrefabCache.release(BATTLE_PREFAB_BUNDLE, path);
        }
        this.retainedPrefabRefs.length = 0;
    }
}

