/**
 * 增强版货币系统
 * 
 * 功能：
 * - 多货币支持
 * - 货币变化事件
 * - 交易日志
 * - 每日上限
 * - 数据持久化
 */

import {
    CurrencyType,
    ICurrencyConfig,
    ICurrencyChange,
    CurrencyChangeCallback,
} from './EconomicTypes';

export class CurrencySystem {
    private static _instance: CurrencySystem | null = null;

    public static get instance(): CurrencySystem {
        if (!this._instance) {
            this._instance = new CurrencySystem();
        }
        return this._instance;
    }

    // 货币配置
    private _configs: Map<CurrencyType, ICurrencyConfig> = new Map();

    // 货币余额
    private _balances: Map<CurrencyType, number> = new Map();

    // 今日获取量
    private _dailyGained: Map<CurrencyType, number> = new Map();

    // 变化监听器
    private _listeners: Set<CurrencyChangeCallback> = new Set();

    // 交易日志（环形缓冲区）
    private _changeHistory: Array<ICurrencyChange | undefined> = new Array(1000);
    private _historyCursor: number = 0;
    private _historyCount: number = 0;
    private _maxHistorySize: number = 1000;

    private constructor() {
        this.initDefaultConfigs();
    }

    /**
     * 初始化默认货币配置
     */
    private initDefaultConfigs(): void {
        const defaultConfigs: ICurrencyConfig[] = [
            {
                id: CurrencyType.Gold,
                name: '金币',
                icon: 'icon_gold',
                maxAmount: 999999999,
                isPremium: false,
            },
            {
                id: CurrencyType.Diamond,
                name: '钻石',
                icon: 'icon_diamond',
                maxAmount: 99999,
                isPremium: true,
            },
            {
                id: CurrencyType.Stamina,
                name: '体力',
                icon: 'icon_stamina',
                maxAmount: 999,
                isPremium: false,
                dailyLimit: 500,
            },
            {
                id: CurrencyType.Exp,
                name: '经验',
                icon: 'icon_exp',
                maxAmount: 999999999,
                isPremium: false,
            },
        ];

        for (const config of defaultConfigs) {
            this._configs.set(config.id, config);
            this._balances.set(config.id, 0);
            this._dailyGained.set(config.id, 0);
        }
    }

    /**
     * 注册货币配置
     */
    public registerCurrency(config: ICurrencyConfig): void {
        this._configs.set(config.id, config);
        if (!this._balances.has(config.id)) {
            this._balances.set(config.id, 0);
        }
        if (!this._dailyGained.has(config.id)) {
            this._dailyGained.set(config.id, 0);
        }
    }

    /**
     * 获取货币配置
     */
    public getConfig(type: CurrencyType): ICurrencyConfig | undefined {
        return this._configs.get(type);
    }

    /**
     * 获取货币余额
     */
    public getBalance(type: CurrencyType): number {
        return this._balances.get(type) ?? 0;
    }

    /**
     * 设置货币余额
     */
    public setBalance(type: CurrencyType, amount: number, reason: string = 'set'): void {
        const config = this._configs.get(type);
        if (!config) {
            console.warn(`[CurrencySystem] Currency not found: ${type}`);
            return;
        }

        const oldValue = this.getBalance(type);
        const newValue = Math.min(Math.max(0, amount), config.maxAmount);

        this._balances.set(type, newValue);

        // 记录变化
        const change: ICurrencyChange = {
            type,
            oldValue,
            newValue,
            delta: newValue - oldValue,
            reason,
            timestamp: Date.now(),
        };

        this.recordChange(change);
        this.notifyListeners(change);
    }

    /**
     * 修改货币余额
     */
    public changeBalance(type: CurrencyType, delta: number, reason: string = 'change'): boolean {
        const config = this._configs.get(type);
        if (!config) {
            console.warn(`[CurrencySystem] Currency not found: ${type}`);
            return false;
        }

        const oldValue = this.getBalance(type);
        const newValue = oldValue + delta;

        // 检查下限
        if (newValue < 0) {
            console.warn(`[CurrencySystem] Insufficient ${type}: ${oldValue} < ${-delta}`);
            return false;
        }

        // 检查上限
        if (newValue > config.maxAmount) {
            console.warn(`[CurrencySystem] Exceeds max ${type}: ${newValue} > ${config.maxAmount}`);
            return false;
        }

        // 检查每日上限
        if (delta > 0 && config.dailyLimit) {
            const dailyGained = this._dailyGained.get(type) ?? 0;
            if (dailyGained + delta > config.dailyLimit) {
                console.warn(`[CurrencySystem] Exceeds daily limit for ${type}`);
                return false;
            }
            this._dailyGained.set(type, dailyGained + delta);
        }

        this._balances.set(type, newValue);

        // 记录变化
        const change: ICurrencyChange = {
            type,
            oldValue,
            newValue,
            delta,
            reason,
            timestamp: Date.now(),
        };

        this.recordChange(change);
        this.notifyListeners(change);

        return true;
    }

    /**
     * 检查是否足够
     */
    public canAfford(type: CurrencyType, amount: number): boolean {
        if (amount <= 0) return true;
        return this.getBalance(type) >= amount;
    }

    /**
     * 批量检查
     */
    public canAffordMultiple(requirements: Array<{ type: CurrencyType; amount: number }>): boolean {
        return requirements.every(req => this.canAfford(req.type, req.amount));
    }

    /**
     * 批量消耗
     */
    public spendMultiple(requirements: Array<{ type: CurrencyType; amount: number }>, reason: string = 'spend'): boolean {
        // 先检查是否全部足够
        if (!this.canAffordMultiple(requirements)) {
            return false;
        }

        // 再执行消耗
        for (const req of requirements) {
            this.changeBalance(req.type, -req.amount, reason);
        }

        return true;
    }

    /**
     * 获取今日获取量
     */
    public getDailyGained(type: CurrencyType): number {
        return this._dailyGained.get(type) ?? 0;
    }

    /**
     * 重置每日获取量
     */
    public resetDailyGained(): void {
        for (const key of this._dailyGained.keys()) {
            this._dailyGained.set(key, 0);
        }
    }

    /**
     * 监听货币变化
     */
    public onChange(callback: CurrencyChangeCallback): void {
        this._listeners.add(callback);
    }

    /**
     * 取消监听
     */
    public offChange(callback: CurrencyChangeCallback): void {
        this._listeners.delete(callback);
    }

    /**
     * 通知监听器
     */
    private notifyListeners(change: ICurrencyChange): void {
        for (const listener of this._listeners) {
            try {
                listener(change);
            } catch (e) {
                console.error('[CurrencySystem] Listener error:', e);
            }
        }
    }

    /**
     * 记录变化历史
     */
    private recordChange(change: ICurrencyChange): void {
        this._changeHistory[this._historyCursor] = change;
        this._historyCursor = (this._historyCursor + 1) % this._maxHistorySize;
        if (this._historyCount < this._maxHistorySize) {
            this._historyCount++;
        }
    }

    /**
     * 获取变化历史
     */
    public getHistory(filter?: { type?: CurrencyType; limit?: number }): ICurrencyChange[] {
        const history: ICurrencyChange[] = [];
        const startIndex = (this._historyCursor - this._historyCount + this._maxHistorySize) % this._maxHistorySize;

        for (let i = 0; i < this._historyCount; i++) {
            const index = (startIndex + i) % this._maxHistorySize;
            const change = this._changeHistory[index];
            if (change) {
                history.push(change);
            }
        }

        if (filter?.type) {
            return history
                .filter(h => h.type === filter.type)
                .slice(filter?.limit ? -filter.limit : undefined);
        }

        if (filter?.limit) {
            return history.slice(-filter.limit);
        }

        return history;
    }

    /**
     * 获取所有货币信息
     */
    public getAllCurrencies(): Array<{ config: ICurrencyConfig; balance: number }> {
        const result: Array<{ config: ICurrencyConfig; balance: number }> = [];

        for (const [type, config] of this._configs) {
            result.push({
                config,
                balance: this.getBalance(type),
            });
        }

        return result;
    }

    // ==================== 存档 ====================

    /**
     * 导出存档数据
     */
    public exportSave(): Record<string, any> {
        const balances: Record<string, number> = {};
        const dailyGained: Record<string, number> = {};

        for (const [type, value] of this._balances) {
            balances[type] = value;
        }

        for (const [type, value] of this._dailyGained) {
            dailyGained[type] = value;
        }

        return { balances, dailyGained };
    }

    /**
     * 导入存档数据
     */
    public importSave(data: Record<string, any>): void {
        if (data.balances) {
            for (const [type, value] of Object.entries(data.balances)) {
                this._balances.set(type as CurrencyType, value as number);
            }
        }

        if (data.dailyGained) {
            for (const [type, value] of Object.entries(data.dailyGained)) {
                this._dailyGained.set(type as CurrencyType, value as number);
            }
        }
    }

    /**
     * 重置所有数据
     */
    public reset(): void {
        this._balances.clear();
        this._dailyGained.clear();
        this._historyCursor = 0;
        this._historyCount = 0;
        this.initDefaultConfigs();
    }
}
