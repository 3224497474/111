import { CharacterAttributes } from "./CharacterAttributes";
import { AttributeType, IAttribute } from "./CharacterTypes";

/**
 * CHAR-GROW：角色属性成长模块。
 *
 * 职责：
 * - 提供“升级时批量成长所有属性”的统一逻辑；
 * - 默认依赖 `CharacterAttributes` 中的 `growth` 字段作为成长系数（0~1）；
 * - 成长后会把当前值同步为新的基础值，相当于“升级自动回满”。
 */
export class CharacterGrowth {
    /**
     * 等级提升时，对所有属性应用成长逻辑。
     *
     * @param attributes 角色属性管理器实例
     * @param levelsGained 本次一共提升的等级数（>= 1）
     */
    public static applyLevelUpGrowth(
        attributes: CharacterAttributes,
        levelsGained: number
    ): void {
        if (!attributes || levelsGained <= 0) {
            return;
        }

        // 取得所有属性的快照（map 的拷贝）
        const allAttributes = attributes.getAllAttributes();

        allAttributes.forEach((attr: IAttribute, type: AttributeType) => {
            // 每个属性自身配置好的成长系数（通常 0~1）
            const growth = attr.growth;
            // 当前基础值（未成长前）
            const baseValue = attr.baseValue;

            /**
             * 成长公式：
             * Δ = max(1, round(baseValue * growth * levelsGained))
             *
             * - baseValue 越高，成长越多；
             * - growth 越高，成长越多；
             * - 至少成长 1 点，避免低等级属性完全不长。
             */
            let delta = Math.round(baseValue * growth * levelsGained);
            if (delta <= 0) {
                delta = levelsGained;
            }

            // 计算新的基础值，并限制在 [0, maxValue] 范围内
            const newBase = CharacterGrowth.clampNumber(
                baseValue + delta,
                0,
                attr.maxValue
            );

            // 更新基础值与当前值（升级后视作回满）
            attr.baseValue = newBase;
            attr.currentValue = newBase;
        });
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

