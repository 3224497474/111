import { BattleManager } from '../../BattleManager';
import { BattleEventBus } from '../../BattleEventBus';
import type { IUnitDiedEventPayload } from '../../BattleEventPayloadPools';
import { BattleUnit } from '../../BattleUnit';
import { AttackType, ElementType, TeamType, type IPoint, type IUnitAttributes, type IUnitConfig } from '../../Types';
import { BaseClassRuntime } from '../../core/BaseClassRuntime';
import { SOUL_SLOT_ORDER, type ISoulData } from '../../../Souls/SoulTypes';
import { SoulLoadout } from '../../../Souls/SoulLoadout';
import { SoulSystem } from '../../../Souls/SoulSystem';
import { MinionAIBattleRuntime } from './MinionAIBattleRuntime';

export class SummonerBattleRuntime extends BaseClassRuntime {
    private _eventBus: BattleEventBus | null = null;
    private readonly _summonedUnitIds = new Set<string>();

    public override onEnterBattle(): void {
        const battle = BattleManager.getInstance().getCurrentBattle();
        if (!battle || this._eventBus === battle.eventBus) {
            return;
        }

        this.detachEventBus();
        this._eventBus = battle.eventBus;
        this._eventBus.subscribe('UnitDied', this.onUnitDied, this);
        this.summonEquippedSouls();
    }

    public override onDestroy(): void {
        this.detachEventBus();
        this._summonedUnitIds.clear();
    }

    private readonly onUnitDied = (payload?: IUnitDiedEventPayload): void => {
        const deadUnit = payload?.unit;
        if (!deadUnit) {
            return;
        }

        this.onAnyUnitDeath(deadUnit);
    };

    private onAnyUnitDeath(deadUnit: BattleUnit): void {
        if (!deadUnit.isEnemyOf(this.owner)) {
            return;
        }

        const dropRate = deadUnit.level >= 10 ? 0.5 : 0.1;
        if (BattleManager.getInstance().random() > dropRate) {
            return;
        }

        console.log(`[Summoner] captured soul from monster ${deadUnit.unitId}!`);
        SoulSystem.instance.captureSoul(deadUnit.configId, deadUnit.level, deadUnit.name);
    }

    private summonEquippedSouls(): void {
        const battleManager = BattleManager.getInstance();
        const loadout = SoulLoadout.instance.getSlots();

        for (const slot of SOUL_SLOT_ORDER) {
            const soul = loadout[slot];
            if (!soul) {
                continue;
            }

            const unitId = `${this.owner.unitId}_${slot}_${soul.soulId}`;
            if (this._summonedUnitIds.has(unitId)) {
                continue;
            }

            const minionConfig = this.buildMinionConfig(soul, slot, unitId);
            const minion = new BattleUnit(minionConfig);
            minion.addClassRuntime(new MinionAIBattleRuntime(minion, this.owner));

            if (!battleManager.addUnitToCurrentBattle(minion)) {
                continue;
            }

            this._summonedUnitIds.add(unitId);
            console.log(`[Summoner] summoned minion ${minion.unitId} for ${this.owner.unitId}`);
        }
    }

    private buildMinionConfig(soul: ISoulData, slotKey: string, unitId: string): IUnitConfig {
        const ownerAttributes = this.owner.getAttributes();
        const baseAttributes: Partial<IUnitAttributes> = {
            hp: Math.max(1, Math.round(soul.attributes.hp ?? ownerAttributes.maxHp * 0.45)),
            maxHp: Math.max(1, Math.round(soul.attributes.maxHp ?? soul.attributes.hp ?? ownerAttributes.maxHp * 0.45)),
            attack: Math.max(1, Math.round(soul.attributes.attack ?? ownerAttributes.attack * 0.6)),
            defense: Math.max(0, Math.round(soul.attributes.defense ?? ownerAttributes.defense * 0.6)),
            speed: Math.max(1, soul.attributes.speed ?? ownerAttributes.speed),
            attackSpeed: Math.max(0.5, soul.attributes.attackSpeed ?? ownerAttributes.attackSpeed),
            attackRange: Math.max(1, soul.attributes.attackRange ?? 1.4),
            critRate: soul.attributes.critRate ?? ownerAttributes.critRate,
            critDamage: soul.attributes.critDamage ?? ownerAttributes.critDamage,
            hitRate: soul.attributes.hitRate ?? ownerAttributes.hitRate,
            dodgeRate: soul.attributes.dodgeRate ?? ownerAttributes.dodgeRate,
        };

        const spawnPosition = this.getSummonSpawnPosition(slotKey);
        const attackRange = baseAttributes.attackRange ?? 1.4;

        return {
            unitId,
            roleId: `${this.owner.roleId}_minion_${slotKey}`,
            configId: soul.templateId || soul.monsterId,
            isPlayer: this.owner.isPlayer,
            teamType: this.owner.teamType,
            position: this.getSummonBattlePosition(),
            level: this.owner.level,
            name: soul.name ?? `Soul ${soul.monsterId}`,
            element: this.owner.element ?? ElementType.NEUTRAL,
            skillIds: [],
            attackType: attackRange > 3 ? AttackType.RANGED : AttackType.MELEE,
            spawnPosition,
            baseAttributes,
        };
    }

    private getSummonSpawnPosition(slotKey: string): IPoint {
        const ownerPos = this.owner.pos;
        const side = this.owner.teamType === TeamType.Player ? -1 : 1;
        const offsetBySlot: Record<string, IPoint> = {
            main: { x: 0.7 * side, y: 0 },
            sub_1: { x: 1.1 * side, y: 0.6 },
            sub_2: { x: 1.1 * side, y: -0.6 },
        };
        const offset = offsetBySlot[slotKey] ?? { x: 0.7 * side, y: 0 };
        return {
            x: ownerPos.x + offset.x,
            y: ownerPos.y + offset.y,
        };
    }

    private getSummonBattlePosition(): number {
        return this.owner.position + this._summonedUnitIds.size + 1;
    }

    private detachEventBus(): void {
        if (!this._eventBus) {
            return;
        }

        this._eventBus.unsubscribe('UnitDied', this.onUnitDied, this);
        this._eventBus = null;
    }
}
