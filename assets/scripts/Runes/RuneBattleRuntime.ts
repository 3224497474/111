import type {
    IAppliedBuffConfig,
    IAttributeModifier,
    IBattleInstance,
    ISkillConfig,
    IUnitAttributes,
    TModifiableUnitAttribute,
} from '../battle/Types';
import { BattleUnit } from '../battle/BattleUnit';
import { DataManager } from '../battle/DataManager';
import { BattleEventBus } from '../battle/BattleEventBus';
import { RuneChargeChangedEventPool, RuneSkillTriggeredEventPool } from '../battle/BattleEventPayloadPools';
import type { RuneSystem } from './RuneSystem';
import { RuneTargetResolver } from './RuneTargetResolver';
import {
    RuneSlotType,
    RuneTriggerType,
    type IDamageAppliedEvent,
    type IRuneAttributeBonus,
    type IRuneChargeRule,
    type IRuneDefinition,
    type RuneAttributeKey,
} from './RuneTypes';

export type RuneTriggeredSkillExecutor = (
    caster: BattleUnit,
    skillConfig: ISkillConfig,
    targets: BattleUnit[],
    sourceRuneId: number,
) => boolean;

interface IChargeRuneState {
    definition: IRuneDefinition;
    slotIndex: number;
}

interface ICombatRuneState {
    definition: IRuneDefinition;
    slotType: RuneSlotType.SKILL | RuneSlotType.ULTIMATE;
    slotIndex: number;
    currentCharge: number;
    cooldownRemaining: number;
}

interface IUnitRuneState {
    roleId: string;
    unit: BattleUnit;
    baseAttributes: IUnitAttributes;
    chargeRunes: IChargeRuneState[];
    combatRunes: ICombatRuneState[];
}

/**
 * 战斗期符纹运行时。
 * 只在当前战斗存在期间生效，不直接参与存档。
 */
export class RuneBattleRuntime {
    private readonly unitStates = new Map<string, IUnitRuneState>();
    private readonly onDamageApplied = (data?: IDamageAppliedEvent) => this.handleDamageApplied(data);
    private readonly buffableAttributes: TModifiableUnitAttribute[] = [
        'maxHp',
        'attack',
        'defense',
        'speed',
        'attackSpeed',
        'attackRange',
        'critRate',
        'critDamage',
        'hitRate',
        'dodgeRate',
    ];

    constructor(
        private readonly system: RuneSystem,
        private readonly battle: IBattleInstance,
        private readonly eventBus: BattleEventBus,
        private readonly executeTriggeredSkill: RuneTriggeredSkillExecutor,
    ) {}

    /**
     * 战斗开始时读取各单位的 roleId，对应到各自的符纹槽配置，
     * 然后建立运行时缓存，避免战斗中反复查表。
     */
    public bind(): void {
        const allUnits = [...this.battle.playerTeam.units, ...this.battle.enemyTeam.units];
        for (const unit of allUnits) {
            const roleId = unit.roleId || String(unit.configId);
            const loadout = this.system.getLoadout(roleId);
            const state: IUnitRuneState = {
                roleId,
                unit,
                baseAttributes: unit.getAttributes(),
                chargeRunes: [],
                combatRunes: [],
            };

            this.collectChargeRunes(state, loadout.getSlots(RuneSlotType.CHARGE));
            this.collectCombatRunes(state, RuneSlotType.SKILL, loadout.getSlots(RuneSlotType.SKILL));
            this.collectCombatRunes(state, RuneSlotType.ULTIMATE, loadout.getSlots(RuneSlotType.ULTIMATE));
            this.applyAttributeRunes(state, loadout.getSlots(RuneSlotType.ATTRIBUTE));
            this.unitStates.set(unit.unitId, state);
        }

        this.eventBus.subscribe('DamageApplied', this.onDamageApplied, this);
    }

    public dispose(): void {
        this.eventBus.unsubscribe('DamageApplied', this.onDamageApplied, this);
        this.unitStates.clear();
    }

    /** 每帧刷新技能符纹和终极符纹的冷却计时。 */
    public update(deltaSeconds: number): void {
        if (deltaSeconds <= 0) return;

        for (const state of this.unitStates.values()) {
            for (const combatRune of state.combatRunes) {
                combatRune.cooldownRemaining = Math.max(0, combatRune.cooldownRemaining - deltaSeconds);
                this.tryAutoCast(state, combatRune);
            }
        }
    }

    private collectChargeRunes(state: IUnitRuneState, slots: ReadonlyArray<number | null>): void {
        slots.forEach((runeId, index) => {
            if (runeId === null) return;
            const definition = this.system.getRuneDefinition(runeId);
            if (!definition) return;
            state.chargeRunes.push({ definition, slotIndex: index });
        });
    }

    private collectCombatRunes(
        state: IUnitRuneState,
        slotType: RuneSlotType.SKILL | RuneSlotType.ULTIMATE,
        slots: ReadonlyArray<number | null>,
    ): void {
        slots.forEach((runeId, index) => {
            if (runeId === null) return;
            const definition = this.system.getRuneDefinition(runeId);
            if (!definition?.skillBinding) return;
            state.combatRunes.push({
                definition,
                slotType,
                slotIndex: index,
                currentCharge: 0,
                cooldownRemaining: 0,
            });
        });
    }

    /**
     * 属性符纹在战斗开始时一次性结算到单位属性上。
     * 当前规则：基础值 * (1 + 百分比) + 固定值。
     */
    private applyAttributeRunes(state: IUnitRuneState, slots: ReadonlyArray<number | null>): void {
        const flatBonus = new Map<RuneAttributeKey, number>();
        const percentBonus = new Map<RuneAttributeKey, number>();

        for (const runeId of slots) {
            if (runeId === null) continue;
            const definition = this.system.getRuneDefinition(runeId);
            if (!definition?.attributeBonuses) continue;
            for (const bonus of definition.attributeBonuses) {
                this.addAttributeBonus(flatBonus, percentBonus, bonus);
            }
        }

        if (flatBonus.size === 0 && percentBonus.size === 0) return;

        const modifiers: IAttributeModifier[] = [];
        for (const key of this.buffableAttributes) {
            const flat = flatBonus.get(key) ?? 0;
            const percent = percentBonus.get(key) ?? 0;
            if (flat === 0 && percent === 0) {
                continue;
            }

            modifiers.push({
                attribute: key,
                flat,
                percent,
            });
        }

        if (modifiers.length > 0) {
            const buff: IAppliedBuffConfig = {
                definition: {
                    buffId: `rune_attribute_bonus_${state.unit.unitId}`,
                    durationSeconds: Number.POSITIVE_INFINITY,
                    maxStacks: 1,
                    tags: ['rune_attribute_bonus'],
                    modifiers,
                },
                sourceUnitId: state.unit.unitId,
            };
            state.unit.addBuff(buff);
        }

        const adjustedMaxHp = this.calculateAdjustedAttribute(state.baseAttributes.maxHp, flatBonus, percentBonus, 'maxHp');
        const targetHp = Math.min(
            adjustedMaxHp,
            this.calculateAdjustedAttribute(state.baseAttributes.hp, flatBonus, percentBonus, 'hp')
                + (adjustedMaxHp - state.baseAttributes.maxHp),
        );
        const current = state.unit.getCurrentAttributes();
        if (targetHp > current.hp) {
            state.unit.heal(targetHp - current.hp);
        }
    }

    private addAttributeBonus(
        flatBonus: Map<RuneAttributeKey, number>,
        percentBonus: Map<RuneAttributeKey, number>,
        bonus: IRuneAttributeBonus,
    ): void {
        if (bonus.flat) {
            flatBonus.set(bonus.attribute, (flatBonus.get(bonus.attribute) ?? 0) + bonus.flat);
        }
        if (bonus.percent) {
            percentBonus.set(bonus.attribute, (percentBonus.get(bonus.attribute) ?? 0) + bonus.percent);
        }
    }

    /**
     * 当前第一版只监听两个供能来源：
     * 1. 造成伤害
     * 2. 受到伤害
     */
    private handleDamageApplied(data?: IDamageAppliedEvent): void {
        if (!data || data.amount <= 0) return;

        const source = data.source as BattleUnit | undefined;
        const target = data.target as BattleUnit | undefined;

        if (source) {
            const state = this.unitStates.get(source.unitId);
            if (state) {
                this.handleChargeTrigger(state, RuneTriggerType.DAMAGE_DEALT, source, data.amount);
            }
        }

        if (target) {
            const state = this.unitStates.get(target.unitId);
            if (state) {
                this.handleChargeTrigger(state, RuneTriggerType.DAMAGE_TAKEN, target, data.amount);
            }
        }
    }

    private handleChargeTrigger(
        state: IUnitRuneState,
        triggerType: RuneTriggerType,
        actor: BattleUnit,
        amount: number,
    ): void {
        for (const chargeRune of state.chargeRunes) {
            const rules = chargeRune.definition.chargeRules ?? [];
            for (const rule of rules) {
                if (rule.triggerType !== triggerType) continue;
                if (!this.matchesChargeRule(rule, actor, amount)) continue;
                this.applyCharge(state, rule);
            }
        }
    }

    private matchesChargeRule(rule: IRuneChargeRule, actor: BattleUnit, amount: number): boolean {
        if (rule.minDamage !== undefined && amount < rule.minDamage) {
            return false;
        }
        if (rule.minRatioOfMaxHp !== undefined && actor.maxHp > 0) {
            if (amount < actor.maxHp * rule.minRatioOfMaxHp) {
                return false;
            }
        }
        return true;
    }

    private applyCharge(state: IUnitRuneState, rule: IRuneChargeRule): void {
        for (const combatRune of state.combatRunes) {
            if (!this.canChargeCombatRune(combatRune, rule)) continue;
            combatRune.currentCharge += rule.chargeAmount;
            const payload = RuneChargeChangedEventPool.get();
            payload.unit = state.unit;
            payload.rune = combatRune.definition;
            payload.currentCharge = combatRune.currentCharge;
            this.eventBus.emit('RuneChargeChanged', payload);
        }
    }

    /** 为了兼容当前 ts target，不使用 Array.prototype.includes。 */
    private canChargeCombatRune(combatRune: ICombatRuneState, rule: IRuneChargeRule): boolean {
        if (combatRune.slotType === RuneSlotType.ULTIMATE) {
            return rule.allowUltimate !== false;
        }

        const skillBinding = combatRune.definition.skillBinding;
        if (!skillBinding) return false;

        if (rule.linkedSkillRuneIds && rule.linkedSkillRuneIds.length > 0) {
            return rule.linkedSkillRuneIds.indexOf(combatRune.definition.runeId) >= 0;
        }

        if (rule.linkedSkillTags && rule.linkedSkillTags.length > 0) {
            const tags = skillBinding.tags ?? [];
            return tags.some((tag) => rule.linkedSkillTags!.indexOf(tag) >= 0);
        }

        return false;
    }

    /**
     * 技能符纹和终极符纹在充能满足后会自动施法。
     * 施法成功后清空充能，并进入配置表指定的冷却秒数。
     */
    private tryAutoCast(state: IUnitRuneState, combatRune: ICombatRuneState): void {
        const binding = combatRune.definition.skillBinding;
        if (!binding) return;
        if (combatRune.currentCharge < binding.chargeRequired) return;
        if (combatRune.cooldownRemaining > 0) return;
        if (!state.unit.isAlive()) return;

        const skillConfig = DataManager.getInstance().getSkillData(binding.skillId);
        if (!skillConfig) {
            console.warn(`[RuneBattleRuntime] Missing skill config: ${binding.skillId}`);
            return;
        }

        const targets = RuneTargetResolver.resolve(binding.targetRule, state.unit, this.battle);
        if (targets.length === 0) {
            return;
        }

        const castSuccess = this.executeTriggeredSkill(
            state.unit,
            skillConfig,
            targets,
            combatRune.definition.runeId,
        );

        if (!castSuccess) return;

        combatRune.currentCharge = 0;
        combatRune.cooldownRemaining = binding.autoCastCooldownSeconds;
        const payload = RuneSkillTriggeredEventPool.get();
        payload.unit = state.unit;
        payload.rune = combatRune.definition;
        payload.targets = targets;
        this.eventBus.emit('RuneSkillTriggered', payload);
    }

    private calculateAdjustedAttribute(
        baseValue: number,
        flatBonus: Map<RuneAttributeKey, number>,
        percentBonus: Map<RuneAttributeKey, number>,
        key: RuneAttributeKey,
    ): number {
        const flat = flatBonus.get(key) ?? 0;
        const percent = percentBonus.get(key) ?? 0;
        let value = baseValue * (1 + percent) + flat;
        if (!this.isFloatAttribute(key)) {
            value = Math.round(value);
        }

        return value;
    }

    private isFloatAttribute(key: RuneAttributeKey): boolean {
        return key === 'critRate'
            || key === 'critDamage'
            || key === 'hitRate'
            || key === 'dodgeRate'
            || key === 'speed'
            || key === 'attackSpeed'
            || key === 'attackRange';
    }
}
