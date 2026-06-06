import { AttributeType, IAttribute } from "./CharacterTypes";

/**
 * CHAR-ATTR: 属性结构定义
 * 管理角色的各项属性：能力属性和性格属性
 */
export class CharacterAttributes {
    private attributes: Map<AttributeType, IAttribute> = new Map();

    constructor() {
        this.initializeDefaultAttributes();
    }

    /**
     * 初始化默认属性
     */
    private initializeDefaultAttributes(): void {
        const defaultAttributes: AttributeType[] = [
            AttributeType.Strength,
            AttributeType.Defense,
            AttributeType.Speed,
            AttributeType.Intelligence,
            AttributeType.Luck,
            AttributeType.Kindness,
            AttributeType.Courage,
            AttributeType.Wisdom,
            AttributeType.Charm,
        ];

        defaultAttributes.forEach(type => {
            this.attributes.set(type, {
                type,
                baseValue: 50,
                currentValue: 50,
                maxValue: 100,
                growth: 0.05, // 默认成长率 5%
            });
        });
    }

    /**
     * 获取指定属性
     */
    getAttribute(type: AttributeType): IAttribute | undefined {
        return this.attributes.get(type);
    }

    /**
     * 获取所有属性
     */
    getAllAttributes(): Map<AttributeType, IAttribute> {
        return new Map(this.attributes);
    }

    /**
     * 设置属性基础值
     */
    setBaseValue(type: AttributeType, value: number): boolean {
        const attr = this.attributes.get(type);
        if (!attr) return false;

        attr.baseValue = Math.max(0, Math.min(value, attr.maxValue));
        attr.currentValue = attr.baseValue;
        return true;
    }

    /**
     * 设置属性最大值
     */
    setMaxValue(type: AttributeType, value: number): boolean {
        const attr = this.attributes.get(type);
        if (!attr) return false;

        attr.maxValue = Math.max(1, value);
        if (attr.currentValue > attr.maxValue) {
            attr.currentValue = attr.maxValue;
        }
        return true;
    }

    /**
     * 设置属性成长率
     */
    setGrowthRate(type: AttributeType, rate: number): boolean {
        const attr = this.attributes.get(type);
        if (!attr) return false;

        attr.growth = Math.max(0, Math.min(rate, 1));
        return true;
    }

    /**
     * 检查属性值是否在有效范围内
     */
    isAttributeValid(type: AttributeType): boolean {
        const attr = this.attributes.get(type);
        if (!attr) return false;

        return attr.currentValue >= 0 && attr.currentValue <= attr.maxValue;
    }

    /**
     * 重置所有属性为基础值
     */
    resetAllAttributes(): void {
        this.attributes.forEach(attr => {
            attr.currentValue = attr.baseValue;
        });
    }

    /**
     * 导出属性数据（用于存档）
     */
    exportData(): Record<string, IAttribute> {
        const data: Record<string, IAttribute> = {};
        this.attributes.forEach((attr, key) => {
            data[key] = { ...attr };
        });
        return data;
    }

        /**
     * 导入属性数据（用于读档）
     * 使用 for...in + hasOwnProperty，避免依赖 Object.entries（ES2017）
     */
    importData(data: Record<string, IAttribute>): boolean {
        try {
            this.attributes.clear();

            for (const key in data) {
                if (!Object.prototype.hasOwnProperty.call(data, key)) {
                    continue;
                }

                const attributeType = key as AttributeType;
                const attr: IAttribute = data[key];

                this.attributes.set(attributeType, {
                    type: attributeType,
                    baseValue: attr.baseValue,
                    currentValue: attr.currentValue,
                    maxValue: attr.maxValue,
                    growth: attr.growth,
                });
            }

            return true;
        } catch (error) {
            console.error("Failed to import attribute data:", error);
            return false;
        }
    }


    /**
     * 获取属性的百分比值（0-100）
     */
    getAttributePercentage(type: AttributeType): number {
        const attr = this.attributes.get(type);
        if (!attr || attr.maxValue === 0) return 0;
        return (attr.currentValue / attr.maxValue) * 100;
    }
}
