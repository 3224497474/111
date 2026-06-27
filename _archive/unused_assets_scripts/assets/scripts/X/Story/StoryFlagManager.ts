/**
 * 剧情标记管理器
 * 负责管理所有剧情相关的标记、计数器
 */

import {
    IStorySaveData,
} from './StoryTypes';

export class StoryFlagManager {
    private static _instance: StoryFlagManager | null = null;

    public static get instance(): StoryFlagManager {
        if (!this._instance) {
            this._instance = new StoryFlagManager();
        }
        return this._instance;
    }

    // 标记存储
    private _flags: Map<string, boolean | number | string> = new Map();

    // 变更监听器
    private _listeners: Map<string, Set<(value: boolean | number | string) => void>> = new Map();

    private constructor() {}

    /**
     * 设置标记
     */
    public setFlag(key: string, value: boolean | number | string): void {
        const oldValue = this._flags.get(key);
        this._flags.set(key, value);

        if (oldValue !== value) {
            this.notifyListeners(key, value);
        }
    }

    /**
     * 获取标记
     */
    public getFlag(key: string): boolean | number | string | undefined {
        return this._flags.get(key);
    }

    /**
     * 检查标记是否存在且为真
     */
    public hasFlag(key: string): boolean {
        const value = this._flags.get(key);
        if (value === undefined) return false;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value > 0;
        return true;
    }

    /**
     * 增加计数标记
     */
    public incrementFlag(key: string, delta: number = 1): number {
        const current = this._flags.get(key);
        const newValue = (typeof current === 'number' ? current : 0) + delta;
        this.setFlag(key, newValue);
        return newValue;
    }

    /**
     * 重置标记
     */
    public resetFlag(key: string): void {
        this._flags.delete(key);
    }

    /**
     * 重置所有标记
     */
    public resetAll(): void {
        this._flags.clear();
    }

    /**
     * 检查条件表达式
     * 支持格式: "flag_name operator value"
     * 例如: "chapter_1_complete == true", "affection_a >= 60"
     */
    public evaluateCondition(expr: string): boolean {
        if (!expr || expr.trim() === '') return true;

        // 处理 AND 条件
        if (expr.includes('&&')) {
            const parts = expr.split('&&').map(s => s.trim());
            return parts.every(part => this.evaluateSingleCondition(part));
        }

        // 处理 OR 条件
        if (expr.includes('||')) {
            const parts = expr.split('||').map(s => s.trim());
            return parts.some(part => this.evaluateSingleCondition(part));
        }

        return this.evaluateSingleCondition(expr);
    }

    /**
     * 评估单个条件
     */
    private evaluateSingleCondition(expr: string): boolean {
        const match = expr.match(/^(\S+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
        if (!match) {
            // 如果没有操作符，当作布尔标记检查
            return this.hasFlag(expr.trim());
        }

        const [, key, operator, valueStr] = match;
        const flagValue = this._flags.get(key.trim());

        // 解析比较值
        let compareValue: boolean | number | string;
        const trimmedValue = valueStr.trim();

        if (trimmedValue === 'true') {
            compareValue = true;
        } else if (trimmedValue === 'false') {
            compareValue = false;
        } else if (!isNaN(Number(trimmedValue))) {
            compareValue = Number(trimmedValue);
        } else {
            compareValue = trimmedValue.replace(/['"]/g, '');
        }

        // 如果标记不存在
        if (flagValue === undefined) {
            return compareValue === false || compareValue === 0;
        }

        // 执行比较
        switch (operator) {
            case '==':
                return flagValue === compareValue;
            case '!=':
                return flagValue !== compareValue;
            case '>=':
                return typeof flagValue === 'number' && typeof compareValue === 'number'
                    && flagValue >= compareValue;
            case '<=':
                return typeof flagValue === 'number' && typeof compareValue === 'number'
                    && flagValue <= compareValue;
            case '>':
                return typeof flagValue === 'number' && typeof compareValue === 'number'
                    && flagValue > compareValue;
            case '<':
                return typeof flagValue === 'number' && typeof compareValue === 'number'
                    && flagValue < compareValue;
            default:
                return false;
        }
    }

    /**
     * 监听标记变化
     */
    public onFlagChange(key: string, callback: (value: boolean | number | string) => void): void {
        if (!this._listeners.has(key)) {
            this._listeners.set(key, new Set());
        }
        this._listeners.get(key)!.add(callback);
    }

    /**
     * 取消监听
     */
    public offFlagChange(key: string, callback: (value: boolean | number | string) => void): void {
        this._listeners.get(key)?.delete(callback);
    }

    /**
     * 通知监听器
     */
    private notifyListeners(key: string, value: boolean | number | string): void {
        const listeners = this._listeners.get(key);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(value);
                } catch (e) {
                    console.error('[StoryFlagManager] Listener error:', e);
                }
            }
        }
    }

    /**
     * 获取所有标记
     */
    public getAllFlags(): Record<string, boolean | number | string> {
        const result: Record<string, boolean | number | string> = {};
        for (const [key, value] of this._flags) {
            result[key] = value;
        }
        return result;
    }

    /**
     * 从存档数据恢复
     */
    public loadFromSave(saveData: IStorySaveData): void {
        this._flags.clear();
        for (const [key, value] of Object.entries(saveData.storyFlags)) {
            this._flags.set(key, value);
        }
    }

    /**
     * 导出到存档数据
     */
    public exportToSave(): Record<string, boolean | number | string> {
        return this.getAllFlags();
    }
}
