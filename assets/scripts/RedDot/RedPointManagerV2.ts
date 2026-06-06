import { director, sys } from 'cc';
import {
    AggregateRule,
    PersistType,
    RefreshStrategy,
    ResetRule,
    RedPointType,
    type IRedPointConfig,
    type IRedPointSaveData,
    type IRedPointState,
    type RedPointCallback,
} from './RedPointTypes';

interface IPendingUpdate {
    key: string;
    value: number;
    timestamp: number;
}

export class RedPointManagerV2 {
    private static _instance: RedPointManagerV2 | null = null;
    private static _initialized = false;

    public static get instance(): RedPointManagerV2 {
        if (!this._instance) {
            this._instance = new RedPointManagerV2();
        }
        return this._instance;
    }

    private readonly _configs = new Map<string, IRedPointConfig>();
    private readonly _values = new Map<string, number>();
    private readonly _totals = new Map<string, number>();
    private readonly _dirtyKeys = new Set<string>();
    private readonly _pendingUpdates = new Map<string, IPendingUpdate>();
    private readonly _listeners = new Map<string, Set<RedPointCallback>>();
    private readonly _children = new Map<string, Set<string>>();
    private readonly _parentPathCache = new Map<string, string[]>();
    private readonly _iconCache = new Map<string, any>();
    private readonly _saveQueue = new Map<string, number>();

    private _refreshStrategy: RefreshStrategy = RefreshStrategy.Deferred;
    private _maxUpdatesPerFrame = 50;
    private _flushDelayMs = 16;
    private _saveDelayMs = 1000;
    private _storageKey = 'redpoint_data';
    private _lastLoginTime = 0;
    private _isFirstInit = true;
    private _isFlushing = false;
    private _flushScheduled = false;
    private _saveScheduled = false;
    private _frameFlushScheduled = false;
    private _flushTimer: ReturnType<typeof setTimeout> | null = null;
    private _saveTimer: ReturnType<typeof setTimeout> | null = null;

    private readonly _flushTask = () => {
        this._flushScheduled = false;
        this._flushTimer = null;
        this.flushPendingUpdates();
    };

    private readonly _saveTask = () => {
        this._saveScheduled = false;
        this._saveTimer = null;
        this.flushSaveQueue();
    };

    private readonly _frameFlushTask = () => {
        if (!this._frameFlushScheduled) return;
        this._frameFlushScheduled = false;
        this.flushPendingUpdates();
    };

    private constructor() {}

    public initialize(): void {
        if (RedPointManagerV2._initialized) {
            console.warn('[RedPointManagerV2] already initialized');
            return;
        }

        const previousLoginTime = this.loadFromLocalInternal();
        this.checkResets();
        this.rebuildAllTotals();
        this.calculateOfflineProgress(previousLoginTime);
        this._lastLoginTime = Date.now();

        RedPointManagerV2._initialized = true;
        console.log('[RedPointManagerV2] initialized');
    }

    public isInitialized(): boolean {
        return RedPointManagerV2._initialized;
    }

    public registerConfig(config: IRedPointConfig): void {
        const normalizedConfig = this.normalizeConfig(config);
        const configId = normalizedConfig.id;
        const oldConfig = this._configs.get(configId);
        const oldParentPath = oldConfig ? this.getParentPath(configId) : [];

        if (oldConfig?.parentId) {
            const oldChildren = this._children.get(oldConfig.parentId);
            if (oldChildren) {
                oldChildren.delete(configId);
                if (oldChildren.size === 0) {
                    this._children.delete(oldConfig.parentId);
                }
            }
        }

        this._configs.set(configId, normalizedConfig);
        this._parentPathCache.delete(configId);

        if (normalizedConfig.parentId) {
            let children = this._children.get(normalizedConfig.parentId);
            if (!children) {
                children = new Set<string>();
                this._children.set(normalizedConfig.parentId, children);
            }
            children.add(configId);
        }

        this.recalculateWithParents(configId);
        for (const parentKey of oldParentPath) {
            this.recalculateWithParents(parentKey);
        }
    }

    public registerConfigs(configs: IRedPointConfig[]): void {
        for (const config of configs) {
            this.registerConfig(config);
        }
    }

    public getConfig(id: string): IRedPointConfig | undefined {
        if (!id) return undefined;
        return this._configs.get(id);
    }

    public unregisterConfig(id: string): void {
        if (!id || !this._configs.has(id)) return;

        const parentKeys = this.getParentPath(id);
        const config = this._configs.get(id);

        if (config?.parentId) {
            const siblings = this._children.get(config.parentId);
            if (siblings) {
                siblings.delete(id);
                if (siblings.size === 0) {
                    this._children.delete(config.parentId);
                }
            }
        }

        this._configs.delete(id);
        this._values.delete(id);
        this._totals.delete(id);
        this._dirtyKeys.delete(id);
        this._pendingUpdates.delete(id);
        this._listeners.delete(id);
        this._parentPathCache.delete(id);
        this._saveQueue.delete(id);

        for (const parentKey of parentKeys) {
            this.recalculateWithParents(parentKey);
        }
    }

    public unregisterAllConfigs(): void {
        this._configs.clear();
        this._children.clear();
        this._parentPathCache.clear();
        this._listeners.clear();
        this._totals.clear();
        this._dirtyKeys.clear();
        this._pendingUpdates.clear();
    }

    public getRegisteredConfigIds(): string[] {
        return Array.from(this._configs.keys());
    }

    public setValue(key: string, value: number): void {
        if (!key) return;

        const oldValue = this._values.get(key) ?? 0;
        if (oldValue === value) return;

        switch (this._refreshStrategy) {
            case RefreshStrategy.Immediate:
                this.applyValue(key, value);
                this.batchNotify();
                break;
            case RefreshStrategy.Deferred:
                this.addPendingUpdate(key, value);
                this.scheduleFlush();
                break;
            case RefreshStrategy.NextFrame:
                this.addPendingUpdate(key, value);
                this.scheduleFrameUpdate();
                break;
        }
    }

    public add(key: string, delta: number): void {
        if (!key || delta === 0) return;
        const oldValue = this._values.get(key) ?? 0;
        this.setValue(key, oldValue + delta);
    }

    public getValue(key: string): number {
        if (!key) return 0;
        return this._values.get(key) ?? 0;
    }

    public getTotal(key: string): number {
        if (!key) return 0;
        return this._totals.get(key) ?? 0;
    }

    public getState(key: string): IRedPointState {
        if (!key) {
            return {
                id: '',
                value: 0,
                totalValue: 0,
                visible: false,
                lastUpdateTime: Date.now(),
                dirty: false,
            };
        }

        const value = this._values.get(key) ?? 0;
        const totalValue = this._totals.get(key) ?? 0;
        const config = this._configs.get(key);
        const isDirty = this._dirtyKeys.has(key);
        if (isDirty) {
            this._dirtyKeys.delete(key);
        }

        let visible = totalValue > 0;
        if (config?.type === RedPointType.Time) {
            const now = Date.now();
            if (config.startTime && now < config.startTime) visible = false;
            if (config.endTime && now > config.endTime) visible = false;
        }

        return {
            id: key,
            value,
            totalValue,
            visible,
            lastUpdateTime: Date.now(),
            dirty: isDirty,
        };
    }

    public register(key: string, callback: RedPointCallback): void {
        if (!key || !callback) return;

        let listeners = this._listeners.get(key);
        if (!listeners) {
            listeners = new Set<RedPointCallback>();
            this._listeners.set(key, listeners);
        }
        listeners.add(callback);

        try {
            callback(this.getState(key));
        } catch (error) {
            console.error('[RedPointManagerV2] callback error:', error);
        }
    }

    public unregister(key: string, callback: RedPointCallback): void {
        if (!key) return;

        const listeners = this._listeners.get(key);
        if (!listeners) return;

        listeners.delete(callback);
        if (listeners.size === 0) {
            this._listeners.delete(key);
        }
    }

    private notifyListeners(key: string): void {
        const listeners = this._listeners.get(key);
        if (!listeners || listeners.size === 0) return;

        const state = this.getState(key);
        for (const callback of listeners) {
            try {
                callback(state);
            } catch (error) {
                console.error('[RedPointManagerV2] notify error:', error);
            }
        }
    }

    private addPendingUpdate(key: string, value: number): void {
        this._pendingUpdates.set(key, {
            key,
            value,
            timestamp: Date.now(),
        });
    }

    private scheduleFlush(): void {
        if (this._flushScheduled) return;
        this._flushScheduled = true;
        this._flushTimer = setTimeout(this._flushTask, this._flushDelayMs);
    }

    private scheduleFrameUpdate(): void {
        if (this._frameFlushScheduled) return;
        this._frameFlushScheduled = true;
        director.once('afterUpdate', this._frameFlushTask);
    }

    private flushPendingUpdates(): void {
        if (this._isFlushing) return;
        this._isFlushing = true;

        const keys = Array.from(this._pendingUpdates.keys()).slice(0, this._maxUpdatesPerFrame);
        for (const key of keys) {
            const update = this._pendingUpdates.get(key);
            if (!update) continue;
            this._pendingUpdates.delete(key);
            this.applyValue(update.key, update.value);
        }

        this.batchNotify();
        this._isFlushing = false;

        if (this._pendingUpdates.size > 0) {
            if (this._refreshStrategy === RefreshStrategy.NextFrame) {
                this.scheduleFrameUpdate();
            } else {
                this.scheduleFlush();
            }
        }
    }

    private batchNotify(): void {
        const dirtyKeys = Array.from(this._dirtyKeys);
        for (const key of dirtyKeys) {
            this.notifyListeners(key);
        }
        this._dirtyKeys.clear();
    }

    private applyValue(key: string, value: number): void {
        this._values.set(key, value);
        this._dirtyKeys.add(key);
        this.recalculateWithParents(key);
        this.queueSave(key, value);
    }

    private recalculateWithParents(key: string): void {
        this.recalculateTotal(key);
        const parentKeys = this.getParentPath(key);
        for (const parentKey of parentKeys) {
            this.recalculateTotal(parentKey);
        }
    }

    private getParentPath(key: string): string[] {
        const cached = this._parentPathCache.get(key);
        if (cached) {
            return cached;
        }

        const path: string[] = [];
        const visited = new Set<string>();
        let currentKey = key;

        while (true) {
            const config = this._configs.get(currentKey);
            const parentId = config?.parentId;
            if (!parentId || visited.has(parentId)) {
                break;
            }

            path.push(parentId);
            visited.add(parentId);
            currentKey = parentId;
        }

        this._parentPathCache.set(key, path);
        return path;
    }

    private recalculateTotal(key: string, visiting: Set<string> = new Set()): number {
        if (visiting.has(key)) {
            return this._totals.get(key) ?? 0;
        }

        visiting.add(key);

        const config = this._configs.get(key);
        const selfValue = this._values.get(key) ?? 0;
        const childTotals: number[] = [];
        const children = this._children.get(key);
        if (children) {
            for (const childKey of children) {
                childTotals.push(this.recalculateTotal(childKey, visiting));
            }
        }

        let total = selfValue;
        const aggregateRule = config?.aggregateRule ?? AggregateRule.Sum;
        switch (aggregateRule) {
            case AggregateRule.Sum:
                total = selfValue + childTotals.reduce((sum, childTotal) => sum + childTotal, 0);
                break;
            case AggregateRule.Max:
                total = childTotals.length > 0 ? Math.max(selfValue, ...childTotals) : selfValue;
                break;
            case AggregateRule.Any:
                total = selfValue > 0 || childTotals.some((childTotal) => childTotal > 0) ? 1 : 0;
                break;
            case AggregateRule.All:
                total = selfValue > 0 && childTotals.every((childTotal) => childTotal > 0) ? 1 : 0;
                break;
        }

        visiting.delete(key);

        const oldTotal = this._totals.get(key) ?? 0;
        this._totals.set(key, total);
        if (oldTotal !== total) {
            this._dirtyKeys.add(key);
        }
        return total;
    }

    private rebuildAllTotals(): void {
        this._totals.clear();
        const allKeys = new Set<string>([
            ...this._configs.keys(),
            ...this._values.keys(),
        ]);
        for (const key of allKeys) {
            this.recalculateTotal(key);
        }
    }

    private queueSave(key: string, value: number): void {
        this._saveQueue.set(key, value);
        this.scheduleSave();
    }

    private scheduleSave(): void {
        if (this._saveScheduled) return;
        this._saveScheduled = true;
        this._saveTimer = setTimeout(this._saveTask, this._saveDelayMs);
    }

    private flushSaveQueue(): void {
        if (this._saveQueue.size === 0) return;

        try {
            const data: IRedPointSaveData = {
                values: {},
                resetTimes: {},
                lastLoginTime: this._lastLoginTime,
            };

            const json = sys.localStorage.getItem(this._storageKey);
            if (json) {
                const existing = JSON.parse(json) as IRedPointSaveData;
                Object.assign(data.values, existing.values);
                Object.assign(data.resetTimes, existing.resetTimes);
                data.lastLoginTime = existing.lastLoginTime ?? data.lastLoginTime;
            }

            data.lastLoginTime = this._lastLoginTime;

            for (const [key, value] of this._saveQueue) {
                const config = this._configs.get(key);
                if (config?.persistType !== PersistType.Local) {
                    continue;
                }

                if (value !== 0) {
                    data.values[key] = value;
                } else {
                    delete data.values[key];
                }
            }

            this._saveQueue.clear();
            sys.localStorage.setItem(this._storageKey, JSON.stringify(data));
        } catch (error) {
            console.error('[RedPointManagerV2] saveToLocal error:', error);
        }
    }

    public saveToLocal(): void {
        if (this._saveTimer !== null) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
            this._saveScheduled = false;
        }
        this.flushSaveQueue();
    }

    public loadFromLocal(): void {
        this.loadFromLocalInternal();
    }

    private loadFromLocalInternal(): number {
        let previousLoginTime = 0;

        try {
            const json = sys.localStorage.getItem(this._storageKey);
            if (!json) {
                return 0;
            }

            const data = JSON.parse(json) as IRedPointSaveData;
            previousLoginTime = data.lastLoginTime ?? 0;
            this._lastLoginTime = previousLoginTime;

            for (const [key, value] of Object.entries(data.values ?? {})) {
                if (!key) continue;
                this._values.set(key, value);
            }
        } catch (error) {
            console.error('[RedPointManagerV2] loadFromLocal error:', error);
        }

        return previousLoginTime;
    }

    private checkResets(): void {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        for (const [key, config] of this._configs) {
            if (config.resetRule === ResetRule.Never || !config.resetRule) continue;

            const resetStorageKey = `reset_${key}`;
            const lastReset = parseInt(sys.localStorage.getItem(resetStorageKey) ?? '0', 10);

            let shouldReset = false;
            switch (config.resetRule) {
                case ResetRule.Daily:
                    shouldReset = lastReset < today;
                    break;
                case ResetRule.Weekly: {
                    const weekStart = today - now.getDay() * 24 * 60 * 60 * 1000;
                    shouldReset = lastReset < weekStart;
                    break;
                }
                case ResetRule.Monthly: {
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                    shouldReset = lastReset < monthStart;
                    break;
                }
            }

            if (!shouldReset) continue;

            this._values.set(key, 0);
            sys.localStorage.setItem(resetStorageKey, today.toString());
        }
    }

    private calculateOfflineProgress(previousLoginTime: number): void {
        if (this._isFirstInit) {
            this._isFirstInit = false;
        }

        if (!previousLoginTime) {
            return;
        }

        const offlineTime = Date.now() - previousLoginTime;
        if (offlineTime > 5 * 60 * 1000) {
            console.log(`[RedPointManagerV2] offline time: ${Math.floor(offlineTime / 60000)} min`);
        }
    }

    private normalizeKey(key: string | undefined): string {
        if (!key) return '';
        let normalized = key.trim();
        normalized = normalized.replace(/\\+/g, '/');
        while (normalized.startsWith('/')) normalized = normalized.substring(1);
        while (normalized.endsWith('/')) normalized = normalized.substring(0, normalized.length - 1);
        return normalized;
    }

    private normalizeConfig(config: IRedPointConfig): IRedPointConfig {
        const id = this.normalizeKey(config.id);
        if (!id) {
            throw new Error('[RedPointManagerV2] config.id is required');
        }

        const parentId = config.parentId ? this.normalizeKey(config.parentId) : undefined;
        if (config.parentId && !parentId) {
            throw new Error('[RedPointManagerV2] config.parentId is invalid');
        }

        return {
            ...config,
            id,
            parentId,
        };
    }

    public setRefreshStrategy(strategy: RefreshStrategy): void {
        this._refreshStrategy = strategy;
    }

    public forceFlush(): void {
        if (this._flushTimer !== null) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
            this._flushScheduled = false;
        }
        this._frameFlushScheduled = false;
        this.flushPendingUpdates();
    }

    public clear(): void {
        this._values.clear();
        this._totals.clear();
        this._dirtyKeys.clear();
        this._pendingUpdates.clear();
        this._listeners.clear();
        this._saveQueue.clear();
        this._parentPathCache.clear();
        this._iconCache.clear();
        if (this._flushTimer !== null) {
            clearTimeout(this._flushTimer);
            this._flushTimer = null;
        }
        if (this._saveTimer !== null) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        this._isFlushing = false;
        this._flushScheduled = false;
        this._saveScheduled = false;
        this._frameFlushScheduled = false;
    }

    public getAllKeys(): string[] {
        return Array.from(this._configs.keys());
    }

    public getActiveKeys(): string[] {
        const activeKeys: string[] = [];
        for (const [key, total] of this._totals) {
            if (total > 0) {
                activeKeys.push(key);
            }
        }
        return activeKeys;
    }

    public getIconCache(): Map<string, any> {
        return this._iconCache;
    }

    public setIconToCache(key: string, spriteFrame: any): void {
        this._iconCache.set(key, spriteFrame);
    }
}

export const RedPointMgr = RedPointManagerV2.instance;
