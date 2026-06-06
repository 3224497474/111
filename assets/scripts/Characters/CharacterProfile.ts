import { CharacterGender, ICharacterProfile } from "./CharacterTypes";
import { CharacterAttributes } from "./CharacterAttributes";
import { CharacterStateManager } from "./CharacterStateManager";

/**
 * CHAR-BASE: 基础信息与档案
 * 管理角色的基础信息和档案数据
 */
export class CharacterProfile {
    private profile: ICharacterProfile;
    private attributes: CharacterAttributes;
    private stateManager: CharacterStateManager;
    private level: number = 1;
    private experience: number = 0;
    private totalExperience: number = 0; // 累计经验
    
    constructor(profile: ICharacterProfile) {
        this.profile = {
            ...profile,
            createdDate: new Date(),
        };
        this.attributes = new CharacterAttributes();
        this.stateManager = new CharacterStateManager();
    }

    /**
     * 获取角色ID
     */
    getId(): string {
        return this.profile.id;
    }

    /**
     * 获取角色名字
     */
    getName(): string {
        return this.profile.name;
    }

    /**
     * 设置角色名字
     */
    setName(name: string): void {
        this.profile.name = name;
    }

    /**
     * 获取角色年龄
     */
    getAge(): number {
        return this.profile.age;
    }

    /**
     * 增加角色年龄
     */
    addAge(years: number = 1): void {
        this.profile.age += years;
    }

    /**
     * 获取角色性别
     */
    getGender(): CharacterGender {
        return this.profile.gender;
    }

    /**
     * 获取背景故事
     */
    getBackground(): string {
        return this.profile.background;
    }

    /**
     * 设置背景故事
     */
    setBackground(background: string): void {
        this.profile.background = background;
    }

    /**
     * 获取头像路径
     */
    getAvatar(): string {
        return this.profile.avatar;
    }

    /**
     * 设置头像路径
     */
    setAvatar(path: string): void {
        this.profile.avatar = path;
    }

    /**
     * 获取立绘路径
     */
    getIllustration(): string {
        return this.profile.illustration;
    }

    /**
     * 设置立绘路径
     */
    setIllustration(path: string): void {
        this.profile.illustration = path;
    }

    /**
     * 获取角色描述
     */
    getDescription(): string {
        return this.profile.description;
    }

    /**
     * 设置角色描述
     */
    setDescription(description: string): void {
        this.profile.description = description;
    }

    /**
     * 获取创建日期
     */
    getCreatedDate(): Date {
        return this.profile.createdDate;
    }

    /**
     * 获取角色等级
     */
    getLevel(): number {
        return this.level;
    }

    /**
     * 获取当前经验值
     */
    getCurrentExperience(): number {
        return this.experience;
    }

    /**
     * 获取累计经验值
     */
    getTotalExperience(): number {
        return this.totalExperience;
    }

    /**
     * 计算升级所需经验
     */
    getExperienceForNextLevel(): number {
        // 简单的经验公式：100 * 当前等级
        return 100 * this.level;
    }

    /**
     * 获取升级进度百分比（0-100）
     */
    getExperienceProgress(): number {
        const requiredExp = this.getExperienceForNextLevel();
        if (requiredExp === 0) return 100;
        return Math.min((this.experience / requiredExp) * 100, 100);
    }

    /**
     * 增加经验值
     */
    addExperience(exp: number): number {
        const leveledUp = [];
        this.experience += exp;
        this.totalExperience += exp;

        // 检查是否升级
        const requiredExp = this.getExperienceForNextLevel();
        while (this.experience >= requiredExp) {
            this.experience -= requiredExp;
            this.level++;
            leveledUp.push(this.level);
        }

        return leveledUp.length; // 返回升级次数
    }

    /**
     * 获取属性管理器
     */
    getAttributes(): CharacterAttributes {
        return this.attributes;
    }

    /**
     * 获取状态管理器
     */
    getStateManager(): CharacterStateManager {
        return this.stateManager;
    }

    /**
     * 获取完整档案信息
     */
    getProfile(): ICharacterProfile {
        return { ...this.profile };
    }

    /**
     * 获取角色的完整数据摘要
     */
    getSummary(): string {
        return `
[${this.profile.name}]
年龄: ${this.profile.age}
性别: ${this.profile.gender}
等级: ${this.level}
经验: ${this.experience}/${this.getExperienceForNextLevel()}
状态数: ${this.stateManager.getAllActiveStates().length}
背景: ${this.profile.background}
        `.trim();
    }

    /**
     * 导出角色数据（用于存档）
     */
    exportData(): Record<string, any> {
        return {
            profile: this.profile,
            level: this.level,
            experience: this.experience,
            totalExperience: this.totalExperience,
            attributes: this.attributes.exportData(),
            states: this.stateManager.exportData(),
        };
    }

    /**
     * 导入角色数据（用于读档）
     */
    importData(data: Record<string, any>): boolean {
        try {
            if (data.profile) this.profile = data.profile;
            if (data.level !== undefined) this.level = data.level;
            if (data.experience !== undefined) this.experience = data.experience;
            if (data.totalExperience !== undefined) this.totalExperience = data.totalExperience;
            if (data.attributes) this.attributes.importData(data.attributes);
            if (data.states) this.stateManager.importData(data.states);
            return true;
        } catch (error) {
            console.error("Failed to import character data:", error);
            return false;
        }
    }

    /**
     * 重置角色为初始状态
     */
    reset(): void {
        this.level = 1;
        this.experience = 0;
        this.totalExperience = 0;
        this.attributes.resetAllAttributes();
        this.stateManager.clearAllStates();
    }
}
