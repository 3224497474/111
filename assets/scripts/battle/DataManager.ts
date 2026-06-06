import { ConfigManager } from '../config/ConfigManager';
import type { ISkillConfig } from './Types';

interface ISkillTableRow {
    id?: number | string;
    skillId?: number | string;
    name?: string;
    description?: string;
    desc?: string;
    targetRule?: string;
    cooldownSeconds?: number | string;
    cooldown?: number | string;
    actionList?: ISkillConfig['actionList'];
    tags?: string[] | string;
    effectType?: ISkillConfig['effectType'];
    damageRatio?: number | string;
    flatDamage?: number | string;
    healRatio?: number | string;
    flatHeal?: number | string;
    controlDurationSeconds?: number | string;
    projectileSpeed?: number | string;
    projectileEffectId?: string;
    impactEffectId?: string;
    meleeEffectId?: string;
}

interface IGenericTable<TRow> {
    get(id: string | number): TRow | undefined;
}

export class DataManager {
    private static instance: DataManager | null = null;

    public static getInstance(): DataManager {
        if (!this.instance) {
            this.instance = new DataManager();
        }
        return this.instance;
    }

    private readonly skillConfigs = new Map<number, ISkillConfig>();

    private constructor() {}

    public registerSkillData(configs: ISkillConfig[]): void {
        for (const config of configs) {
            this.skillConfigs.set(config.skillId, { ...config });
        }
    }

    public registerSkill(config: ISkillConfig): void {
        this.skillConfigs.set(config.skillId, { ...config });
    }

    public getSkillData(skillId: number): ISkillConfig | undefined {
        const cached = this.skillConfigs.get(skillId);
        if (cached) {
            return cached;
        }

        const table = (ConfigManager.tables as unknown as { TbSkill?: IGenericTable<ISkillTableRow> } | undefined)?.TbSkill;
        if (!table) {
            return undefined;
        }

        const row = table.get(skillId);
        const normalized = row ? this.normalizeSkillRow(row) : undefined;
        if (!normalized) {
            return undefined;
        }

        this.skillConfigs.set(normalized.skillId, normalized);
        return normalized;
    }

    private normalizeSkillRow(row: ISkillTableRow): ISkillConfig | undefined {
        const skillId = this.toInt(row.skillId ?? row.id);
        const targetRule = row.targetRule;
        if (skillId === undefined || !targetRule) {
            return undefined;
        }

        return {
            skillId,
            name: row.name?.trim() || `skill_${skillId}`,
            description: row.description ?? row.desc,
            targetRule: targetRule as ISkillConfig['targetRule'],
            cooldownSeconds: this.toNumber(row.cooldownSeconds ?? row.cooldown),
            actionList: Array.isArray(row.actionList) ? row.actionList : undefined,
            tags: this.toStringArray(row.tags),
            effectType: row.effectType,
            damageRatio: this.toNumber(row.damageRatio),
            flatDamage: this.toNumber(row.flatDamage),
            healRatio: this.toNumber(row.healRatio),
            flatHeal: this.toNumber(row.flatHeal),
            controlDurationSeconds: this.toNumber(row.controlDurationSeconds),
            projectileSpeed: this.toNumber(row.projectileSpeed),
            projectileEffectId: row.projectileEffectId,
            impactEffectId: row.impactEffectId,
            meleeEffectId: row.meleeEffectId,
        };
    }

    private toInt(value: string | number | undefined): number | undefined {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return undefined;
        }

        return Math.trunc(parsed);
    }

    private toNumber(value: string | number | undefined): number | undefined {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    private toStringArray(value: string[] | string | undefined): string[] | undefined {
        if (Array.isArray(value)) {
            return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
        }
        if (typeof value !== 'string') {
            return undefined;
        }

        const parsed = value
            .split(/[|,;]/)
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
        return parsed.length > 0 ? parsed : undefined;
    }
}
