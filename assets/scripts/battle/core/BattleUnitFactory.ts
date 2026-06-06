import { ConfigManager } from '../../config/ConfigManager';
import type { IPreparedBattleUnitConfig } from '../../data/GameContext';
import { BattleUnit } from '../BattleUnit';
import { MinionAIBattleRuntime } from '../classes/summoner/MinionAIBattleRuntime';
import { AttackType, ElementType, TeamType, type IPoint, type IUnitAttributes, type IUnitConfig } from '../Types';

interface CharacterTableRow {
    id: number | string;
    name?: string;
    hp?: number | string;
    atk?: number | string;
    def?: number | string;
    moveSpeed?: number | string;
    atkSpeed?: number | string;
    critRate?: number | string;
    critDmg?: number | string;
    attackRange?: number | string;
    atkRange?: number | string;
    range?: number | string;
    skillIds?: number[] | string;
    builtinSkillId?: number | string;
}

interface MonsterTableRow extends CharacterTableRow {
    monsterType?: string;
    skillName?: string;
    skillDesc?: string;
}

interface SoulTableRow extends CharacterTableRow {
    cost?: number | string;
    tags?: string | string[];
    respawnTime?: number | string;
}

interface TableAccessor<TRow> {
    get(id: string | number): TRow | undefined;
}

interface BattleConfigTables {
    TbCharacter?: TableAccessor<CharacterTableRow>;
    TbMonster?: TableAccessor<MonsterTableRow>;
    TbSoul?: TableAccessor<SoulTableRow>;
}

export class BattleUnitFactory {
    private static nextUnitSequence = 0;
    private static readonly MONSTER_SPAWN_X = 10;
    private static readonly MONSTER_MOVE_SPEED_MULTIPLIER = 0.5;

    public static preparePlayerUnitConfigs(options: {
        heroId: string;
        equippedSoulIds: readonly string[];
        equippedSkillIds: readonly number[];
        builtinSkillId: number | null;
    }): IPreparedBattleUnitConfig[] {
        const characterConfig = this.getConfigRow<CharacterTableRow>('TbCharacter', options.heroId);
        if (!characterConfig) {
            throw new Error(`[BattleUnitFactory] TbCharacter config not found for id: ${options.heroId}`);
        }

        const defaultSkillIds = this.parseSkillIds(characterConfig.skillIds);
        const defaultBuiltinSkillId = this.toOptionalInt(characterConfig.builtinSkillId);
        const heroConfig = this.buildPreparedUnitConfig({
            row: characterConfig,
            team: TeamType.Player,
            unitKind: 'character',
            unitPrefix: 'character',
            position: 1,
            spawnPosition: { x: 0, y: 0 },
            skillIds: options.equippedSkillIds.length > 0 ? [...options.equippedSkillIds] : defaultSkillIds,
            builtinSkillId: options.builtinSkillId ?? defaultBuiltinSkillId,
        });
        const preparedUnits: IPreparedBattleUnitConfig[] = [heroConfig];

        for (let index = 0; index < options.equippedSoulIds.length; index++) {
            const soulId = options.equippedSoulIds[index];
            const soulConfig = this.getConfigRow<SoulTableRow>('TbSoul', soulId);
            if (!soulConfig) {
                throw new Error(`[BattleUnitFactory] TbSoul config not found for id: ${soulId}`);
            }

            preparedUnits.push(this.buildPreparedUnitConfig({
                row: soulConfig,
                team: TeamType.Player,
                unitKind: 'soul',
                unitPrefix: 'soul',
                position: index + 2,
                spawnPosition: this.getPreparedSoulSpawnPosition(heroConfig.spawnPosition ?? { x: -3, y: 0 }, index),
                roleId: `${heroConfig.roleId}_soul_${this.normalizeId(soulConfig.id)}`,
                masterRoleId: heroConfig.roleId,
            }));
        }

        return preparedUnits;
    }

    public static prepareEnemyUnitConfigs(enemyIds: readonly string[]): IPreparedBattleUnitConfig[] {
        return enemyIds.map((enemyId, index) => {
            const monsterConfig = this.getConfigRow<MonsterTableRow>('TbMonster', enemyId);
            if (!monsterConfig) {
                throw new Error(`[BattleUnitFactory] TbMonster config not found for id: ${enemyId}`);
            }

            const prepared = this.buildPreparedUnitConfig({
                row: monsterConfig,
                team: TeamType.Monster,
                unitKind: 'monster',
                unitPrefix: 'monster',
                position: index + 1,
                spawnPosition: {
                    x: BattleUnitFactory.MONSTER_SPAWN_X + index * 1.4,
                    y: (index - (enemyIds.length - 1) * 0.5) * -1.2,
                },
            });
            prepared.baseAttributes.speed *= BattleUnitFactory.MONSTER_MOVE_SPEED_MULTIPLIER;
            return prepared;
        });
    }

    public static createPlayerTeamFromPreparedConfigs(preparedConfigs: readonly IPreparedBattleUnitConfig[]): BattleUnit[] {
        return this.createUnitsFromPreparedConfigs(preparedConfigs, TeamType.Player);
    }

    public static createEnemyTeamFromPreparedConfigs(preparedConfigs: readonly IPreparedBattleUnitConfig[]): BattleUnit[] {
        return this.createUnitsFromPreparedConfigs(preparedConfigs, TeamType.Monster);
    }

    private static createUnitsFromPreparedConfigs(
        preparedConfigs: readonly IPreparedBattleUnitConfig[],
        expectedTeam: TeamType,
    ): BattleUnit[] {
        const createdUnits: BattleUnit[] = [];
        const unitByRoleId = new Map<string, BattleUnit>();

        for (const preparedConfig of preparedConfigs) {
            if (preparedConfig.isPlayer !== (expectedTeam === TeamType.Player)) {
                throw new Error(`[BattleUnitFactory] Prepared unit team mismatch: ${preparedConfig.unitId}`);
            }

            const unit = new BattleUnit(this.clonePreparedUnitConfig(preparedConfig));

            if (preparedConfig.unitKind === 'soul') {
                const masterRoleId = preparedConfig.masterRoleId?.trim();
                if (!masterRoleId) {
                    throw new Error(`[BattleUnitFactory] Missing soul masterRoleId: ${preparedConfig.unitId}`);
                }

                const master = unitByRoleId.get(masterRoleId);
                if (!master) {
                    throw new Error(`[BattleUnitFactory] Soul master not found for roleId: ${masterRoleId}`);
                }

                unit.addClassRuntime(new MinionAIBattleRuntime(unit, master));
            }

            createdUnits.push(unit);
            unitByRoleId.set(unit.roleId, unit);
        }

        return createdUnits;
    }

    private static clonePreparedUnitConfig(preparedConfig: IPreparedBattleUnitConfig): IUnitConfig {
        return {
            unitId: preparedConfig.unitId,
            roleId: preparedConfig.roleId,
            configId: preparedConfig.configId,
            isPlayer: preparedConfig.isPlayer,
            teamType: preparedConfig.isPlayer ? TeamType.Player : TeamType.Monster,
            position: preparedConfig.position,
            level: preparedConfig.level,
            name: preparedConfig.name,
            element: preparedConfig.element,
            skillIds: [...preparedConfig.skillIds],
            builtinSkillId: preparedConfig.builtinSkillId,
            attackType: preparedConfig.attackType,
            projectileSpeed: preparedConfig.projectileSpeed,
            projectileEffectId: preparedConfig.projectileEffectId,
            impactEffectId: preparedConfig.impactEffectId,
            meleeEffectId: preparedConfig.meleeEffectId,
            spawnPosition: preparedConfig.spawnPosition ? { ...preparedConfig.spawnPosition } : undefined,
            baseAttributes: { ...preparedConfig.baseAttributes },
        };
    }

    private static getConfigRow<TRow>(tableName: keyof BattleConfigTables, configId: string): TRow | undefined {
        const tables = ConfigManager.tables as unknown as BattleConfigTables | undefined;
        const table = tables?.[tableName] as TableAccessor<TRow> | undefined;
        if (!table) {
            console.error(`[BattleUnitFactory] Config table ${String(tableName)} is unavailable.`);
            return undefined;
        }

        const directMatch = table.get(configId);
        if (directMatch) {
            return directMatch;
        }

        const numericId = Number(configId);
        if (!Number.isNaN(numericId)) {
            return table.get(numericId);
        }

        return undefined;
    }

    private static buildPreparedUnitConfig(options: {
        row: CharacterTableRow | MonsterTableRow | SoulTableRow;
        team: TeamType;
        unitKind: IPreparedBattleUnitConfig['unitKind'];
        unitPrefix: string;
        position: number;
        spawnPosition?: IPoint;
        level?: number;
        roleId?: string;
        skillIds?: number[];
        builtinSkillId?: number;
        masterRoleId?: string;
    }): IPreparedBattleUnitConfig {
        const {
            row,
            team,
            unitKind,
            unitPrefix,
            position,
            spawnPosition,
            level = 1,
            roleId,
            skillIds = [],
            builtinSkillId,
            masterRoleId,
        } = options;
        const configId = this.toInt(row.id, 0);
        const normalizedId = this.normalizeId(row.id);
        const baseAttributes = this.buildBaseAttributes(row);
        const attackRange = baseAttributes.attackRange;

        return {
            unitKind,
            masterRoleId,
            unitId: `${unitPrefix}_${normalizedId}_${this.nextSequence()}`,
            roleId: roleId ?? `${unitPrefix}_${normalizedId}`,
            configId,
            isPlayer: team === TeamType.Player,
            teamType: team,
            position,
            level,
            name: row.name?.trim() || `${unitPrefix}_${normalizedId}`,
            element: ElementType.NEUTRAL,
            skillIds: [...skillIds],
            builtinSkillId,
            attackType: attackRange > 3 ? AttackType.RANGED : AttackType.MELEE,
            spawnPosition,
            baseAttributes,
        };
    }

    private static buildBaseAttributes(row: CharacterTableRow | MonsterTableRow | SoulTableRow): IUnitAttributes {
        const hp = this.toNumber(row.hp, 100);

        return {
            hp,
            maxHp: hp,
            attack: this.toNumber(row.atk, 20),
            defense: this.toNumber(row.def, 5),
            speed: this.toNumber(row.moveSpeed, 4),
            attackSpeed: this.toNumber(row.atkSpeed, 1),
            attackRange: this.resolveAttackRange(row),
            critRate: this.toNumber(row.critRate, 0.05),
            critDamage: this.toNumber(row.critDmg, 1.5),
            hitRate: 1,
            dodgeRate: 0,
        };
    }

    private static resolveAttackRange(row: CharacterTableRow | MonsterTableRow | SoulTableRow): number {
        const explicitRange = this.toNumber(row.attackRange, NaN);
        if (!Number.isNaN(explicitRange) && explicitRange > 0) {
            return explicitRange;
        }

        const altRange = this.toNumber(row.atkRange, NaN);
        if (!Number.isNaN(altRange) && altRange > 0) {
            return altRange;
        }

        const genericRange = this.toNumber(row.range, NaN);
        if (!Number.isNaN(genericRange) && genericRange > 0) {
            return genericRange;
        }

        return 1.4;
    }

    private static parseSkillIds(value: number[] | string | undefined): number[] {
        if (Array.isArray(value)) {
            return value
                .map((item) => Number(item))
                .filter((item) => Number.isFinite(item) && item > 0);
        }

        if (typeof value !== 'string') {
            return [];
        }

        return value
            .split(/[|,;]/)
            .map((item) => Number(item.trim()))
            .filter((item) => Number.isFinite(item) && item > 0);
    }

    private static getPreparedSoulSpawnPosition(heroPosition: IPoint, index: number): IPoint {
        const row = Math.floor(index / 2);
        const side = index % 2 === 0 ? -1 : 1;

        return {
            x: heroPosition.x - 1.1 - row * 0.6,
            y: heroPosition.y + side * (0.45 + row * 0.1),
        };
    }

    private static normalizeId(value: number | string): string {
        return String(value).trim();
    }

    private static toInt(value: number | string | undefined, fallback: number): number {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return fallback;
        }

        return Math.trunc(parsed);
    }

    private static toOptionalInt(value: number | string | undefined): number | undefined {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return undefined;
        }

        return Math.trunc(parsed);
    }

    private static toNumber(value: number | string | undefined, fallback: number): number {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    private static nextSequence(): number {
        this.nextUnitSequence += 1;
        return this.nextUnitSequence;
    }
}
