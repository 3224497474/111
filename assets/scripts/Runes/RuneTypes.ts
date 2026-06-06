import type { IUnitAttributes } from '../battle/Types';

/** 默认背包格子数。 */
export const DEFAULT_RUNE_BAG_CAPACITY = 12;

/** 各类型符纹槽数量。 */
export const RUNE_SLOT_COUNT = {
    attribute: 12,
    charge: 3,
    skill: 3,
    ultimate: 1,
} as const;

/** 符纹类型。用于定义表和背包物品。 */
export enum RuneType {
    ATTRIBUTE = 'attribute',
    CHARGE = 'charge',
    SKILL = 'skill',
    ULTIMATE = 'ultimate',
}

/** 槽位类型。用于装备位校验。 */
export enum RuneSlotType {
    ATTRIBUTE = 'attribute',
    CHARGE = 'charge',
    SKILL = 'skill',
    ULTIMATE = 'ultimate',
}

/** 当前第一版支持的供能触发类型。 */
export enum RuneTriggerType {
    DAMAGE_TAKEN = 'damage_taken',
    DAMAGE_DEALT = 'damage_dealt',
}

/** 符纹自动施法时的目标规则。 */
export enum RuneTargetRule {
    ALLY_SELF = 'ally_self',
    ALLY_SINGLE_LOWEST_HP = 'ally_single_lowest_hp',
    ALLY_ALL = 'ally_all',
    ENEMY_SINGLE_FRONT = 'enemy_single_front',
    ENEMY_SINGLE_RANDOM = 'enemy_single_random',
    ENEMY_ALL = 'enemy_all',
}

/** 属性加成允许修改的字段，直接复用战斗属性结构。 */
export type RuneAttributeKey = keyof IUnitAttributes;

/** 单条属性加成。支持固定值和百分比同时存在。 */
export interface IRuneAttributeBonus {
    attribute: RuneAttributeKey;
    flat?: number;
    percent?: number;
}

/**
 * 单条供能规则。
 * linkedSkillRuneIds / linkedSkillTags 用于限制这条供能能喂给哪些技能符纹。
 */
export interface IRuneChargeRule {
    triggerType: RuneTriggerType;
    chargeAmount: number;
    minDamage?: number;
    minRatioOfMaxHp?: number;
    linkedSkillRuneIds?: number[];
    linkedSkillTags?: string[];
    allowUltimate?: boolean;
}

/** 技能符纹或终极符纹的施法绑定信息。 */
export interface IRuneSkillBinding {
    skillId: number;
    chargeRequired: number;
    autoCastCooldownSeconds: number;
    targetRule: RuneTargetRule;
    tags?: string[];
}

/**
 * 符纹总表结构。
 * - 属性符纹：填写 attributeBonuses
 * - 供能符纹：填写 chargeRules
 * - 技能/终极符纹：填写 skillBinding
 */
export interface IRuneDefinition {
    runeId: number;
    name: string;
    description: string;
    type: RuneType;
    maxStack: number;
    icon?: string;
    attributeBonuses?: IRuneAttributeBonus[];
    chargeRules?: IRuneChargeRule[];
    skillBinding?: IRuneSkillBinding;
    runtimeParams?: Record<string, string | number | boolean>;
}

/** 角色符纹档案。一个 roleId 对应一套独立槽位数据。 */
export interface IRoleRuneProfile {
    roleId: string;
    displayName: string;
    description?: string;
    exclusiveSkillIds: number[];
}

/** 背包中的一格堆叠数据。 */
export interface IRuneInventoryStack {
    runeId: number;
    count: number;
}

/** 单个槽位的存档数据。 */
export interface IRuneSlotState {
    slotType: RuneSlotType;
    slotIndex: number;
    runeId: number | null;
}

/** 装备、卸下、加背包等操作统一返回结构。 */
export interface IRuneOperationResult {
    success: boolean;
    message: string;
}

/** 战斗中伤害结算完成后抛出的事件数据。 */
export interface IDamageAppliedEvent {
    source: unknown;
    target: unknown;
    amount: number;
    cause: 'attack' | 'skill' | 'rune';
    skillId?: number;
    sourceRuneId?: number;
}

/** 将符纹类型映射成可装备的槽位类型。 */
export function slotTypeForRuneType(type: RuneType): RuneSlotType {
    switch (type) {
        case RuneType.ATTRIBUTE:
            return RuneSlotType.ATTRIBUTE;
        case RuneType.CHARGE:
            return RuneSlotType.CHARGE;
        case RuneType.SKILL:
            return RuneSlotType.SKILL;
        case RuneType.ULTIMATE:
            return RuneSlotType.ULTIMATE;
    }

    throw new Error(`Unsupported rune type: ${String(type)}`);
}
