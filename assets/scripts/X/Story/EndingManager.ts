import {
    IEnding,
    EndingType,
    IEndingCondition,
    IEndingPoints,
    EndingCallback,
} from './StoryTypes';
import { StoryFlagManager } from './StoryFlagManager';
import { AffectionManager } from './AffectionManager';
import { GlobalProgressionSystem } from '../core/globalProgress/GlobalProgressionSystem';

export class EndingManager {
    private static _instance: EndingManager | null = null;

    public static get instance(): EndingManager {
        if (!this._instance) {
            this._instance = new EndingManager();
        }
        return this._instance;
    }

    private _endings: Map<string, IEnding> = new Map();
    private _endingPoints: IEndingPoints = {};
    private _unlockedEndings: Set<string> = new Set();
    private _achievedEndings: Set<string> = new Set();
    private _triggerListeners: Set<EndingCallback> = new Set();

    private constructor() {}

    public registerEnding(ending: IEnding): void {
        this._endings.set(ending.id, ending);
    }

    public registerEndings(endings: IEnding[]): void {
        for (const ending of endings) {
            this.registerEnding(ending);
        }
    }

    public getEnding(endingId: string): IEnding | undefined {
        return this._endings.get(endingId);
    }

    public getAllEndings(): IEnding[] {
        return Array.from(this._endings.values());
    }

    public addEndingPoint(endingId: string, delta: number): number {
        if (!this._endingPoints[endingId]) {
            this._endingPoints[endingId] = 0;
        }

        this._endingPoints[endingId] += delta;
        return this._endingPoints[endingId];
    }

    public getEndingPoint(endingId: string): number {
        return this._endingPoints[endingId] || 0;
    }

    private checkCondition(condition: IEndingCondition): boolean {
        const flagManager = StoryFlagManager.instance;
        const affectionManager = AffectionManager.instance;

        switch (condition.type) {
            case 'chapter':
                return flagManager.evaluateCondition(
                    `${condition.target} ${condition.operator} ${condition.value}`
                );

            case 'affection': {
                if (!condition.target) {
                    return false;
                }

                const affectionValue = affectionManager.getAffectionValue(condition.target);
                return this.compareValues(
                    affectionValue,
                    condition.operator,
                    Number(condition.value)
                );
            }

            case 'flag': {
                if (!condition.target) {
                    return false;
                }

                const flagValue = flagManager.getFlag(condition.target);
                if (flagValue === undefined) {
                    return condition.value === false || condition.value === 0;
                }

                return this.compareValues(flagValue, condition.operator, condition.value);
            }

            case 'ending_points': {
                if (!condition.target) {
                    return false;
                }

                const points = this.getEndingPoint(condition.target);
                return this.compareValues(points, condition.operator, Number(condition.value));
            }

            case 'completed_nodes': {
                const completedCount = flagManager.getFlag('completed_nodes_count') as number || 0;
                return this.compareValues(
                    completedCount,
                    condition.operator,
                    Number(condition.value)
                );
            }

            default:
                return false;
        }
    }

    private compareValues(
        actual: boolean | number | string,
        operator: string,
        expected: boolean | number | string
    ): boolean {
        switch (operator) {
            case '==':
                return actual === expected;
            case '!=':
                return actual !== expected;
            case '>=':
                return typeof actual === 'number'
                    && typeof expected === 'number'
                    && actual >= expected;
            case '<=':
                return typeof actual === 'number'
                    && typeof expected === 'number'
                    && actual <= expected;
            case '>':
                return typeof actual === 'number'
                    && typeof expected === 'number'
                    && actual > expected;
            case '<':
                return typeof actual === 'number'
                    && typeof expected === 'number'
                    && actual < expected;
            default:
                return false;
        }
    }

    public canTriggerEnding(endingId: string): boolean {
        const ending = this._endings.get(endingId);
        if (!ending) {
            return false;
        }

        if (this._achievedEndings.has(endingId)) {
            return false;
        }

        return ending.conditions.every((condition) => this.checkCondition(condition));
    }

    public checkAvailableEndings(): IEnding[] {
        const available: IEnding[] = [];

        for (const ending of this._endings.values()) {
            if (this.canTriggerEnding(ending.id)) {
                available.push(ending);
            }
        }

        available.sort((a, b) => b.priority - a.priority);
        return available;
    }

    public getBestAvailableEnding(): IEnding | null {
        const available = this.checkAvailableEndings();
        return available.length > 0 ? available[0] : null;
    }

    public triggerEnding(endingId: string): boolean {
        const ending = this._endings.get(endingId);
        if (!ending) {
            console.error(`[EndingManager] Ending not found: ${endingId}`);
            return false;
        }

        if (!this.canTriggerEnding(endingId)) {
            console.warn(`[EndingManager] Cannot trigger ending: ${endingId}`);
            return false;
        }

        this._achievedEndings.add(endingId);
        this._unlockedEndings.add(endingId);
        GlobalProgressionSystem.instance.markEndingUnlocked(endingId);

        for (const listener of this._triggerListeners) {
            try {
                listener(endingId);
            } catch (error) {
                console.error('[EndingManager] Listener error:', error);
            }
        }

        return true;
    }

    public unlockEnding(endingId: string): void {
        if (!this._endings.has(endingId)) {
            return;
        }

        this._unlockedEndings.add(endingId);
        GlobalProgressionSystem.instance.markEndingUnlocked(endingId);
    }

    public isEndingUnlocked(endingId: string): boolean {
        return this._unlockedEndings.has(endingId);
    }

    public isEndingAchieved(endingId: string): boolean {
        return this._achievedEndings.has(endingId);
    }

    public onEndingTrigger(callback: EndingCallback): void {
        this._triggerListeners.add(callback);
    }

    public offEndingTrigger(callback: EndingCallback): void {
        this._triggerListeners.delete(callback);
    }

    public getEndingStats(): {
        total: number;
        unlocked: number;
        achieved: number;
        byType: Record<EndingType, { total: number; achieved: number }>;
    } {
        const stats = {
            total: this._endings.size,
            unlocked: this._unlockedEndings.size,
            achieved: this._achievedEndings.size,
            byType: {
                [EndingType.True]: { total: 0, achieved: 0 },
                [EndingType.Good]: { total: 0, achieved: 0 },
                [EndingType.Normal]: { total: 0, achieved: 0 },
                [EndingType.Bad]: { total: 0, achieved: 0 },
                [EndingType.Character]: { total: 0, achieved: 0 },
                [EndingType.Hidden]: { total: 0, achieved: 0 },
            },
        };

        for (const ending of this._endings.values()) {
            stats.byType[ending.type].total++;
            if (this._achievedEndings.has(ending.id)) {
                stats.byType[ending.type].achieved++;
            }
        }

        return stats;
    }

    public loadFromSave(data: {
        endingPoints: IEndingPoints;
        unlockedEndings: string[];
        achievedEndings: string[];
    }): void {
        this._endingPoints = data.endingPoints || {};
        this._unlockedEndings = new Set(data.unlockedEndings || []);
        this._achievedEndings = new Set(data.achievedEndings || []);

        for (const endingId of this._unlockedEndings) {
            GlobalProgressionSystem.instance.markEndingUnlocked(endingId);
        }
    }

    public exportToSave(): {
        endingPoints: IEndingPoints;
        unlockedEndings: string[];
        achievedEndings: string[];
    } {
        return {
            endingPoints: { ...this._endingPoints },
            unlockedEndings: Array.from(this._unlockedEndings),
            achievedEndings: Array.from(this._achievedEndings),
        };
    }

    public getCharacterEndings(characterId: string): IEnding[] {
        return Array.from(this._endings.values())
            .filter((ending) => ending.characterId === characterId);
    }

    public getAchievedCharacterEndings(characterId: string): IEnding[] {
        return this.getCharacterEndings(characterId)
            .filter((ending) => this._achievedEndings.has(ending.id));
    }
}
