import type { BattleEventBus } from './BattleEventBus';
import type { BattleTeam } from './BattleTeam';
import type { BattleUnit } from './BattleUnit';

export enum ElementType {
    NEUTRAL = 'neutral',
    FIRE = 'fire',
    WATER = 'water',
    WIND = 'wind',
    EARTH = 'earth',
    LIGHT = 'light',
    DARK = 'dark',
}

export enum AttackType {
    MELEE = 'melee',
    RANGED = 'ranged',
}

export enum TeamType {
    Player = 1,
    Monster = 2,
}

export enum BattleState {
    PREPARING = 'preparing',
    ONGOING = 'ongoing',
    ENDED = 'ended',
}

export enum SkillEffectType {
    DAMAGE = 'damage',
    HEAL = 'heal',
}

export enum SkillTargetRule {
    SELF = 'self',
    ALLY_LOWEST_HP = 'ally_lowest_hp',
    ALLY_ALL = 'ally_all',
    ENEMY_NEAREST = 'enemy_nearest',
    ENEMY_FRONT = 'enemy_front',
    ENEMY_RANDOM = 'enemy_random',
    ENEMY_ALL = 'enemy_all',
}

export interface IPoint {
    x: number;
    y: number;
}

export interface IUnitBaseAttributes {
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    attackSpeed: number;
    attackRange: number;
    critRate: number;
    critDamage: number;
    hitRate: number;
    dodgeRate: number;
}

export interface IUnitCurrentAttributes {
    hp: number;
}

export interface IUnitAttributes extends IUnitBaseAttributes, IUnitCurrentAttributes {}

export type TModifiableUnitAttribute = keyof IUnitBaseAttributes;

export interface IAttributeModifier {
    attribute: TModifiableUnitAttribute;
    flat?: number;
    percent?: number;
}

export interface IBuffControlFlags {
    preventMove?: boolean;
    preventAttack?: boolean;
    preventSkill?: boolean;
    immuneControl?: boolean;
}

export interface IBuffPeriodicDamage {
    intervalSeconds: number;
    damageRatio?: number;
    flatDamage?: number;
    cause?: 'attack' | 'skill' | 'rune';
}

export interface IBuffConfig {
    buffId: string;
    name?: string;
    durationSeconds: number;
    maxStacks?: number;
    tags?: string[];
    modifiers?: IAttributeModifier[];
    controlFlags?: IBuffControlFlags;
    periodicDamage?: IBuffPeriodicDamage;
}

export interface IAppliedBuffConfig {
    definition: IBuffConfig;
    sourceUnitId?: string;
    sourceSkillId?: number;
    sourceRuneId?: number;
    snapshotAttack?: number;
}

export interface IBuffRuntimeState extends IAppliedBuffConfig {
    instanceId: string;
    remainingSeconds: number;
    tickAccumulator: number;
}

export interface IBuffTickPayload {
    definition: IBuffConfig;
    sourceUnitId?: string;
    sourceSkillId?: number;
    sourceRuneId?: number;
    snapshotAttack: number;
    periodicDamage: IBuffPeriodicDamage;
}

export interface IPlayEffectAction {
    type: 'play_effect';
    effectId?: string;
    effectStyle?: 'attack' | 'skill' | 'impact';
}

export interface IDealDamageAction {
    type: 'deal_damage';
    damageRatio?: number;
    flatDamage?: number;
    effectId?: string;
}

export interface IHealAction {
    type: 'heal';
    healRatio?: number;
    flatHeal?: number;
}

export interface IApplyBuffAction {
    type: 'apply_buff';
    buff: IBuffConfig;
}

export interface ISpawnProjectileAction {
    type: 'spawn_projectile';
    damageRatio?: number;
    flatDamage?: number;
    projectileSpeed?: number;
    projectileEffectId?: string;
    impactEffectId?: string;
    onHitActions?: ISkillAction[];
}

export type ISkillAction =
    | IPlayEffectAction
    | IDealDamageAction
    | IHealAction
    | IApplyBuffAction
    | ISpawnProjectileAction;

export interface ISkillConfig {
    skillId: number;
    name: string;
    description?: string;
    targetRule: SkillTargetRule;
    cooldownSeconds?: number;
    actionList?: ISkillAction[];
    tags?: string[];

    // Legacy fields kept for compatibility with old config data.
    effectType?: SkillEffectType;
    damageRatio?: number;
    flatDamage?: number;
    healRatio?: number;
    flatHeal?: number;
    controlDurationSeconds?: number;
    projectileSpeed?: number;
    projectileEffectId?: string;
    impactEffectId?: string;
    meleeEffectId?: string;
}

export interface IUnitConfig {
    unitId: string;
    roleId?: string;
    configId: number;
    isPlayer: boolean;
    teamType?: TeamType;
    position: number;
    level: number;
    name: string;
    element: ElementType;
    skillIds: number[];
    builtinSkillId?: number;
    attackType?: AttackType;
    projectileSpeed?: number;
    projectileEffectId?: string;
    impactEffectId?: string;
    meleeEffectId?: string;
    spawnPosition?: IPoint;
    baseAttributes?: Partial<IUnitAttributes>;
}

export interface IProjectileState {
    projectileId: string;
    sourceUnitId: string;
    targetUnitId: string;
    sourcePosition: IPoint;
    targetPosition: IPoint;
    previousPosition: IPoint;
    currentPosition: IPoint;
    initialDistance: number;
    speed: number;
    remainingDistance: number;
    damage: number;
    isCritical: boolean;
    sourceRuneId?: number;
    sourceSkillId?: number;
    onHitActions?: ISkillAction[];
    projectileEffectId?: string;
    impactEffectId?: string;
}

export interface IBattleInstance {
    battleId: string;
    state: BattleState;
    playerTeam: BattleTeam;
    enemyTeam: BattleTeam;
    eventBus: BattleEventBus;
    elapsedSeconds: number;
    randomSeed: number;
    winner: 'player' | 'enemy' | null;
    projectiles: IProjectileState[];
}

export interface IBattleDamageResult {
    damage: number;
    isCritical: boolean;
    targetDied: boolean;
}

export interface ISkillCastResult {
    success: boolean;
    targets: BattleUnit[];
}
