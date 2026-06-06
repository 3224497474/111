import { BattleManager } from '../battle/BattleManager';
import type { IBattleInstance } from '../battle/Types';
import { BattleUnit } from '../battle/BattleUnit';
import { RuneTargetRule } from './RuneTypes';

/**
 * 符纹技能目标解析器。
 * 符纹技能的目标规则单独定义，因此独立做解析。
 */
export class RuneTargetResolver {
    /** 按目标规则从当前战场中挑选目标。 */
    public static resolve(rule: RuneTargetRule, caster: BattleUnit, battle: IBattleInstance): BattleUnit[] {
        const alliesTeam = caster.getTeam()
            ?? (caster.teamType === battle.playerTeam.teamType ? battle.playerTeam : battle.enemyTeam);
        const enemiesTeam = caster.getOpponentTeam()
            ?? (alliesTeam === battle.playerTeam ? battle.enemyTeam : battle.playerTeam);
        const allies = alliesTeam.getAliveUnits();
        const enemies = enemiesTeam.getAliveUnits();

        switch (rule) {
            case RuneTargetRule.ALLY_SELF:
                return caster.isAlive() ? [caster] : [];
            case RuneTargetRule.ALLY_SINGLE_LOWEST_HP:
                return this.pickLowestHpUnit(allies);
            case RuneTargetRule.ALLY_ALL:
                return allies;
            case RuneTargetRule.ENEMY_SINGLE_FRONT:
                return this.pickFrontUnit(enemies);
            case RuneTargetRule.ENEMY_SINGLE_RANDOM:
                return this.pickRandomUnit(enemies);
            case RuneTargetRule.ENEMY_ALL:
                return enemies;
            default:
                return [];
        }
    }

    /** 选出当前血量比例最低的友方单位。 */
    private static pickLowestHpUnit(units: BattleUnit[]): BattleUnit[] {
        if (units.length === 0) return [];

        let target = units[0];
        let lowestRatio = target.maxHp > 0 ? target.hp / target.maxHp : 1;
        for (let i = 1; i < units.length; i++) {
            const unit = units[i];
            const ratio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
            if (ratio < lowestRatio) {
                lowestRatio = ratio;
                target = unit;
            }
        }

        return [target];
    }

    /** 选出站位最靠前的敌人。 */
    private static pickFrontUnit(units: BattleUnit[]): BattleUnit[] {
        if (units.length === 0) return [];
        const sorted = [...units].sort((a, b) => a.position - b.position);
        return [sorted[0]];
    }

    /** 随机选出一个敌人。 */
    private static pickRandomUnit(units: BattleUnit[]): BattleUnit[] {
        if (units.length === 0) return [];
        const index = Math.floor(BattleManager.getInstance().random() * units.length);
        return [units[index]];
    }
}
