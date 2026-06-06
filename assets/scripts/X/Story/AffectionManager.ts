/**
 * 好感度管理器
 * 管理角色好感度、等级、事件解锁
 */

import {
    ICharacterAffection,
    AffectionLevel,
    AffectionCallback,
    ICharacterRoute,
} from './StoryTypes';

export class AffectionManager {
    private static _instance: AffectionManager | null = null;

    public static get instance(): AffectionManager {
        if (!this._instance) {
            this._instance = new AffectionManager();
        }
        return this._instance;
    }

    // 角色好感度数据
    private _affectionData: Map<string, ICharacterAffection> = new Map();

    // 角色支线配置
    private _characterRoutes: Map<string, ICharacterRoute> = new Map();

    // 变化监听器
    private _changeListeners: Set<AffectionCallback> = new Set();

    private constructor() {}

    /**
     * 注册角色支线配置
     */
    public registerCharacterRoute(route: ICharacterRoute): void {
        this._characterRoutes.set(route.characterId, route);
    }

    /**
     * 批量注册角色支线
     */
    public registerCharacterRoutes(routes: ICharacterRoute[]): void {
        for (const route of routes) {
            this.registerCharacterRoute(route);
        }
    }

    /**
     * 获取角色好感度数据
     */
    public getAffection(characterId: string): ICharacterAffection {
        if (!this._affectionData.has(characterId)) {
            this._affectionData.set(characterId, {
                characterId,
                value: 0,
                level: AffectionLevel.Stranger,
                unlockedEvents: [],
                completedEvents: [],
                choiceHistory: [],
            });
        }
        return this._affectionData.get(characterId)!;
    }

    /**
     * 获取好感度数值
     */
    public getAffectionValue(characterId: string): number {
        return this.getAffection(characterId).value;
    }

    /**
     * 获取好感度等级
     */
    public getAffectionLevel(characterId: string): AffectionLevel {
        return this.getAffection(characterId).level;
    }

    /**
     * 修改好感度
     */
    public changeAffection(characterId: string, delta: number, source?: string): number {
        const data = this.getAffection(characterId);
        const oldValue = data.value;
        const newValue = Math.max(0, Math.min(100, data.value + delta));

        data.value = newValue;
        data.level = this.calculateLevel(newValue);

        // 检查是否解锁新事件
        this.checkEventUnlock(characterId);

        // 通知监听器
        for (const listener of this._changeListeners) {
            try {
                listener(characterId, oldValue, newValue);
            } catch (e) {
                console.error('[AffectionManager] Listener error:', e);
            }
        }

        return newValue;
    }

    /**
     * 计算好感度等级
     */
    private calculateLevel(value: number): AffectionLevel {
        if (value >= 91) return AffectionLevel.Soulmate;
        if (value >= 71) return AffectionLevel.Lover;
        if (value >= 51) return AffectionLevel.Close;
        if (value >= 31) return AffectionLevel.Friend;
        if (value >= 11) return AffectionLevel.Acquaintance;
        return AffectionLevel.Stranger;
    }

    /**
     * 检查并解锁事件
     */
    private checkEventUnlock(characterId: string): void {
        const route = this._characterRoutes.get(characterId);
        if (!route) return;

        const affection = this.getAffection(characterId);
        const thresholds = route.affectionThresholds;

        // 检查各阶段解锁
        const stageThresholds = [
            { threshold: thresholds.stage1, stageIndex: 0 },
            { threshold: thresholds.stage2, stageIndex: 1 },
            { threshold: thresholds.stage3, stageIndex: 2 },
            { threshold: thresholds.stage4, stageIndex: 3 },
        ];

        for (const { threshold, stageIndex } of stageThresholds) {
            if (affection.value >= threshold && route.stages[stageIndex]) {
                const stage = route.stages[stageIndex];
                for (const eventId of stage.eventNodeIds) {
                    if (!affection.unlockedEvents.includes(eventId)) {
                        affection.unlockedEvents.push(eventId);
                    }
                }
            }
        }
    }

    /**
     * 标记事件完成
     */
    public completeEvent(characterId: string, eventId: string): void {
        const affection = this.getAffection(characterId);
        if (!affection.completedEvents.includes(eventId)) {
            affection.completedEvents.push(eventId);
        }
    }

    /**
     * 检查事件是否完成
     */
    public isEventCompleted(characterId: string, eventId: string): boolean {
        return this.getAffection(characterId).completedEvents.includes(eventId);
    }

    /**
     * 记录选择历史
     */
    public recordChoice(characterId: string, nodeId: string, choiceId: string, affectionChange: number): void {
        const affection = this.getAffection(characterId);
        affection.choiceHistory.push({
            nodeId,
            choiceId,
            affectionChange,
        });
    }

    /**
     * 检查是否满足角色结局条件
     */
    public checkCharacterEnding(characterId: string): boolean {
        const route = this._characterRoutes.get(characterId);
        if (!route) return false;

        const affection = this.getAffection(characterId);

        // 检查好感度是否达标
        if (affection.value < route.affectionThresholds.ending) {
            return false;
        }

        // 检查所有阶段事件是否完成
        for (const stage of route.stages) {
            for (const eventId of stage.eventNodeIds) {
                if (!affection.completedEvents.includes(eventId)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 监听好感度变化
     */
    public onAffectionChange(callback: AffectionCallback): void {
        this._changeListeners.add(callback);
    }

    /**
     * 取消监听
     */
    public offAffectionChange(callback: AffectionCallback): void {
        this._changeListeners.delete(callback);
    }

    /**
     * 获取好感度等级名称
     */
    public getLevelName(characterId: string): string {
        const level = this.getAffectionLevel(characterId);
        const levelNames: Record<AffectionLevel, string> = {
            [AffectionLevel.Stranger]: '陌生人',
            [AffectionLevel.Acquaintance]: '熟人',
            [AffectionLevel.Friend]: '朋友',
            [AffectionLevel.Close]: '挚友',
            [AffectionLevel.Lover]: '恋人',
            [AffectionLevel.Soulmate]: '灵魂伴侣',
        };
        return levelNames[level];
    }

    /**
     * 从存档数据恢复
     */
    public loadFromSave(affectionData: Record<string, ICharacterAffection>): void {
        this._affectionData.clear();
        for (const [characterId, data] of Object.entries(affectionData)) {
            this._affectionData.set(characterId, data);
        }
    }

    /**
     * 导出到存档数据
     */
    public exportToSave(): Record<string, ICharacterAffection> {
        const result: Record<string, ICharacterAffection> = {};
        for (const [characterId, data] of this._affectionData) {
            result[characterId] = data;
        }
        return result;
    }

    /**
     * 获取所有角色好感度列表
     */
    public getAllAffections(): ICharacterAffection[] {
        return Array.from(this._affectionData.values());
    }
}
