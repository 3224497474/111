import type { ISkillConfig } from './Types';

// `battle/data` 目录下的数据注册器。
// 当前仅缓存技能配置；如果保留分层目录，和上层 DataManager 需要保持接口一致。
export class DataManager {
    private static instance: DataManager | null = null;

    public static getInstance(): DataManager {
        if (!this.instance) {
            this.instance = new DataManager();
        }
        return this.instance;
    }

    // 以 skillId 为键的技能配置缓存。
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
        return this.skillConfigs.get(skillId);
    }
}
