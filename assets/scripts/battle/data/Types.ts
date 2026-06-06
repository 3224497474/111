import type { BattleEventBus } from '../event/BattleEventBus';
import type { BattleTeam } from '../core/BattleTeam';
import type { BattleUnit } from '../core/BattleUnit';

// `battle/data` 下的共享类型定义。
// 它与上层 `battle/Types.ts` 基本同构，用于分层目录中的 core/event/data 相互引用。
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
    // 平面坐标 X。
    x: number;
    // 平面坐标 Y。
    y: number;
}

export interface IUnitAttributes {
    // 当前生命值。
    hp: number;
    // 最大生命值。
    maxHp: number;
    // 当前能量值。
    mp: number;
    // 最大能量值。
    maxMp: number;
    // 攻击力。
    attack: number;
    // 防御力。
    defense: number;
    // 移动速度。
    speed: number;
    // 攻击速度。
    attackSpeed: number;
    // 攻击判定距离。
    attackRange: number;
    // 暴击率。
    critRate: number;
    // 暴击伤害倍率。
    critDamage: number;
    // 命中率。
    hitRate: number;
    // 闪避率。
    dodgeRate: number;
    // 每次普攻获得的 MP。
    mpGainPerAttack: number;
}

export interface ISkillConfig {
    // 技能唯一 ID。
    skillId: number;
    // 技能名称。
    name: string;
    // 技能说明。
    description?: string;
    // 技能效果类型。
    effectType: SkillEffectType;
    // 目标选择规则。
    targetRule: SkillTargetRule;
    // 伤害倍率。
    damageRatio?: number;
    // 固定附加伤害。
    flatDamage?: number;
    // 治疗倍率。
    healRatio?: number;
    // 固定附加治疗。
    flatHeal?: number;
    // 技能冷却时间。
    cooldownSeconds?: number;
    // 附带控制时长。
    controlDurationSeconds?: number;
    // 技能投射物速度。
    projectileSpeed?: number;
    // 技能投射物表现 ID。
    projectileEffectId?: string;
    // 技能命中特效 ID。
    impactEffectId?: string;
    // 近战技能命中特效 ID。
    meleeEffectId?: string;
    // 标签集合。
    tags?: string[];
}

export interface IUnitConfig {
    // 单位唯一 ID。
    unitId: string;
    // 角色资源/职业 ID。
    roleId?: string;
    // 配置表主键。
    configId: number;
    // 是否属于玩家侧。
    isPlayer: boolean;
    // 编队位次。
    position: number;
    // 等级。
    level: number;
    // 名称。
    name: string;
    // 元素属性。
    element: ElementType;
    // 技能列表。
    skillIds: number[];
    // 自动释放的内置技能 ID。
    builtinSkillId?: number;
    // 攻击类型。
    attackType?: AttackType;
    // 默认投射物速度。
    projectileSpeed?: number;
    // 默认投射物表现 ID。
    projectileEffectId?: string;
    // 默认命中特效 ID。
    impactEffectId?: string;
    // 默认近战命中特效 ID。
    meleeEffectId?: string;
    // 初始出生位置。
    spawnPosition?: IPoint;
    // 覆盖默认值的基础属性。
    baseAttributes?: Partial<IUnitAttributes>;
}

export interface IProjectileState {
    // 投射物唯一 ID。
    projectileId: string;
    // 施放者单位 ID。
    sourceUnitId: string;
    // 目标单位 ID。
    targetUnitId: string;
    // 起点坐标。
    sourcePosition: IPoint;
    // 目标坐标。
    targetPosition: IPoint;
    // 飞行速度。
    speed: number;
    // 剩余飞行距离。
    remainingDistance: number;
    // 命中伤害值。
    damage: number;
    // 是否暴击。
    isCritical: boolean;
    // 来源符纹 ID。
    sourceRuneId?: number;
    // 来源技能 ID。
    sourceSkillId?: number;
    // 投射物表现资源 ID。
    projectileEffectId?: string;
    // 命中特效资源 ID。
    impactEffectId?: string;
}

export interface IBattleInstance {
    // 战斗实例 ID。
    battleId: string;
    // 战斗当前状态。
    state: BattleState;
    // 玩家队伍。
    playerTeam: BattleTeam;
    // 敌方队伍。
    enemyTeam: BattleTeam;
    // 战斗事件总线。
    eventBus: BattleEventBus;
    // 已运行时间。
    elapsedSeconds: number;
    // 胜者。
    winner: 'player' | 'enemy' | null;
    // 当前存活投射物列表。
    projectiles: IProjectileState[];
}

export interface IBattleDamageResult {
    // 结算出的伤害值。
    damage: number;
    // 是否暴击。
    isCritical: boolean;
    // 目标是否死亡。
    targetDied: boolean;
}

export interface ISkillCastResult {
    // 技能是否成功释放。
    success: boolean;
    // 实际参与结算的目标集合。
    targets: BattleUnit[];
}
