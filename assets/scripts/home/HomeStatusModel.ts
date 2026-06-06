import {
    AttributeType,
    CharacterGender,
    IAttributeChange,
    ICharacterProfile,
} from "../Characters/CharacterTypes";
import { CharacterProfile } from "../Characters/CharacterProfile";
import { CharacterAttributes } from "../Characters/CharacterAttributes";
import { CharacterStateManager } from "../Characters/CharacterStateManager";
import { CharacterGrowth } from "../Characters/CharacterGrowth";
import { CharacterEffect } from "../Characters/CharacterEffect";
import { CurrencySystem } from "../EconomicSystem/CurrencySystem";
import { CurrencyType, type ICurrencyChange } from "../EconomicSystem/EconomicTypes";
import { GameContext, type IHomeSaveData } from "../data/GameContext";

/**
 * Home 场景中需要展示 / 使用的主角状态快照。
 * 主要用于：
 * - UI 展示（HomeStatusView）；
 * - 其他系统读取当前角色大致状态（不用关心内部实现）。
 */
export interface HomeStatusSnapshot {
    /** 当前等级 */
    level: number;
    /** 当前经验值（本等级内） */
    currentExp: number;
    /** 升到下一级所需的经验总量 */
    expForNextLevel: number;
    /** 升级进度（0~100，百分比） */
    expProgressPercent: number;

    /** 当前体力值 */
    stamina: number;
    /** 体力上限 */
    maxStamina: number;
    /** 当前心情值 */
    mood: number;
    /** 心情上限 */
    maxMood: number;

    /** 当前货币数量（用于轻度经济系统） */
    money: number;

    /** 力量属性（示例关键属性） */
    strength: number;
    /** 智力属性 */
    intelligence: number;
    /** 魅力属性 */
    charm: number;
    /** 善良属性 */
    kindness: number;
}

/**
 * SYS-HOME：Home 场景核心数据模型。
 *
 * 职责：
 * - 持有一个 `CharacterProfile` 作为主角；
 * - 管理体力 / 心情 / 金钱等 Home 资源；
 * - 管理经验 / 等级并调用 CHAR-GROW 做属性成长；
 * - 对外提供 `HomeStatusSnapshot` 快照与订阅能力。
 */
export class HomeStatusModel {
    /** 单例实例缓存 */
    private static _instance: HomeStatusModel | null = null;

    /**
     * 获取单例实例。
     * - 首次访问时会自动创建并初始化默认主角；
     * - 后续一直复用同一个实例。
     */
    public static get instance(): HomeStatusModel {
        if (!HomeStatusModel._instance) {
            const model = new HomeStatusModel();
            model.initializeDefaultCharacter();
            HomeStatusModel._instance = model;
        }
        return HomeStatusModel._instance as HomeStatusModel;
    }

    /** 主角完整 Profile（含档案、等级、经验、属性、状态等） */
    private character: CharacterProfile | null = null;
    /** 属性管理器缓存（从 character 中取出） */
    private attributes: CharacterAttributes | null = null;
    /** 状态管理器缓存（从 character 中取出） */
    private states: CharacterStateManager | null = null;

    /** 当前体力值 */
    private stamina: number = 0;
    /** 体力上限 */
    private maxStamina: number = 100;

    /** 当前心情值 */
    private mood: number = 0;
    /** 心情上限 */
    private maxMood: number = 100;

    /** 当前货币数量（轻度经济系统） */
    private money: number = 0;
    private gameContextSyncBound = false;
    private suspendGameContextSync = false;
    private economySyncBound = false;

    /** 状态变更回调列表（UI / 系统订阅） */
    private listeners: Array<(snapshot: HomeStatusSnapshot) => void> = [];
    private readonly handleEconomyCurrencyChanged = (change: ICurrencyChange): void => {
        if (change.type !== CurrencyType.Gold && change.type !== CurrencyType.Stamina) {
            return;
        }
        this.syncResourceFieldsFromEconomy(true);
    };

    /** 构造函数设为私有，只能通过单例访问 */
    private constructor() {}

    /**
     * 初始化默认主角配置（新开档时使用）。
     * 如后续接入正式存档，可改为从存档中恢复。
     */
    private initializeDefaultCharacter(): void {
        const profile: ICharacterProfile = {
            /** 唯一 ID */
            id: "main-character",
            /** 显示用名字 */
            name: "主角",
            /** 年龄 */
            age: 16,
            /** 性别 */
            gender: CharacterGender.Female,
            /** 背景故事简述 */
            background: "默认背景",
            /** 头像资源路径（可为空） */
            avatar: "",
            /** 立绘资源路径（可为空） */
            illustration: "",
            /** 简要描述 */
            description: "用于 Phase 2 Demo 的默认主角",
            /** 创建日期（可用于统计） */
            createdDate: new Date(),
        };

        this.resetWithProfile(profile, {
            maxStamina: 100,
            maxMood: 100,
            initialMoney: 100,
        });
    }

    /**
     * 使用指定 profile 重置主角数据（新开档 / 读档后重建）。
     *
     * @param profile 主角基础信息
     * @param options 一些 Home 相关初始配置
     */
    public resetWithProfile(
        profile: ICharacterProfile,
        options?: {
            /** 初始体力上限 */
            maxStamina?: number;
            /** 初始心情上限 */
            maxMood?: number;
            /** 初始金钱 */
            initialMoney?: number;
        }
    ): void {
        this.character = new CharacterProfile(profile);
        this.attributes = this.character.getAttributes();
        this.states = this.character.getStateManager();

        this.maxStamina =
            options && options.maxStamina !== undefined
                ? options.maxStamina
                : 100;
        this.maxMood =
            options && options.maxMood !== undefined ? options.maxMood : 100;
        this.stamina = this.maxStamina;
        this.mood = this.maxMood;

        this.money =
            options && options.initialMoney !== undefined
                ? options.initialMoney
                : 100;

        this.notifyChanged();
    }

    /**
     * 获取当前主角 Profile 实例。
     * @throws 如果模型尚未初始化，会抛出错误
     */
    public getCharacterProfile(): CharacterProfile {
        const character = this.character;
        if (!character) {
            throw new Error(
                "[HomeStatusModel] CharacterProfile 未初始化"
            );
        }
        return character;
    }

    /**
     * 获取当前 Home 状态的快照。
     * 该方法不会暴露内部可变引用。
     */
    public getSnapshot(): HomeStatusSnapshot {
        const character = this.getCharacterProfile();
        const attrs: CharacterAttributes = this.getAttributes();

        const strengthAttr = attrs.getAttribute(AttributeType.Strength);
        const intelligenceAttr = attrs.getAttribute(
            AttributeType.Intelligence
        );
        const charmAttr = attrs.getAttribute(AttributeType.Charm);
        const kindnessAttr = attrs.getAttribute(AttributeType.Kindness);

        const level = character.getLevel();
        const currentExp = character.getCurrentExperience();
        const expForNextLevel = character.getExperienceForNextLevel();
        const expProgressPercent = character.getExperienceProgress();

        return {
            level,
            currentExp,
            expForNextLevel,
            expProgressPercent,

            stamina: this.stamina,
            maxStamina: this.maxStamina,
            mood: this.mood,
            maxMood: this.maxMood,

            money: this.money,

            strength: strengthAttr ? strengthAttr.currentValue : 0,
            intelligence: intelligenceAttr ? intelligenceAttr.currentValue : 0,
            charm: charmAttr ? charmAttr.currentValue : 0,
            kindness: kindnessAttr ? kindnessAttr.currentValue : 0,
        };
    }

    /**
     * 订阅 Home 状态变化回调。
     *
     * @param listener 回调函数，参数为最新的状态快照
     */
    public onStatusChanged(
        listener: (snapshot: HomeStatusSnapshot) => void
    ): void {
        if (!listener) {
            return;
        }
        this.listeners.push(listener);
    }

    /**
     * 取消订阅 Home 状态变化回调。
     *
     * @param listener 之前传入的回调函数
     */
    public offStatusChanged(
        listener: (snapshot: HomeStatusSnapshot) => void
    ): void {
        if (!listener) {
            return;
        }
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
            this.listeners.splice(index, 1);
        }
    }

    public bindGameContextSync(): void {
        this.gameContextSyncBound = true;
    }

    public bindEconomySync(): void {
        if (this.economySyncBound) {
            return;
        }
        CurrencySystem.instance.onChange(this.handleEconomyCurrencyChanged);
        this.economySyncBound = true;
        this.syncResourceFieldsFromEconomy(true);
    }

    public saveToGameContext(options?: { persistToLocal?: boolean }): void {
        GameContext.instance.userData.home = this.exportData() as IHomeSaveData;
        if (options?.persistToLocal) {
            GameContext.instance.saveToLocal();
        }
    }

    public loadFromGameContext(): boolean {
        const data = GameContext.instance.userData.home;
        if (!data) {
            if (!this.hasEconomyResourceSnapshot()) {
                this.pushLegacyResourcesToEconomy('home_default');
            }
            this.syncResourceFieldsFromEconomy(false);
            this.saveToGameContext();
            return false;
        }

        this.suspendGameContextSync = true;
        try {
            return this.importData(data);
        } finally {
            this.suspendGameContextSync = false;
        }
    }

    /**
     * 内部使用：通知所有订阅者当前状态已更新。
     */
    private notifyChanged(): void {
        if (this.gameContextSyncBound && !this.suspendGameContextSync) {
            this.saveToGameContext();
        }
        if (!this.listeners || this.listeners.length === 0) {
            return;
        }
        const snapshot = this.getSnapshot();
        for (let i = 0; i < this.listeners.length; i++) {
            const listener = this.listeners[i];
            try {
                listener(snapshot);
            } catch (error) {
                console.error("[HomeStatusModel] listener error:", error);
            }
        }
    }

    // === 体力 / 心情 / 金钱：基础操作 ===

    /** 获取当前体力值 */
    public getStamina(): number {
        return this.stamina;
    }

    /** 获取当前心情值 */
    public getMood(): number {
        return this.mood;
    }

    /** 获取当前金钱数量 */
    public getMoney(): number {
        return this.money;
    }

    /**
     * 修改体力值（可正可负）。
     *
     * @param delta 体力变化量（正数增加 / 负数扣除）
     * @param _reason 变更原因（可选，仅用于调试或日志）
     * @returns 修改后的体力值
     */
    public changeStamina(delta: number, _reason?: string): number {
        const nextValue = HomeStatusModel.clampNumber(
            this.stamina + delta,
            0,
            this.maxStamina
        );
        if (nextValue === this.stamina) {
            return this.stamina;
        }
        CurrencySystem.instance.setBalance(
            CurrencyType.Stamina,
            nextValue,
            _reason ?? "HomeStatusModel.changeStamina"
        );
        if (!this.economySyncBound) {
            this.syncResourceFieldsFromEconomy(true);
        }
        return this.stamina;
    }

    /**
     * 修改心情值（可正可负）。
     */
    public changeMood(delta: number, _reason?: string): number {
        this.mood = HomeStatusModel.clampNumber(
            this.mood + delta,
            0,
            this.maxMood
        );
        this.notifyChanged();
        return this.mood;
    }

    /**
     * 修改金钱数量（可正可负，最小为 0）。
     */
    public changeMoney(delta: number, _reason?: string): number {
        const nextValue = Math.max(0, this.money + delta);
        if (nextValue === this.money) {
            return this.money;
        }
        CurrencySystem.instance.setBalance(
            CurrencyType.Gold,
            nextValue,
            _reason ?? "HomeStatusModel.changeMoney"
        );
        if (!this.economySyncBound) {
            this.syncResourceFieldsFromEconomy(true);
        }
        return this.money;
    }

    // === 经验 / 等级 / 属性成长 ===

    /**
     * 增加经验值，并在需要时触发升级与属性成长。
     *
     * @param exp 增加的经验值（>0 时生效）
     * @param _reason 经验来源（可选，仅用于日志）
     * @returns 本次实际提升的等级数
     */
    public gainExperience(exp: number, _reason?: string): number {
        if (exp <= 0) {
            return 0;
        }

        const character = this.getCharacterProfile();
        const beforeLevel = character.getLevel();
        const levelUps = character.addExperience(exp);
        const afterLevel = character.getLevel();

        if (levelUps > 0 && afterLevel > beforeLevel) {
            const attrs = this.getAttributes();
            CharacterGrowth.applyLevelUpGrowth(attrs, levelUps);

            // 升级时默认回满体力 / 心情
            CurrencySystem.instance.setBalance(
                CurrencyType.Stamina,
                this.maxStamina,
                _reason ?? "HomeStatusModel.levelUpStamina"
            );
            if (!this.economySyncBound) {
                this.syncResourceFieldsFromEconomy(false);
            }
            this.mood = this.maxMood;
        }

        this.notifyChanged();
        return levelUps;
    }

    /**
     * 通过统一接口应用一组属性变化（给 Home 行为 / 日程系统使用）。
     *
     * @param changes 属性变化数组
     * @param _reason 用途说明（可选）
     */
    public applyAttributeChanges(
        changes: IAttributeChange[],
        _reason?: string
    ): void {
        if (!changes || changes.length === 0) {
            return;
        }
        const attrs = this.getAttributes();
        CharacterEffect.applyAttributeChanges(attrs, changes);
        this.notifyChanged();
    }

    // === 存读档相关（预留接口） ===

    /**
     * 导出当前 Home / 角色的完整数据（用于存档）。
     */
    public exportData(): Record<string, any> {
        const character = this.getCharacterProfile();
        const attrs = this.getAttributes();
        const states = this.getStateManager();

        return {
            character: character.exportData(),
            stamina: this.stamina,
            maxStamina: this.maxStamina,
            mood: this.mood,
            maxMood: this.maxMood,
            money: this.money,
            attributes: attrs.exportData(),
            states: states.exportData(),
        };
    }

    /**
     * 从存档数据中恢复 Home / 角色状态。
     *
     * @param data 存档数据
     * @returns 是否导入成功
     */
    public importData(data: Record<string, any>): boolean {
        try {
            if (!data) {
                return false;
            }

            if (data.character) {
                const character = this.getCharacterProfile();
                character.importData(data.character);
            }

            if (data.attributes) {
                const attrs = this.getAttributes();
                attrs.importData(data.attributes);
            }

            if (data.states) {
                const states = this.getStateManager();
                states.importData(data.states);
            }

            if (data.maxStamina !== undefined) {
                this.maxStamina = data.maxStamina;
            }
            if (data.stamina !== undefined) {
                this.stamina = data.stamina;
            }
            if (data.mood !== undefined) {
                this.mood = data.mood;
            }
            if (data.maxMood !== undefined) {
                this.maxMood = data.maxMood;
            }
            if (data.money !== undefined) {
                this.money = data.money;
            }

            if (this.hasEconomyResourceSnapshot()) {
                this.syncResourceFieldsFromEconomy(false);
            } else {
                this.pushLegacyResourcesToEconomy('home_migrate');
                this.syncResourceFieldsFromEconomy(false);
            }

            this.notifyChanged();
            return true;
        } catch (error) {
            console.error("[HomeStatusModel] importData error:", error);
            return false;
        }
    }

    // === 内部工具 ===

    /**
     * 获取属性管理器（lazy 初始化）。
     */
    private getAttributes(): CharacterAttributes {
        if (!this.attributes) {
            const character = this.getCharacterProfile();
            this.attributes = character.getAttributes();
        }
        return this.attributes as CharacterAttributes;
    }

    /**
     * 获取状态管理器（lazy 初始化）。
     */
    private getStateManager(): CharacterStateManager {
        if (!this.states) {
            const character = this.getCharacterProfile();
            this.states = character.getStateManager();
        }
        return this.states as CharacterStateManager;
    }

    private hasEconomyResourceSnapshot(): boolean {
        const economy = GameContext.instance.userData.economy;
        const balances = economy.currency?.balances ?? {};
        return economy.timestamp > 0
            || balances[CurrencyType.Gold] !== undefined
            || balances[CurrencyType.Stamina] !== undefined;
    }

    private pushLegacyResourcesToEconomy(reasonPrefix: string): void {
        CurrencySystem.instance.setBalance(
            CurrencyType.Gold,
            Math.max(0, this.money),
            `${reasonPrefix}_gold`
        );
        CurrencySystem.instance.setBalance(
            CurrencyType.Stamina,
            HomeStatusModel.clampNumber(this.stamina, 0, this.maxStamina),
            `${reasonPrefix}_stamina`
        );
    }

    private syncResourceFieldsFromEconomy(shouldNotify: boolean): void {
        const nextMoney = Math.max(0, CurrencySystem.instance.getBalance(CurrencyType.Gold));
        const nextStamina = HomeStatusModel.clampNumber(
            CurrencySystem.instance.getBalance(CurrencyType.Stamina),
            0,
            this.maxStamina
        );
        const changed = nextMoney !== this.money || nextStamina !== this.stamina;

        this.money = nextMoney;
        this.stamina = nextStamina;

        if (changed && shouldNotify) {
            this.notifyChanged();
        }
    }

    /**
     * 数值裁剪工具。
     */
    private static clampNumber(value: number, min: number, max: number): number {
        if (value < min) {
            return min;
        }
        if (value > max) {
            return max;
        }
        return value;
    }
}
