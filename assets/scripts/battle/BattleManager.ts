import { RuneSystem } from '../Runes/RuneSystem';
import { fastRemove } from './ArrayUtils';
import { DataManager } from './DataManager';
import {
    AttackType,
    BattleState,
    TeamType,
    type IAppliedBuffConfig,
    type IBattleDamageResult,
    type IBattleInstance,
    type IBuffConfig,
    type IBuffControlFlags,
    type IBuffTickPayload,
    type IPoint,
    type IProjectileState,
    type ISkillAction,
    type ISkillCastResult,
    type ISkillConfig,
    type IUnitConfig,
} from './Types';
import {
    BasicAttackFiredEventPool,
    BattleEndedEventPool,
    BattleStartedEventPool,
    BuiltinSkillTriggeredEventPool,
    ControlAppliedEventPool,
    DamageAppliedEventPool,
    HealAppliedEventPool,
    MeleeHitEffectRequestedEventPool,
    SkillCastEventPool,
    SkillEffectRequestedEventPool,
    SquadMoveTargetChangedEventPool,
    UnitSpawnedEventPool,
    UnitDiedEventPool,
    UnitHitReactRequestedEventPool,
} from './BattleEventPayloadPools';
import { BattleEventBus } from './BattleEventBus';
import { BattleTeam } from './BattleTeam';
import { BattleUnit } from './BattleUnit';
import { SpatialGrid } from './SpatialGrid';
import { TargetResolvers } from './core/TargetSelectionStrategies';

const _inverseSqrtBuffer = new ArrayBuffer(4);
const _inverseSqrtFloatView = new Float32Array(_inverseSqrtBuffer);
const _inverseSqrtIntView = new Uint32Array(_inverseSqrtBuffer);
const DEFAULT_BATTLE_RANDOM_SEED = 1;

interface IProjectileSpawnOptions {
    sourceSkillId?: number;
    sourceRuneId?: number;
    overrideSpeed?: number;
    overrideProjectileId?: string;
    overrideImpactId?: string;
    onHitActions?: ISkillAction[];
}

interface IActionExecutionContext {
    sourceSkillId?: number;
    sourceRuneId?: number;
    cause: 'attack' | 'skill' | 'rune';
}

export class BattleManager {
    private static instance: BattleManager | null = null;
    private static readonly MELEE_COLLISION_RADIUS = 0.45;
    private static readonly RANGED_COLLISION_RADIUS = 0.35;
    private static readonly TARGET_SPACING_PADDING = 0.05;
    private static readonly SEPARATION_RADIUS = 0.8;
    private static readonly SEPARATION_GRID_CELL_SIZE = 1;
    private static readonly SEPARATION_REPULSION_FORCE = 3.0;
    public static readonly FIXED_LOGIC_STEP = 1 / 30;
    public static getInstance(): BattleManager {
        if (!this.instance) {
            this.instance = new BattleManager();
        }
        return this.instance;
    }

    private battleCounter = 0;
    private projectileCounter = 0;
    private currentBattle: IBattleInstance | null = null;
    private visualAlpha = 0;
    private randomSeed = DEFAULT_BATTLE_RANDOM_SEED;
    private randomState = DEFAULT_BATTLE_RANDOM_SEED;
    private readonly projectilePool: IProjectileState[] = [];
    private readonly enemySeparationGrid = new SpatialGrid<BattleUnit>(BattleManager.SEPARATION_GRID_CELL_SIZE);

    private constructor() {}

    public initializeBattle(
        playerConfigs: IUnitConfig[],
        enemyConfigs: IUnitConfig[],
        randomSeed?: number,
    ): IBattleInstance | null {
        if (playerConfigs.length === 0 || enemyConfigs.length === 0) {
            return null;
        }

        const playerUnits = playerConfigs.map((config, index) => {
            const unit = new BattleUnit({
                ...config,
                teamType: TeamType.Player,
            });
            unit.setPosition(config.spawnPosition ?? { x: -4 + index * 0.8, y: index * 0.6 });
            return unit;
        });

        const enemyUnits = enemyConfigs.map((config, index) => {
            const unit = new BattleUnit({
                ...config,
                teamType: TeamType.Monster,
            });
            unit.setPosition(config.spawnPosition ?? { x: 4 - index * 0.8, y: index * 0.6 });
            return unit;
        });

        return this.initializeBattleFromUnits(playerUnits, enemyUnits, randomSeed);
    }

    public initializeBattleFromUnits(
        playerUnits: BattleUnit[],
        enemyUnits: BattleUnit[],
        randomSeed?: number,
    ): IBattleInstance | null {
        if (playerUnits.length === 0 || enemyUnits.length === 0) {
            return null;
        }

        const playerTeam = new BattleTeam(
            'player_team',
            TeamType.Player,
            playerUnits,
            playerUnits[0]?.getPosition() ?? { x: 0, y: 0 },
        );
        const enemyTeam = new BattleTeam(
            'enemy_team',
            TeamType.Monster,
            enemyUnits,
            this.getAverageUnitPosition(enemyUnits),
        );
        this.setupBattleTeams(playerTeam, enemyTeam);

        const resolvedSeed = this.resetRandomSeed(randomSeed);

        this.battleCounter += 1;
        this.visualAlpha = 0;
        this.currentBattle = {
            battleId: `battle_${this.battleCounter}`,
            state: BattleState.PREPARING,
            playerTeam,
            enemyTeam,
            eventBus: new BattleEventBus(),
            elapsedSeconds: 0,
            randomSeed: resolvedSeed,
            winner: null,
            projectiles: [],
        };
        return this.currentBattle;
    }

    public getCurrentBattle(): IBattleInstance | null {
        return this.currentBattle;
    }

    public registerSkillConfigs(configs: ISkillConfig[]): void {
        DataManager.getInstance().registerSkillData(configs);
    }

    public startBattle(battle: IBattleInstance): void {
        this.currentBattle = battle;
        if (battle.state === BattleState.ONGOING) return;

        this.setupBattleTeams(battle.playerTeam, battle.enemyTeam);
        this.resetRandomSeed(battle.randomSeed);
        this.visualAlpha = 0;
        battle.state = BattleState.ONGOING;
        for (const unit of [...battle.playerTeam.units, ...battle.enemyTeam.units]) {
            unit.capturePrevState();
            unit.onEnterBattle();
        }
        RuneSystem.instance.bindBattle(battle, battle.eventBus, this.executeTriggeredSkill);
        const payload = BattleStartedEventPool.get();
        payload.battle = battle;
        battle.eventBus.emit('BattleStarted', payload);
    }

    public stopBattle(): void {
        if (!this.currentBattle) return;
        this.releaseBattleProjectiles(this.currentBattle);
        for (const unit of [...this.currentBattle.playerTeam.units, ...this.currentBattle.enemyTeam.units]) {
            unit.destroy();
        }
        this.visualAlpha = 0;
        RuneSystem.instance.clearBattleRuntime();
        this.currentBattle.state = BattleState.ENDED;
        this.currentBattle = null;
    }

    public setPlayerMoveTarget(target: IPoint): void {
        if (!this.currentBattle || this.currentBattle.state !== BattleState.ONGOING) return;
        this.currentBattle.playerTeam.setMoveTarget(target);
        const payload = SquadMoveTargetChangedEventPool.get();
        payload.target = target;
        this.currentBattle.eventBus.emit('SquadMoveTargetChanged', payload);
    }

    public clearPlayerMoveTarget(): void {
        if (!this.currentBattle || this.currentBattle.state !== BattleState.ONGOING) return;
        this.currentBattle.playerTeam.setMoveTarget(null);
    }

    public applyControlToUnit(unitId: string, durationSeconds: number): void {
        if (!this.currentBattle || durationSeconds <= 0) return;
        const unit = this.findUnitById(unitId);
        if (!unit || !unit.isAlive()) return;
        unit.applyControl(durationSeconds);
        const payload = ControlAppliedEventPool.get();
        payload.unit = unit;
        payload.durationSeconds = durationSeconds;
        this.currentBattle.eventBus.emit('ControlApplied', payload);
    }

    public addUnitToCurrentBattle(unit: BattleUnit): boolean {
        const battle = this.currentBattle;
        if (!battle) {
            return false;
        }

        const team = unit.teamType === TeamType.Player ? battle.playerTeam : battle.enemyTeam;
        const opposingTeam = team === battle.playerTeam ? battle.enemyTeam : battle.playerTeam;
        unit.bindBattleTeams(team, opposingTeam);
        team.addUnit(unit);
        unit.capturePrevState();

        if (battle.state === BattleState.ONGOING) {
            unit.onEnterBattle();
        }

        const payload = UnitSpawnedEventPool.get();
        payload.unit = unit;
        battle.eventBus.emit('UnitSpawned', payload);

        return true;
    }

    public capturePrevState(): void {
        const battle = this.currentBattle;
        if (!battle || battle.state !== BattleState.ONGOING) {
            return;
        }

        for (const unit of [...battle.playerTeam.units, ...battle.enemyTeam.units]) {
            unit.capturePrevState();
        }

        for (const projectile of battle.projectiles) {
            projectile.previousPosition.x = projectile.currentPosition.x;
            projectile.previousPosition.y = projectile.currentPosition.y;
        }
    }

    public logicTick(deltaSeconds: number): void {
        const battle = this.currentBattle;
        if (!battle || battle.state !== BattleState.ONGOING || deltaSeconds <= 0) return;

        battle.elapsedSeconds += deltaSeconds;
        this.updateUnits(deltaSeconds);
        this.updateUnitLogic(deltaSeconds);
        this.updatePlayerSquad(deltaSeconds);
        this.updateEnemyChase(deltaSeconds);
        this.updateCombat();
        this.updateProjectiles(deltaSeconds);
        RuneSystem.instance.updateBattle(deltaSeconds);
        this.checkBattleEnd();
    }

    public visualTick(alpha: number): void {
        this.visualAlpha = Math.max(0, Math.min(1, alpha));
    }

    public getVisualAlpha(): number {
        return this.visualAlpha;
    }

    public random(): number {
        return this.nextRandom();
    }

    private updateUnits(deltaSeconds: number): void {
        this.forEachAliveUnit((unit) => {
            unit.update(deltaSeconds, this.handleBuffTick);
        });
    }

    private updateUnitLogic(deltaSeconds: number): void {
        this.forEachAliveUnit((unit) => {
            unit.logicUpdate(deltaSeconds);
        });
    }

    private updatePlayerSquad(deltaSeconds: number): void {
        const battle = this.currentBattle;
        if (!battle) return;

        const team = battle.playerTeam;
        const target = team.moveTarget;
        if (!target) return;

        const averageSpeed = team.getAverageMoveSpeed();
        team.anchorPosition = this.moveTowards(team.anchorPosition, target, averageSpeed * deltaSeconds);
        if (this.getDistanceSquared(team.anchorPosition, target) <= 0.05 * 0.05) {
            team.anchorPosition = { ...target };
            team.setMoveTarget(null);
        }

        team.units.forEach((unit, index) => {
            if (!unit.canMove()) return;
            const offset = team.getFormationOffset(index);
            const desiredPosition = {
                x: team.anchorPosition.x + offset.x,
                y: team.anchorPosition.y + offset.y,
            };
            unit.setPosition(this.moveTowards(unit.getPosition(), desiredPosition, averageSpeed * deltaSeconds));
        });
    }

    private updateEnemyChase(deltaSeconds: number): void {
        const battle = this.currentBattle;
        if (!battle) return;

        const enemies = this.getAliveUnitsForTeam(battle.enemyTeam);
        this.rebuildEnemySeparationGrid(enemies);
        for (const unit of enemies) {
            if (!unit.canMove()) continue;
            const target = this.getTrackedTargetForUnit(unit);
            if (!target) continue;
            const unitPosition = unit.pos;
            const targetPosition = target.pos;
            const separationDistance = this.getTargetSeparationDistance(unit, target);
            let nextPosition = unitPosition;

            if (this.getDistanceSquared(unitPosition, targetPosition) < separationDistance * separationDistance) {
                nextPosition = this.separateFromTarget(
                    unitPosition,
                    targetPosition,
                    separationDistance,
                    unit.speed * deltaSeconds,
                );
            } else if (!this.isTargetInRange(unit, target)) {
                nextPosition = this.moveTowardsWithStopDistance(
                    unitPosition,
                    targetPosition,
                    unit.speed * deltaSeconds,
                    this.getChaseStopDistance(unit, target),
                );
            }

            if (nextPosition.x !== unitPosition.x || nextPosition.y !== unitPosition.y) {
                unit.setPosition(nextPosition);
            }

            this.applySeparation(unit, deltaSeconds);
        }
    }

    private rebuildEnemySeparationGrid(units: BattleUnit[]): void {
        this.enemySeparationGrid.clear();
        for (let i = 0; i < units.length; i++) {
            this.enemySeparationGrid.insert(units[i].pos, units[i]);
        }
    }

    private applySeparation(unit: BattleUnit, deltaSeconds: number): void {
        let pushX = 0, pushY = 0;
        const unitPos = unit.pos;

        this.enemySeparationGrid.forEachNearby(unitPos, (ally) => {
            if (ally === unit || !ally.isAlive()) {
                return;
            }
            const allyPos = ally.pos;
            const dx = unitPos.x - allyPos.x;
            const dy = unitPos.y - allyPos.y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= 0.0001 * 0.0001) {
                const pushSign = unit.position <= ally.position ? -1 : 1;
                pushY += pushSign * BattleManager.SEPARATION_REPULSION_FORCE;
                return;
            }
            if (distSq < BattleManager.SEPARATION_RADIUS * BattleManager.SEPARATION_RADIUS) {
                const dist = Math.sqrt(distSq);
                const force = ((BattleManager.SEPARATION_RADIUS - dist) / BattleManager.SEPARATION_RADIUS)
                    * BattleManager.SEPARATION_REPULSION_FORCE;
                pushX += (dx / dist) * force;
                pushY += (dy / dist) * force;
            }
        });
        if (pushX !== 0 || pushY !== 0) {
            unit.setPosition({ x: unitPos.x + pushX * deltaSeconds, y: unitPos.y + pushY * deltaSeconds });
        }
    }

    private updateCombat(): void {
        if (!this.currentBattle) return;

        const units = [
            ...this.getAliveUnitsForTeam(this.currentBattle.playerTeam),
            ...this.getAliveUnitsForTeam(this.currentBattle.enemyTeam),
        ];
        for (const unit of units) {
            if (!unit.isAlive()) continue;

            if (unit.canCastBuiltinSkill()) {
                this.tryCastBuiltinSkill(unit);
            }

            const target = this.getTrackedTargetForUnit(unit);
            if (!target || !target.isAlive()) continue;
            if (!unit.canAttack()) continue;
            if (!this.isTargetInRange(unit, target)) continue;

            this.performBasicAttack(unit, target);
        }
    }

    private performBasicAttack(attacker: BattleUnit, target: BattleUnit): void {
        attacker.beginAttackCooldown();

        const outcome = this.calculateDamage(attacker, target, 1, 0);
        if (outcome.damage <= 0) {
            const payload = BasicAttackFiredEventPool.get();
            payload.source = attacker;
            payload.target = target;
            payload.attackType = attacker.attackType;
            payload.missed = true;
            this.currentBattle?.eventBus.emit('BasicAttackFired', payload);
            return;
        }

        if (attacker.attackType === AttackType.RANGED) {
            this.spawnProjectile(attacker, target, outcome.damage, outcome.isCritical);
        } else {
            const payload = MeleeHitEffectRequestedEventPool.get();
            payload.source = attacker;
            payload.target = target;
            payload.effectId = attacker.meleeEffectId;
            this.currentBattle?.eventBus.emit('MeleeHitEffectRequested', payload);
            this.applyDamage(attacker, target, outcome.damage, outcome.isCritical, 'attack');
        }

        const payload = BasicAttackFiredEventPool.get();
        payload.source = attacker;
        payload.target = target;
        payload.attackType = attacker.attackType;
        payload.missed = false;
        this.currentBattle?.eventBus.emit('BasicAttackFired', payload);
    }

    private spawnProjectile(
        attacker: BattleUnit,
        target: BattleUnit,
        damage: number,
        isCritical: boolean,
        options?: IProjectileSpawnOptions,
    ): void {
        const battle = this.currentBattle;
        if (!battle) return;

        this.projectileCounter += 1;
        const sourcePosition = attacker.pos;
        const targetPosition = target.pos;
        const distanceSquared = this.getDistanceSquared(sourcePosition, targetPosition);
        const distance = this.getDistanceFromSquared(distanceSquared);
        const projectile = this.acquireProjectileState();
        projectile.projectileId = `projectile_${this.projectileCounter}`;
        projectile.sourceUnitId = attacker.unitId;
        projectile.targetUnitId = target.unitId;
        projectile.sourcePosition.x = sourcePosition.x;
        projectile.sourcePosition.y = sourcePosition.y;
        projectile.targetPosition.x = targetPosition.x;
        projectile.targetPosition.y = targetPosition.y;
        projectile.previousPosition.x = sourcePosition.x;
        projectile.previousPosition.y = sourcePosition.y;
        projectile.currentPosition.x = sourcePosition.x;
        projectile.currentPosition.y = sourcePosition.y;
        projectile.initialDistance = distance;
        projectile.speed = Math.max(0.1, options?.overrideSpeed ?? attacker.projectileSpeed);
        projectile.remainingDistance = distance;
        projectile.damage = damage;
        projectile.isCritical = isCritical;
        projectile.sourceRuneId = options?.sourceRuneId;
        projectile.sourceSkillId = options?.sourceSkillId;
        projectile.onHitActions = options?.onHitActions;
        projectile.projectileEffectId = options?.overrideProjectileId ?? attacker.projectileEffectId;
        projectile.impactEffectId = options?.overrideImpactId ?? attacker.impactEffectId;

        battle.projectiles.push(projectile);
        battle.eventBus.emit('ProjectileSpawned', projectile);
    }

    private updateProjectiles(deltaSeconds: number): void {
        const battle = this.currentBattle;
        if (!battle || battle.projectiles.length === 0) return;

        for (let i = battle.projectiles.length - 1; i >= 0; i--) {
            const projectile = battle.projectiles[i];
            const travelDistance = Math.min(projectile.remainingDistance, projectile.speed * deltaSeconds);
            this.moveTowardsInPlace(projectile.currentPosition, projectile.targetPosition, travelDistance);
            projectile.remainingDistance = Math.max(0, projectile.remainingDistance - travelDistance);
            if (projectile.remainingDistance > 0) {
                continue;
            }

            const source = this.findUnitById(projectile.sourceUnitId);
            const target = this.findUnitById(projectile.targetUnitId);
            battle.eventBus.emit('ProjectileImpact', projectile);
            if (source && target && source.isAlive() && target.isAlive()) {
                if (projectile.damage > 0) {
                    this.applyDamage(
                        source,
                        target,
                        projectile.damage,
                        projectile.isCritical,
                        projectile.sourceSkillId ? 'skill' : 'attack',
                        projectile.sourceSkillId,
                        projectile.sourceRuneId,
                    );
                }
                if (target.isAlive() && projectile.onHitActions && projectile.onHitActions.length > 0) {
                    this.executeActionList(source, target, projectile.onHitActions, {
                        sourceSkillId: projectile.sourceSkillId,
                        sourceRuneId: projectile.sourceRuneId,
                        cause: projectile.sourceSkillId ? 'skill' : 'attack',
                    });
                }
            }

            fastRemove(battle.projectiles, i);
            this.releaseProjectileState(projectile);
        }
    }

    private tryCastBuiltinSkill(unit: BattleUnit): void {
        const skillId = unit.builtinSkillId;
        if (skillId === null) return;

        const skillConfig = DataManager.getInstance().getSkillData(skillId);
        if (!skillConfig) return;

        const targets = this.resolveSkillTargets(unit, skillConfig);
        if (targets.length === 0) return;

        const result = this.executeSkill(unit, skillConfig, targets);
        if (!result.success) return;

        unit.beginBuiltinSkillCooldown(skillConfig.cooldownSeconds ?? 0);
        const payload = BuiltinSkillTriggeredEventPool.get();
        payload.unit = unit;
        payload.skillConfig = skillConfig;
        payload.targets = targets;
        this.currentBattle?.eventBus.emit('BuiltinSkillTriggered', payload);
    }

    private readonly executeTriggeredSkill = (
        caster: BattleUnit,
        skillConfig: ISkillConfig,
        targets: BattleUnit[],
        sourceRuneId: number,
    ): boolean => {
        const result = this.executeSkill(caster, skillConfig, targets, sourceRuneId);
        return result.success;
    };

    private executeSkill(
        caster: BattleUnit,
        skillConfig: ISkillConfig,
        targets: BattleUnit[],
        sourceRuneId?: number,
    ): ISkillCastResult {
        if (!this.currentBattle || !caster.isAlive() || targets.length === 0) {
            return { success: false, targets: [] };
        }

        const validTargets = targets.filter((target) => target.isAlive());
        if (validTargets.length === 0) {
            return { success: false, targets: [] };
        }

        const actionList = this.resolveSkillActionList(caster, skillConfig);
        for (const target of validTargets) {
            this.executeActionList(caster, target, actionList, {
                sourceSkillId: skillConfig.skillId,
                sourceRuneId,
                cause: 'skill',
            });
        }

        const payload = SkillCastEventPool.get();
        payload.caster = caster;
        payload.skillConfig = skillConfig;
        payload.targets = validTargets;
        payload.sourceRuneId = sourceRuneId;
        this.currentBattle.eventBus.emit('SkillCast', payload);
        return { success: true, targets: validTargets };
    }

    private applyDamage(
        source: BattleUnit,
        target: BattleUnit,
        damage: number,
        isCritical: boolean,
        cause: 'attack' | 'skill' | 'rune',
        skillId?: number,
        sourceRuneId?: number,
    ): IBattleDamageResult {
        const targetDied = target.takeDamage(damage);
        const damagePayload = DamageAppliedEventPool.get();
        damagePayload.source = source;
        damagePayload.target = target;
        damagePayload.amount = damage;
        damagePayload.cause = cause;
        damagePayload.skillId = skillId;
        damagePayload.sourceRuneId = sourceRuneId;
        damagePayload.isCritical = isCritical;
        this.currentBattle?.eventBus.emit('DamageApplied', damagePayload);

        if (target.isAlive()) {
            const hitReactPayload = UnitHitReactRequestedEventPool.get();
            hitReactPayload.source = source;
            hitReactPayload.target = target;
            hitReactPayload.amount = damage;
            hitReactPayload.cause = cause;
            hitReactPayload.skillId = skillId;
            hitReactPayload.sourceRuneId = sourceRuneId;
            hitReactPayload.isCritical = isCritical;
            this.currentBattle?.eventBus.emit('UnitHitReactRequested', hitReactPayload);
        }

        if (targetDied) {
            target.getTeam()?.markUnitDead(target);
            const diedPayload = UnitDiedEventPool.get();
            diedPayload.unit = target;
            diedPayload.killer = source;
            diedPayload.cause = cause;
            diedPayload.skillId = skillId;
            diedPayload.sourceRuneId = sourceRuneId;
            this.currentBattle?.eventBus.emit('UnitDied', diedPayload);
        }

        return {
            damage,
            isCritical,
            targetDied,
        };
    }

    private calculateDamage(
        attacker: BattleUnit,
        defender: BattleUnit,
        damageRatio: number,
        flatDamage: number,
    ): IBattleDamageResult {
        const hitChance = Math.max(0.1, Math.min(1, attacker.hitRate - defender.dodgeRate));
        const hitRoll = this.nextRandom();
        if (hitRoll > hitChance) {
            return { damage: 0, isCritical: false, targetDied: false };
        }

        const critRoll = this.nextRandom();
        const isCritical = critRoll <= attacker.critRate;
        const attackBase = attacker.attack * Math.max(0, damageRatio);
        const defenseMultiplier = 100 / (100 + Math.max(0, defender.defense));
        let damage = attackBase * defenseMultiplier + flatDamage;
        if (isCritical) {
            damage *= Math.max(1, attacker.critDamage);
        }

        return {
            damage: Math.max(1, Math.round(damage)),
            isCritical,
            targetDied: false,
        };
    }

    private resolveSkillActionList(caster: BattleUnit, skillConfig: ISkillConfig): readonly ISkillAction[] {
        if (skillConfig.actionList && skillConfig.actionList.length > 0) {
            return skillConfig.actionList;
        }

        return this.buildLegacySkillActionList(caster, skillConfig);
    }

    private buildLegacySkillActionList(caster: BattleUnit, skillConfig: ISkillConfig): ISkillAction[] {
        const controlBuff = this.createLegacyControlBuff(skillConfig.controlDurationSeconds);
        const isHealSkill = skillConfig.effectType === 'heal'
            || skillConfig.healRatio !== undefined
            || skillConfig.flatHeal !== undefined;
        if (isHealSkill) {
            return [
                {
                    type: 'heal',
                    healRatio: skillConfig.healRatio ?? 0,
                    flatHeal: skillConfig.flatHeal ?? 0,
                },
            ];
        }

        if (caster.attackType === AttackType.RANGED) {
            const onHitActions: ISkillAction[] = controlBuff ? [{ type: 'apply_buff', buff: controlBuff }] : [];
            return [
                {
                    type: 'spawn_projectile',
                    damageRatio: skillConfig.damageRatio ?? 1,
                    flatDamage: skillConfig.flatDamage ?? 0,
                    projectileSpeed: skillConfig.projectileSpeed,
                    projectileEffectId: skillConfig.projectileEffectId,
                    impactEffectId: skillConfig.impactEffectId,
                    onHitActions,
                },
            ];
        }

        const actions: ISkillAction[] = [];
        if (skillConfig.meleeEffectId ?? caster.meleeEffectId) {
            actions.push({
                type: 'play_effect',
                effectId: skillConfig.meleeEffectId ?? caster.meleeEffectId,
                effectStyle: 'skill',
            });
        }
        actions.push({
            type: 'deal_damage',
            damageRatio: skillConfig.damageRatio ?? 1,
            flatDamage: skillConfig.flatDamage ?? 0,
        });
        if (controlBuff) {
            actions.push({
                type: 'apply_buff',
                buff: controlBuff,
            });
        }
        return actions;
    }

    private createLegacyControlBuff(durationSeconds?: number): IBuffConfig | null {
        if (!durationSeconds || durationSeconds <= 0) {
            return null;
        }

        return {
            buffId: 'legacy_skill_control',
            durationSeconds,
            maxStacks: 1,
            tags: ['control'],
            controlFlags: {
                preventMove: true,
                preventAttack: true,
                preventSkill: true,
            },
        };
    }

    private executeActionList(
        caster: BattleUnit,
        target: BattleUnit,
        actionList: readonly ISkillAction[],
        context: IActionExecutionContext,
    ): void {
        for (const action of actionList) {
            this.executeAction(caster, target, action, context);
        }
    }

    private executeAction(
        caster: BattleUnit,
        target: BattleUnit,
        action: ISkillAction,
        context: IActionExecutionContext,
    ): void {
        if (!this.currentBattle) {
            return;
        }

        switch (action.type) {
            case 'play_effect':
                this.emitEffectForAction(caster, target, action.effectId, action.effectStyle, context);
                return;
            case 'deal_damage': {
                if (!target.isAlive()) {
                    return;
                }
                this.emitEffectForAction(caster, target, action.effectId, 'skill', context);
                const outcome = this.calculateDamage(
                    caster,
                    target,
                    action.damageRatio ?? 1,
                    action.flatDamage ?? 0,
                );
                if (outcome.damage <= 0) {
                    return;
                }
                this.applyDamage(
                    caster,
                    target,
                    outcome.damage,
                    outcome.isCritical,
                    context.cause,
                    context.sourceSkillId,
                    context.sourceRuneId,
                );
                return;
            }
            case 'heal': {
                if (!target.isAlive()) {
                    return;
                }
                const healAmount = this.calculateHealAmount(
                    caster,
                    action.healRatio ?? 0,
                    action.flatHeal ?? 0,
                );
                target.heal(healAmount);
                const payload = HealAppliedEventPool.get();
                payload.source = caster;
                payload.target = target;
                payload.amount = healAmount;
                payload.skillId = context.sourceSkillId ?? 0;
                payload.sourceRuneId = context.sourceRuneId;
                this.currentBattle.eventBus.emit('HealApplied', payload);
                return;
            }
            case 'apply_buff': {
                if (!target.isAlive()) {
                    return;
                }
                const buff: IAppliedBuffConfig = {
                    definition: action.buff,
                    sourceUnitId: caster.unitId,
                    sourceSkillId: context.sourceSkillId,
                    sourceRuneId: context.sourceRuneId,
                    snapshotAttack: caster.attack,
                };
                if (target.addBuff(buff)) {
                    this.emitControlAppliedForBuff(target, buff.definition, caster, context.sourceSkillId);
                }
                return;
            }
            case 'spawn_projectile': {
                if (!target.isAlive()) {
                    return;
                }
                const hasExplicitDamage = action.damageRatio !== undefined || action.flatDamage !== undefined;
                let damage = 0;
                let isCritical = false;
                if (hasExplicitDamage) {
                    const outcome = this.calculateDamage(
                        caster,
                        target,
                        action.damageRatio ?? 1,
                        action.flatDamage ?? 0,
                    );
                    if (outcome.damage <= 0) {
                        return;
                    }
                    damage = outcome.damage;
                    isCritical = outcome.isCritical;
                }
                if (damage <= 0 && (!action.onHitActions || action.onHitActions.length === 0)) {
                    return;
                }
                this.spawnProjectile(caster, target, damage, isCritical, {
                    sourceSkillId: context.sourceSkillId,
                    sourceRuneId: context.sourceRuneId,
                    overrideSpeed: action.projectileSpeed,
                    overrideProjectileId: action.projectileEffectId,
                    overrideImpactId: action.impactEffectId,
                    onHitActions: action.onHitActions,
                });
                return;
            }
        }
    }

    private emitEffectForAction(
        source: BattleUnit,
        target: BattleUnit,
        effectId: string | undefined,
        effectStyle: 'attack' | 'skill' | 'impact' | undefined,
        context: IActionExecutionContext,
    ): void {
        const battle = this.currentBattle;
        if (!battle || !effectId) {
            return;
        }

        if (effectStyle === 'attack') {
            const payload = MeleeHitEffectRequestedEventPool.get();
            payload.source = source;
            payload.target = target;
            payload.effectId = effectId;
            battle.eventBus.emit('MeleeHitEffectRequested', payload);
            return;
        }

        const payload = SkillEffectRequestedEventPool.get();
        payload.source = source;
        payload.target = target;
        payload.effectId = effectId;
        payload.skillId = context.sourceSkillId ?? 0;
        payload.sourceRuneId = context.sourceRuneId;
        battle.eventBus.emit('SkillEffectRequested', payload);
    }

    private emitControlAppliedForBuff(
        target: BattleUnit,
        buff: IBuffConfig,
        source: BattleUnit,
        skillId?: number,
    ): void {
        const battle = this.currentBattle;
        if (!battle || !this.hasActiveControlFlag(buff.controlFlags)) {
            return;
        }

        const payload = ControlAppliedEventPool.get();
        payload.unit = target;
        payload.durationSeconds = buff.durationSeconds;
        payload.source = source;
        payload.skillId = skillId;
        battle.eventBus.emit('ControlApplied', payload);
    }

    private hasActiveControlFlag(controlFlags?: IBuffControlFlags): boolean {
        return !!(controlFlags?.preventMove || controlFlags?.preventAttack || controlFlags?.preventSkill);
    }

    private readonly handleBuffTick = (target: BattleUnit, payload: IBuffTickPayload): void => {
        if (!target.isAlive()) {
            return;
        }

        const damage = this.calculatePeriodicDamage(target, payload);
        if (damage <= 0) {
            return;
        }

        const source = payload.sourceUnitId ? this.findUnitById(payload.sourceUnitId) : null;
        this.applyDamage(
            source ?? target,
            target,
            damage,
            false,
            payload.periodicDamage.cause ?? 'skill',
            payload.sourceSkillId,
            payload.sourceRuneId,
        );
    };

    private calculatePeriodicDamage(target: BattleUnit, payload: IBuffTickPayload): number {
        const damageRatio = payload.periodicDamage.damageRatio ?? 0;
        const flatDamage = payload.periodicDamage.flatDamage ?? 0;
        if (damageRatio <= 0 && flatDamage <= 0) {
            return 0;
        }

        const attackBase = payload.snapshotAttack * Math.max(0, damageRatio);
        const defenseMultiplier = 100 / (100 + Math.max(0, target.defense));
        const damage = attackBase * defenseMultiplier + flatDamage;
        return Math.max(1, Math.round(damage));
    }

    private calculateHealAmount(caster: BattleUnit, healRatio: number, flatHeal: number): number {
        return Math.max(1, Math.round(caster.attack * healRatio + flatHeal));
    }

    private resolveSkillTargets(caster: BattleUnit, skillConfig: ISkillConfig): BattleUnit[] {
        const battle = this.currentBattle;
        if (!battle) return [];

        const resolver = TargetResolvers[skillConfig.targetRule];
        if (resolver) {
            return resolver(caster, battle);
        }

        console.warn(`Unknown target rule: ${skillConfig.targetRule}`);
        return [];
    }

    private findNearestTarget(unit: BattleUnit): BattleUnit | null {
        const enemyTeam = unit.getOpponentTeam();
        if (!enemyTeam) return null;

        let nearest: BattleUnit | null = null;
        let nearestDistance = Number.POSITIVE_INFINITY;
        const unitPosition = unit.getPosition();
        for (const candidate of enemyTeam.getAliveUnitSet()) {
            const distanceSquared = this.getDistanceSquared(unitPosition, candidate.getPosition());
            if (distanceSquared < nearestDistance) {
                nearestDistance = distanceSquared;
                nearest = candidate;
            }
        }
        return nearest;
    }

    private isTargetInRange(unit: BattleUnit, target: BattleUnit): boolean {
        return this.getDistanceSquared(unit.getPosition(), target.getPosition()) <= unit.attackRange * unit.attackRange;
    }

    private getUnitCollisionRadius(unit: BattleUnit): number {
        return unit.attackType === AttackType.RANGED
            ? BattleManager.RANGED_COLLISION_RADIUS
            : BattleManager.MELEE_COLLISION_RADIUS;
    }

    private getTargetSeparationDistance(unit: BattleUnit, target: BattleUnit): number {
        return this.getUnitCollisionRadius(unit)
            + this.getUnitCollisionRadius(target)
            + BattleManager.TARGET_SPACING_PADDING;
    }

    private getChaseStopDistance(unit: BattleUnit, target: BattleUnit): number {
        const safeAttackDistance = Math.max(0.1, unit.attackRange - 0.05);
        return Math.min(this.getTargetSeparationDistance(unit, target), safeAttackDistance);
    }

    private getTrackedTargetForUnit(unit: BattleUnit): BattleUnit | null {
        const trackedTarget = unit.getTrackedTarget();
        if (trackedTarget && trackedTarget.isAlive() && !unit.needsTargetRefresh()) {
            return trackedTarget;
        }

        const nextTarget = this.findNearestTarget(unit);
        unit.resolveTrackedTarget(nextTarget);
        return nextTarget;
    }

    private findUnitById(unitId: string): BattleUnit | null {
        const battle = this.currentBattle;
        if (!battle) return null;

        for (const unit of [...battle.playerTeam.units, ...battle.enemyTeam.units]) {
            if (unit.unitId === unitId) {
                return unit;
            }
        }
        return null;
    }

    private checkBattleEnd(): void {
        const battle = this.currentBattle;
        if (!battle || battle.state !== BattleState.ONGOING) return;

        if (battle.playerTeam.isAllDead()) {
            battle.state = BattleState.ENDED;
            battle.winner = 'enemy';
        } else if (battle.enemyTeam.isAllDead()) {
            battle.state = BattleState.ENDED;
            battle.winner = 'player';
        } else {
            return;
        }

        RuneSystem.instance.clearBattleRuntime();
        this.visualAlpha = 0;
        const payload = BattleEndedEventPool.get();
        payload.battle = battle;
        payload.winner = battle.winner;
        battle.eventBus.emit('BattleEnded', payload);
    }

    private moveTowards(from: IPoint, to: IPoint, maxDistance: number): IPoint {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= 0.0001 * 0.0001 || maxDistance * maxDistance >= distanceSquared) {
            return { ...to };
        }

        const inverseDistance = this.inverseSqrt(distanceSquared);
        const ratio = Math.min(1, maxDistance * inverseDistance);
        return {
            x: from.x + dx * ratio,
            y: from.y + dy * ratio,
        };
    }

    private moveTowardsWithStopDistance(from: IPoint, to: IPoint, maxDistance: number, stopDistance: number): IPoint {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distanceSquared = dx * dx + dy * dy;
        const stopDistanceClamped = Math.max(0, stopDistance);
        if (distanceSquared <= stopDistanceClamped * stopDistanceClamped) {
            return { ...from };
        }

        const distance = this.getDistanceFromSquared(distanceSquared);
        const remainingDistance = Math.max(0, distance - stopDistanceClamped);
        return this.moveTowards(from, to, Math.min(maxDistance, remainingDistance));
    }

    private separateFromTarget(from: IPoint, target: IPoint, desiredDistance: number, maxDistance: number): IPoint {
        const dx = from.x - target.x;
        const dy = from.y - target.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared >= desiredDistance * desiredDistance) {
            return { ...from };
        }

        if (distanceSquared <= 0.0001 * 0.0001) {
            return {
                x: from.x + Math.min(maxDistance, desiredDistance),
                y: from.y,
            };
        }

        const distance = this.getDistanceFromSquared(distanceSquared);
        const pushDistance = Math.min(maxDistance, desiredDistance - distance);
        const inverseDistance = this.inverseSqrt(distanceSquared);
        return {
            x: from.x + dx * inverseDistance * pushDistance,
            y: from.y + dy * inverseDistance * pushDistance,
        };
    }

    private getDistanceFromSquared(distanceSquared: number): number {
        if (distanceSquared <= 0) {
            return 0;
        }

        return distanceSquared * this.inverseSqrt(distanceSquared);
    }

    private inverseSqrt(value: number): number {
        if (value <= 0) {
            return 0;
        }

        _inverseSqrtFloatView[0] = value;
        _inverseSqrtIntView[0] = 0x5f3759df - (_inverseSqrtIntView[0] >> 1);

        let estimate = _inverseSqrtFloatView[0];
        const halfValue = 0.5 * value;
        estimate = estimate * (1.5 - halfValue * estimate * estimate);
        estimate = estimate * (1.5 - halfValue * estimate * estimate);
        return estimate;
    }

    private getDistanceSquared(a: IPoint, b: IPoint): number {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return dx * dx + dy * dy;
    }

    private getAverageUnitPosition(units: readonly BattleUnit[]): IPoint {
        if (units.length === 0) {
            return { x: 0, y: 0 };
        }

        let x = 0;
        let y = 0;
        for (const unit of units) {
            const position = unit.getPosition();
            x += position.x;
            y += position.y;
        }

        return {
            x: x / units.length,
            y: y / units.length,
        };
    }

    private setupBattleTeams(playerTeam: BattleTeam, enemyTeam: BattleTeam): void {
        playerTeam.bindOpponentTeam(enemyTeam);
        enemyTeam.bindOpponentTeam(playerTeam);
        playerTeam.rebuildAliveUnits();
        enemyTeam.rebuildAliveUnits();

        for (const unit of playerTeam.units) {
            unit.bindBattleTeams(playerTeam, enemyTeam);
        }
        for (const unit of enemyTeam.units) {
            unit.bindBattleTeams(enemyTeam, playerTeam);
        }
    }

    private getAliveUnitsForTeam(team: BattleTeam): BattleUnit[] {
        return Array.from(team.getAliveUnitSet());
    }

    private acquireProjectileState(): IProjectileState {
        const projectile = this.projectilePool.pop();
        if (projectile) {
            return projectile;
        }

        return {
            projectileId: '',
            sourceUnitId: '',
            targetUnitId: '',
            sourcePosition: { x: 0, y: 0 },
            targetPosition: { x: 0, y: 0 },
            previousPosition: { x: 0, y: 0 },
            currentPosition: { x: 0, y: 0 },
            initialDistance: 0,
            speed: 0,
            remainingDistance: 0,
            damage: 0,
            isCritical: false,
            sourceRuneId: undefined,
            sourceSkillId: undefined,
            onHitActions: undefined,
            projectileEffectId: undefined,
            impactEffectId: undefined,
        };
    }

    private releaseProjectileState(projectile: IProjectileState): void {
        projectile.projectileId = '';
        projectile.sourceUnitId = '';
        projectile.targetUnitId = '';
        projectile.sourcePosition.x = 0;
        projectile.sourcePosition.y = 0;
        projectile.targetPosition.x = 0;
        projectile.targetPosition.y = 0;
        projectile.previousPosition.x = 0;
        projectile.previousPosition.y = 0;
        projectile.currentPosition.x = 0;
        projectile.currentPosition.y = 0;
        projectile.initialDistance = 0;
        projectile.speed = 0;
        projectile.remainingDistance = 0;
        projectile.damage = 0;
        projectile.isCritical = false;
        projectile.sourceRuneId = undefined;
        projectile.sourceSkillId = undefined;
        projectile.onHitActions = undefined;
        projectile.projectileEffectId = undefined;
        projectile.impactEffectId = undefined;
        this.projectilePool.push(projectile);
    }

    private releaseBattleProjectiles(battle: IBattleInstance): void {
        for (let i = battle.projectiles.length - 1; i >= 0; i--) {
            this.releaseProjectileState(battle.projectiles[i]);
        }
        battle.projectiles.length = 0;
    }

    private resetRandomSeed(seed?: number): number {
        const normalizedSeed = this.normalizeRandomSeed(seed);
        this.randomSeed = normalizedSeed;
        this.randomState = normalizedSeed;
        return normalizedSeed;
    }

    private normalizeRandomSeed(seed?: number): number {
        if (typeof seed !== 'number' || !Number.isFinite(seed)) {
            return DEFAULT_BATTLE_RANDOM_SEED;
        }

        const normalized = Math.floor(seed) >>> 0;
        return normalized === 0 ? DEFAULT_BATTLE_RANDOM_SEED : normalized;
    }

    private nextRandom(): number {
        let state = this.randomState >>> 0;
        state += 0x6D2B79F5;
        let mixed = Math.imul(state ^ (state >>> 15), state | 1);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
        this.randomState = state >>> 0;
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    }

    private forEachAliveUnit(callback: (unit: BattleUnit) => void): void {
        const battle = this.currentBattle;
        if (!battle) {
            return;
        }

        for (const unit of battle.playerTeam.getAliveUnitSet()) {
            callback(unit);
        }
        for (const unit of battle.enemyTeam.getAliveUnitSet()) {
            callback(unit);
        }
    }

    private moveTowardsInPlace(from: IPoint, to: Readonly<IPoint>, maxDistance: number): void {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= 0.0001 * 0.0001 || maxDistance * maxDistance >= distanceSquared) {
            from.x = to.x;
            from.y = to.y;
            return;
        }

        const inverseDistance = this.inverseSqrt(distanceSquared);
        const ratio = Math.min(1, maxDistance * inverseDistance);
        from.x += dx * ratio;
        from.y += dy * ratio;
    }
}
