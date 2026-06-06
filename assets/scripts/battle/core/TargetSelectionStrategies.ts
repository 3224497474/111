import { BattleManager } from '../BattleManager';
import { SkillTargetRule, type IBattleInstance } from '../Types';
import type { BattleUnit } from '../BattleUnit';

export type TargetResolver = (caster: BattleUnit, battle: IBattleInstance) => BattleUnit[];

const EMPTY_UNIT_SET: ReadonlySet<BattleUnit> = new Set<BattleUnit>();

const getAllies = (caster: BattleUnit, battle: IBattleInstance): ReadonlySet<BattleUnit> => {
    const team = caster.getTeam()
        ?? (caster.teamType === battle.playerTeam.teamType ? battle.playerTeam : battle.enemyTeam);
    return team?.getAliveUnitSet() ?? EMPTY_UNIT_SET;
};

const getEnemies = (caster: BattleUnit, battle: IBattleInstance): ReadonlySet<BattleUnit> => {
    const opponentTeam = caster.getOpponentTeam()
        ?? (caster.teamType === battle.playerTeam.teamType ? battle.enemyTeam : battle.playerTeam);
    return opponentTeam?.getAliveUnitSet() ?? EMPTY_UNIT_SET;
};

const collectUnits = (units: Iterable<BattleUnit>): BattleUnit[] => {
    const results: BattleUnit[] = [];
    for (const unit of units) {
        results.push(unit);
    }
    return results;
};

const pickLowestHpTarget = (units: Iterable<BattleUnit>): BattleUnit[] => {
    let target: BattleUnit | null = null;
    let lowestRatio = Number.POSITIVE_INFINITY;

    for (const unit of units) {
        const ratio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
        if (ratio >= lowestRatio) {
            continue;
        }

        lowestRatio = ratio;
        target = unit;
    }

    return target ? [target] : [];
};

const pickFrontTarget = (units: Iterable<BattleUnit>): BattleUnit[] => {
    let target: BattleUnit | null = null;
    let frontPosition = Number.POSITIVE_INFINITY;

    for (const unit of units) {
        if (unit.position >= frontPosition) {
            continue;
        }

        frontPosition = unit.position;
        target = unit;
    }

    return target ? [target] : [];
};

const pickRandomTarget = (units: ReadonlySet<BattleUnit>): BattleUnit[] => {
    if (units.size === 0) {
        return [];
    }

    const targetIndex = Math.floor(BattleManager.getInstance().random() * units.size);
    let index = 0;
    for (const unit of units) {
        if (index === targetIndex) {
            return [unit];
        }
        index += 1;
    }

    return [];
};

const pickNearestTarget = (caster: BattleUnit, units: Iterable<BattleUnit>): BattleUnit[] => {
    let target: BattleUnit | null = null;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    const casterPosition = caster.pos;

    for (const unit of units) {
        const targetPosition = unit.pos;
        const dx = casterPosition.x - targetPosition.x;
        const dy = casterPosition.y - targetPosition.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared >= nearestDistanceSquared) {
            continue;
        }

        nearestDistanceSquared = distanceSquared;
        target = unit;
    }

    return target ? [target] : [];
};

export const TargetResolvers: Record<SkillTargetRule, TargetResolver> = {
    [SkillTargetRule.SELF]: (caster) => (caster.isAlive() ? [caster] : []),
    [SkillTargetRule.ALLY_LOWEST_HP]: (caster, battle) => pickLowestHpTarget(getAllies(caster, battle)),
    [SkillTargetRule.ALLY_ALL]: (caster, battle) => collectUnits(getAllies(caster, battle)),
    [SkillTargetRule.ENEMY_NEAREST]: (caster, battle) => pickNearestTarget(caster, getEnemies(caster, battle)),
    [SkillTargetRule.ENEMY_FRONT]: (caster, battle) => pickFrontTarget(getEnemies(caster, battle)),
    [SkillTargetRule.ENEMY_RANDOM]: (caster, battle) => pickRandomTarget(getEnemies(caster, battle)),
    [SkillTargetRule.ENEMY_ALL]: (caster, battle) => collectUnits(getEnemies(caster, battle)),
};
