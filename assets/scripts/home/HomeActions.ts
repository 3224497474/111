import { AttributeType, IAttributeChange } from "../Characters/CharacterTypes";
import { HomeStatusModel, HomeStatusSnapshot } from "./HomeStatusModel";
import { CharacterProfile } from "../Characters/CharacterProfile";

/**
 * Home 场景中的基础行为类型。
 * 可根据策划需要继续扩展。
 */
export enum HomeActionType {
    /** 休息：恢复体力与少量心情 */
    Rest = "rest",
    /** 简单交流：大幅恢复心情，略微消耗体力 */
    Talk = "talk",
    /** 自习 / 学习：提升智力与经验，消耗体力与少量心情 */
    Study = "study",
    /** 训练：提升力量/防御与经验，消耗体力与少量金钱 */
    Train = "train",
}

/**
 * 单个 Home 行为的配置。
 */
export interface HomeActionConfig {
    /** 行为类型（枚举值） */
    id: HomeActionType;
    /** 用于 UI 显示的行为名称 */
    displayName: string;

    /** 体力变化量（正数为恢复，负数为消耗） */
    staminaDelta: number;
    /** 心情变化量 */
    moodDelta: number;
    /** 金钱变化量 */
    moneyDelta: number;
    /** 经验变化量 */
    expDelta: number;

    /** 该行为附带的属性变化列表 */
    attributeChanges?: IAttributeChange[];
}

/**
 * Home 行为执行结果，方便 UI 或日志使用。
 */
export interface HomeActionResult {
    /** 执行的行为类型 */
    action: HomeActionType;
    /** 执行前的状态快照 */
    before: HomeStatusSnapshot;
    /** 执行后的状态快照 */
    after: HomeStatusSnapshot;
    /** 实际应用的属性变化列表 */
    attributeChanges: IAttributeChange[];
}

/**
 * 日程系统与角色 / Home 的联动数据结构。
 * 日程执行结束后，可将结果聚合为一个 ScheduleEffect，交给 HomeActions 处理。
 */
export interface ScheduleEffect {
    /** 日程 ID（用于日志 / 调试） */
    id: string;
    /** 日程名称（可选） */
    name?: string;

    /** 体力变化量 */
    staminaDelta?: number;
    /** 心情变化量 */
    moodDelta?: number;
    /** 金钱变化量 */
    moneyDelta?: number;
    /** 经验变化量 */
    expDelta?: number;

    /** 属性变化列表 */
    attributeChanges?: IAttributeChange[];
}

/** Home 行为配置表（根据枚举构建） */
const HOME_ACTION_CONFIGS: { [key: string]: HomeActionConfig } = {};

/**
 * 初始化默认的 Home 行为配置。
 * 如需调整数值，可以直接修改此处。
 */
(function initHomeActionConfigs() {
    HOME_ACTION_CONFIGS[HomeActionType.Rest] = {
        id: HomeActionType.Rest,
        displayName: "休息",
        staminaDelta: +30,
        moodDelta: +10,
        moneyDelta: 0,
        expDelta: 0,
        attributeChanges: [],
    };

    HOME_ACTION_CONFIGS[HomeActionType.Talk] = {
        id: HomeActionType.Talk,
        displayName: "简单交流",
        staminaDelta: -5,
        moodDelta: +20,
        moneyDelta: 0,
        expDelta: 0,
        attributeChanges: [],
    };

    HOME_ACTION_CONFIGS[HomeActionType.Study] = {
        id: HomeActionType.Study,
        displayName: "自习 / 学习",
        staminaDelta: -15,
        moodDelta: -5,
        moneyDelta: 0,
        expDelta: 30,
        attributeChanges: [
            {
                attributeType: AttributeType.Intelligence,
                deltaValue: +2,
                reason: "学习提升智力",
            },
        ],
    };

    HOME_ACTION_CONFIGS[HomeActionType.Train] = {
        id: HomeActionType.Train,
        displayName: "训练",
        staminaDelta: -20,
        moodDelta: 0,
        moneyDelta: -10,
        expDelta: 20,
        attributeChanges: [
            {
                attributeType: AttributeType.Strength,
                deltaValue: +2,
                reason: "训练提升力量",
            },
            {
                attributeType: AttributeType.Defense,
                deltaValue: +1,
                reason: "训练提升防御",
            },
        ],
    };
})();

/**
 * Home 行为系统。
 *
 * 职责：
 * - 管理 Home 行为配置；
 * - 判断行为是否可执行；
 * - 执行行为并更新 HomeStatusModel；
 * - 为日程系统提供统一的效果应用入口。
 */
export class HomeActions {
    /**
     * 获取指定行为的配置。
     *
     * @param action 行为类型
     */
    public static getActionConfig(
        action: HomeActionType
    ): HomeActionConfig | null {
        const config = HOME_ACTION_CONFIGS[action];
        return config || null;
    }

    /**
     * 判断当前是否可以执行某个 Home 行为（体力 / 金钱是否足够）。
     *
     * @param action 行为类型
     * @param model  可选 HomeStatusModel 实例（默认使用单例）
     */
    public static canPerform(
        action: HomeActionType,
        model?: HomeStatusModel
    ): boolean {
        const m = model || HomeStatusModel.instance;
        const config = HOME_ACTION_CONFIGS[action];
        if (!config) {
            return false;
        }

        // 如果行为会消耗体力，检查体力是否足够
        if (config.staminaDelta < 0 && m.getStamina() + config.staminaDelta < 0) {
            return false;
        }

        // 如果行为会消耗金钱，检查金钱是否足够
        if (config.moneyDelta < 0 && m.getMoney() + config.moneyDelta < 0) {
            return false;
        }

        return true;
    }

    /**
     * 执行一个 Home 行为（从 UI 按钮 / 剧情事件触发）。
     *
     * @param action 行为类型
     * @param model  可选 HomeStatusModel 实例（默认使用单例）
     * @returns 如果成功执行，返回执行结果；否则返回 null
     */
    public static perform(
        action: HomeActionType,
        model?: HomeStatusModel
    ): HomeActionResult | null {
        const m = model || HomeStatusModel.instance;
        const config = HOME_ACTION_CONFIGS[action];
        if (!config) {
            console.warn("[HomeActions] 未找到配置:", action);
            return null;
        }

        if (!HomeActions.canPerform(action, m)) {
            console.warn("[HomeActions] 条件不足，无法执行:", action);
            return null;
        }

        const before = m.getSnapshot();

        if (config.staminaDelta !== 0) {
            m.changeStamina(config.staminaDelta, "HomeAction:" + config.id);
        }
        if (config.moodDelta !== 0) {
            m.changeMood(config.moodDelta, "HomeAction:" + config.id);
        }
        if (config.moneyDelta !== 0) {
            m.changeMoney(config.moneyDelta, "HomeAction:" + config.id);
        }
        if (config.expDelta !== 0) {
            m.gainExperience(config.expDelta, "HomeAction:" + config.id);
        }
        if (config.attributeChanges && config.attributeChanges.length > 0) {
            m.applyAttributeChanges(
                config.attributeChanges,
                "HomeAction:" + config.id
            );
        }

        const after = m.getSnapshot();

        return {
            action,
            before,
            after,
            attributeChanges: config.attributeChanges
                ? config.attributeChanges.slice()
                : [],
        };
    }

    /**
     * 日程系统调用：将某个日程执行结果映射到角色 / Home 状态。
     *
     * @param effect 日程执行结果
     * @param model  可选 HomeStatusModel 实例（默认使用单例）
     * @returns 应用效果后的最新状态快照
     */
    public static applyScheduleEffect(
        effect: ScheduleEffect,
        model?: HomeStatusModel
    ): HomeStatusSnapshot {
        const m = model || HomeStatusModel.instance;
        const staminaDelta =
            effect.staminaDelta !== undefined ? effect.staminaDelta : 0;
        const moodDelta =
            effect.moodDelta !== undefined ? effect.moodDelta : 0;
        const moneyDelta =
            effect.moneyDelta !== undefined ? effect.moneyDelta : 0;
        const expDelta = effect.expDelta !== undefined ? effect.expDelta : 0;

        if (staminaDelta !== 0) {
            m.changeStamina(staminaDelta, "Schedule:" + effect.id);
        }
        if (moodDelta !== 0) {
            m.changeMood(moodDelta, "Schedule:" + effect.id);
        }
        if (moneyDelta !== 0) {
            m.changeMoney(moneyDelta, "Schedule:" + effect.id);
        }
        if (expDelta !== 0) {
            m.gainExperience(expDelta, "Schedule:" + effect.id);
        }

        if (effect.attributeChanges && effect.attributeChanges.length > 0) {
            m.applyAttributeChanges(
                effect.attributeChanges,
                "Schedule:" + effect.id
            );
        }

        return m.getSnapshot();
    }

    /**
     * 构造一个简单的行为日志字符串（可选，用于调试 / 文本系统）。
     */
    public static buildActionLog(
        action: HomeActionType,
        result: HomeActionResult,
        character?: CharacterProfile
    ): string {
        const profile =
            character || HomeStatusModel.instance.getCharacterProfile();
        const config = HOME_ACTION_CONFIGS[action];
        const name = config ? config.displayName : action;

        return (
            "[HomeAction] " +
            profile.getName() +
            " 执行了 " +
            name +
            "，等级：" +
            result.before.level +
            " -> " +
            result.after.level +
            "，体力：" +
            result.before.stamina +
            " -> " +
            result.after.stamina +
            "，心情：" +
            result.before.mood +
            " -> " +
            result.after.mood +
            "，金钱：" +
            result.before.money +
            " -> " +
            result.after.money
        );
    }
}

