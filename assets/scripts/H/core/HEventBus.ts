import type { HEventNameLike, HEventPayload } from './HEventNames';
import { HEventName } from './HEventNames';

export type HEventId = number;
export type HEventListener<T = unknown> = (payload: T) => void;

export interface HEventListenOptions {
    /**
     * true 表示事件只触发一次，触发完成后由事件总线自动注销。
     */
    once?: boolean;

    /**
     * 订阅归属来源。UI 基类会自动写入 uiId，方便排查哪个界面没有释放事件。
     */
    owner?: string;
}

export interface HEventSubscriptionInfo {
    id: HEventId;
    eventName: string;
    owner?: string;
    once: boolean;
    active: boolean;
    createdAt: number;
    emitCount: number;
    lastEmitAt?: number;
}

interface HEventRecord extends HEventSubscriptionInfo {
    listener: HEventListener;
}

/**
 * HEventBus 是框架级事件中心。
 *
 * 设计规则：
 * 1. 订阅事件必须返回唯一 eventId，外部使用 eventId 注销，避免必须保存 listener 引用。
 * 2. 事件名仍然支持枚举，项目层建议封装 ProjectEvent 函数 API，业务 UI 不直接散写字符串。
 * 3. UI 内部订阅事件时由 HUIViewBase 接管生命周期，UI 关闭/销毁时统一 off(eventId)。
 */
export class HEventBus {
    private eventIdSeed = 0;
    private readonly listeners = new Map<string, Map<HEventId, HEventRecord>>();
    private readonly records = new Map<HEventId, HEventRecord>();

    public onHInit(listener: () => void): HEventId {
        return this.on(HEventName.HInit, () => listener());
    }

    public emitHInit(): void {
        this.emit(HEventName.HInit);
    }

    public onUIRequestOpen(listener: (id: string, params?: unknown) => void): HEventId {
        return this.on(HEventName.UIRequestOpen, (payload) => listener(payload.id, payload.params));
    }

    public emitUIRequestOpen(id: string, params?: unknown): void {
        this.emit(HEventName.UIRequestOpen, { id, params });
    }

    public onUIRequestClose(listener: (id: string, reason?: string) => void): HEventId {
        return this.on(HEventName.UIRequestClose, (payload) => listener(payload.id, payload.reason));
    }

    public emitUIRequestClose(id: string, reason?: string): void {
        this.emit(HEventName.UIRequestClose, { id, reason });
    }

    public onUIRequestRefresh(listener: (id: string, params?: unknown) => void): HEventId {
        return this.on(HEventName.UIRequestRefresh, (payload) => listener(payload.id, payload.params));
    }

    public emitUIRequestRefresh(id: string, params?: unknown): void {
        this.emit(HEventName.UIRequestRefresh, { id, params });
    }

    public onUITabChanged(listener: (currentId: number, previousId: number, pageId: string, reason: string) => void): HEventId {
        return this.on(HEventName.UITabChanged, (payload) => {
            listener(payload.currentId, payload.previousId, payload.pageId, payload.reason);
        });
    }

    public emitUITabChanged(currentId: number, previousId: number, pageId: string, reason: string): void {
        this.emit(HEventName.UITabChanged, {
            currentId,
            previousId,
            pageId,
            reason,
        });
    }

    public onStoreChanged(listener: (module: string, paths: string[]) => void): HEventId {
        return this.on(HEventName.StoreChanged, (payload) => listener(payload.module, payload.paths));
    }

    public emitStoreChanged(module: string, paths: string[]): void {
        this.emit(HEventName.StoreChanged, { module, paths });
    }

    public onSDKLoginSuccess(listener: (platform: string, raw?: unknown) => void): HEventId {
        return this.on(HEventName.SDKLoginSuccess, (payload) => listener(payload.platform, payload.raw));
    }

    public emitSDKLoginSuccess(platform: string, raw?: unknown): void {
        this.emit(HEventName.SDKLoginSuccess, { platform, raw });
    }

    public onSDKLoginFail(listener: (platform: string, reason?: string, raw?: unknown) => void): HEventId {
        return this.on(HEventName.SDKLoginFail, (payload) => listener(payload.platform, payload.reason, payload.raw));
    }

    public emitSDKLoginFail(platform: string, reason?: string, raw?: unknown): void {
        this.emit(HEventName.SDKLoginFail, { platform, reason, raw });
    }

    public onAdRewarded(listener: (placement: string, raw?: unknown) => void): HEventId {
        return this.on(HEventName.AdRewarded, (payload) => listener(payload.placement, payload.raw));
    }

    public emitAdRewarded(placement: string, raw?: unknown): void {
        this.emit(HEventName.AdRewarded, { placement, raw });
    }

    public onAdClosed(listener: (placement: string, rewarded?: boolean, raw?: unknown) => void): HEventId {
        return this.on(HEventName.AdClosed, (payload) => listener(payload.placement, payload.rewarded, payload.raw));
    }

    public emitAdClosed(placement: string, rewarded?: boolean, raw?: unknown): void {
        this.emit(HEventName.AdClosed, { placement, rewarded, raw });
    }

    public onSystemLanguageChanged(listener: (language: string) => void): HEventId {
        return this.on(HEventName.SystemLanguageChanged, (payload) => listener(payload.language));
    }

    public emitSystemLanguageChanged(language: string): void {
        this.emit(HEventName.SystemLanguageChanged, { language });
    }

    /**
     * 注册事件并返回唯一 eventId。
     *
     * 企业框架里不建议只返回取消函数，因为函数没有稳定 id，不方便统一托管、
     * 泄漏排查、批量注销和调试面板展示。
     */
    public on<TName extends HEventNameLike, TPayload = HEventPayload<TName>>(
        eventName: TName,
        listener: HEventListener<TPayload>,
        options: HEventListenOptions = {},
    ): HEventId {
        const normalizedEventName = this.normalizeEventName(eventName);
        if (!normalizedEventName) {
            throw new Error('[HEventBus] eventName 不能为空');
        }

        const id = this.createEventId();
        const record: HEventRecord = {
            id,
            eventName: normalizedEventName,
            owner: options.owner,
            once: !!options.once,
            active: true,
            createdAt: Date.now(),
            emitCount: 0,
            listener: listener as HEventListener,
        };

        let eventListeners = this.listeners.get(normalizedEventName);
        if (!eventListeners) {
            eventListeners = new Map();
            this.listeners.set(normalizedEventName, eventListeners);
        }

        eventListeners.set(id, record);
        this.records.set(id, record);
        return id;
    }

    /**
     * 注册一次性事件。触发一次后自动 off(eventId)。
     */
    public once<TName extends HEventNameLike, TPayload = HEventPayload<TName>>(
        eventName: TName,
        listener: HEventListener<TPayload>,
        options: Omit<HEventListenOptions, 'once'> = {},
    ): HEventId {
        return this.on(eventName, listener, {
            ...options,
            once: true,
        });
    }

    public off(eventId: HEventId): void;
    public off<TName extends HEventNameLike, TPayload = HEventPayload<TName>>(
        eventName: TName,
        listener: HEventListener<TPayload>,
    ): void;

    /**
     * 注销事件。
     *
     * 推荐写法：H.event.off(eventId)。
     * 兼容写法：H.event.off(eventName, listener)，用于少量旧代码迁移。
     */
    public off<TName extends HEventNameLike, TPayload = HEventPayload<TName>>(
        eventIdOrEventName: HEventId | TName,
        listener?: HEventListener<TPayload>,
    ): void {
        if (typeof eventIdOrEventName === 'number') {
            this.offById(eventIdOrEventName);
            return;
        }

        if (!listener) {
            return;
        }

        this.removeListener(this.normalizeEventName(eventIdOrEventName), listener as HEventListener);
    }

    public offById(eventId: HEventId): void {
        const record = this.records.get(eventId);
        if (!record) {
            return;
        }

        const eventListeners = this.listeners.get(record.eventName);
        eventListeners?.delete(eventId);
        if (eventListeners && eventListeners.size === 0) {
            this.listeners.delete(record.eventName);
        }

        record.active = false;
        this.records.delete(eventId);
    }

    /**
     * 派发事件。每个 listener 独立 try/catch，避免单个 UI 报错影响其他模块。
     */
    public emit<TName extends HEventNameLike, TPayload = HEventPayload<TName>>(
        eventName: TName,
        payload?: TPayload,
    ): void {
        const normalizedEventName = this.normalizeEventName(eventName);
        const eventListeners = this.listeners.get(normalizedEventName);
        if (!eventListeners) {
            return;
        }

        [...eventListeners.values()].forEach((record) => {
            if (!record.active) {
                return;
            }

            try {
                record.emitCount += 1;
                record.lastEmitAt = Date.now();
                record.listener(payload as TPayload);
            } catch (error) {
                console.error(`[HEventBus] ${normalizedEventName} listener error:`, error);
            }

            if (record.once) {
                this.offById(record.id);
            }
        });
    }

    /**
     * 查询订阅是否仍然有效。调试面板和 UI 基类都可以用它判断 id 是否已被释放。
     */
    public has(eventId: HEventId): boolean {
        return this.records.has(eventId);
    }

    public getSubscriptionInfo(eventId: HEventId): HEventSubscriptionInfo | null {
        const record = this.records.get(eventId);
        return record ? this.toInfo(record) : null;
    }

    public getSubscriptionInfos(eventName?: HEventNameLike): HEventSubscriptionInfo[] {
        if (!eventName) {
            return [...this.records.values()].map((record) => this.toInfo(record));
        }

        const eventListeners = this.listeners.get(this.normalizeEventName(eventName));
        if (!eventListeners) {
            return [];
        }

        return [...eventListeners.values()].map((record) => this.toInfo(record));
    }

    public getListenerCount(eventName?: HEventNameLike): number {
        if (!eventName) {
            return this.records.size;
        }

        return this.listeners.get(this.normalizeEventName(eventName))?.size || 0;
    }

    /**
     * 清理事件。传 eventName 时只清理这个事件；不传时清空全部订阅。
     * 这个方法通常只在切场景、退出账号、框架重置时使用。
     */
    public clear(eventName?: HEventNameLike): void {
        if (eventName) {
            const normalizedEventName = this.normalizeEventName(eventName);
            const eventListeners = this.listeners.get(normalizedEventName);
            if (!eventListeners) {
                return;
            }

            [...eventListeners.keys()].forEach((id) => this.offById(id));
            return;
        }

        [...this.records.keys()].forEach((id) => this.offById(id));
    }

    private removeListener(eventName: string, listener: HEventListener): void {
        const eventListeners = this.listeners.get(eventName);
        if (!eventListeners) {
            return;
        }

        [...eventListeners.values()]
            .filter((record) => record.listener === listener)
            .forEach((record) => this.offById(record.id));
    }

    private createEventId(): HEventId {
        this.eventIdSeed += 1;
        if (this.eventIdSeed >= Number.MAX_SAFE_INTEGER) {
            this.eventIdSeed = 1;
        }
        return this.eventIdSeed;
    }

    private toInfo(record: HEventRecord): HEventSubscriptionInfo {
        return {
            id: record.id,
            eventName: record.eventName,
            owner: record.owner,
            once: record.once,
            active: record.active,
            createdAt: record.createdAt,
            emitCount: record.emitCount,
            lastEmitAt: record.lastEmitAt,
        };
    }

    private normalizeEventName(eventName: HEventNameLike): string {
        return String(eventName || '').trim();
    }
}
