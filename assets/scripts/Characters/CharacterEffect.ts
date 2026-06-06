import { CharacterAttributes } from "./CharacterAttributes";
import { CharacterStateManager } from "./CharacterStateManager";
import {
    AttributeType,
    IAttribute,
    IAttributeChange,
    ICharacterState,
    IStateChange,
    StateType,
} from "./CharacterTypes";

/**
 * CHAR-EFF：属性 / 状态变更统一接口。
 *
 * 职责：
 * - 提供“修改属性数值”的统一入口（增减、批量应用等）；
 * - 提供“添加/移除状态”的统一入口；
 * - 供 Home 行为、日程系统、事件系统等调用，避免到处直接改属性字段。
 */
export class CharacterEffect {
    /**
     * 应用单个属性变化。
     *
     * @param attributes 属性管理器
     * @param change     需要应用的属性变化（类型 + 增减值 + 原因）
     * @returns 应用后的属性当前值；如果属性不存在则返回 0
     */
    public static applyAttributeChange(
        attributes: CharacterAttributes,
        change: IAttributeChange
    ): number {
        if (!attributes || !change) {
            return 0;
        }

        const attr: IAttribute | undefined = attributes.getAttribute(
            change.attributeType
        );
        if (!attr) {
            return 0;
        }

        // 在当前值基础上加上变化量，并限制在 [0, maxValue] 之间
        const newValue = CharacterEffect.clampNumber(
            attr.currentValue + change.deltaValue,
            0,
            attr.maxValue
        );
        attr.currentValue = newValue;
        return newValue;
    }

    /**
     * 批量应用一组属性变化。
     *
     * @param attributes 属性管理器
     * @param changes    属性变化数组
     */
    public static applyAttributeChanges(
        attributes: CharacterAttributes,
        changes: IAttributeChange[]
    ): void {
        if (!attributes || !changes || changes.length === 0) {
            return;
        }

        for (let i = 0; i < changes.length; i++) {
            CharacterEffect.applyAttributeChange(attributes, changes[i]);
        }
    }

    /**
     * 应用单个状态变化：添加 / 移除。
     *
     * @param stateManager 状态管理器
     * @param change       状态变化描述（类型 + 动作 + 时长/强度等）
     */
    public static applyStateChange(
        stateManager: CharacterStateManager,
        change: IStateChange
    ): void {
        if (!stateManager || !change) {
            return;
        }

        if (change.action === "add") {
            // 组装一个新的状态实例并添加
            const state: ICharacterState = {
                type: change.stateType,
                duration:
                    change.duration !== undefined ? change.duration : -1,
                intensity:
                    change.intensity !== undefined ? change.intensity : 0,
                source: change.source,
            };
            stateManager.addState(state);
        } else if (change.action === "remove") {
            // 简化实现：移除该类型的所有状态
            stateManager.removeAllStates(change.stateType as StateType);
        }
    }

    /**
     * 批量应用一组状态变化。
     *
     * @param stateManager 状态管理器
     * @param changes      状态变化数组
     */
    public static applyStateChanges(
        stateManager: CharacterStateManager,
        changes: IStateChange[]
    ): void {
        if (!stateManager || !changes || changes.length === 0) {
            return;
        }

        for (let i = 0; i < changes.length; i++) {
            CharacterEffect.applyStateChange(stateManager, changes[i]);
        }
    }

    /**
     * 数值裁剪工具方法。
     *
     * @param value 原始数值
     * @param min   最小允许值
     * @param max   最大允许值
     * @returns 限制到 [min, max] 区间后的数值
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

