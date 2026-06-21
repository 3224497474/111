import type { HDataStore } from '../data/HDataStore';
import type {
    HAnalyticsEvent,
    HAnalyticsInitOptions,
    HAnalyticsPlatformReportOptions,
    HAnalyticsReportResult,
    HAnalyticsSaveData,
    HResolvedPlatform,
} from '../HTypes';
import type { HPlatformFacade } from '../sdk/platform/HPlatformFacade';
import type { HSessionTimer } from '../session/HSessionTimer';
import {
    HDouyinAnalyticsAdapter,
    HAnalyticsAdapter,
    HUnsupportedAnalyticsAdapter,
    HWechatAnalyticsAdapter,
} from './HAnalyticsAdapters';

const DEFAULT_ANALYTICS_OPTIONS: HAnalyticsInitOptions = {
    debug: false,
    persist: true,
    storageModuleName: 'analytics',
    maxCachedEvents: 100,
    platformReport: false,
};

export class HAnalyticsFacade {
    private options: HAnalyticsInitOptions = { ...DEFAULT_ANALYTICS_OPTIONS };
    private dataStore: HDataStore | null = null;
    private platformFacade: HPlatformFacade | null = null;
    private sessionTimer: HSessionTimer | null = null;
    private platformAdapter: HAnalyticsAdapter = new HUnsupportedAnalyticsAdapter();
    private events: HAnalyticsEvent[] = [];
    private initialized = false;

    public init(
        options: HAnalyticsInitOptions = {},
        dataStore?: HDataStore,
        platformFacade?: HPlatformFacade,
        sessionTimer?: HSessionTimer,
    ): void {
        this.options = {
            ...DEFAULT_ANALYTICS_OPTIONS,
            ...options,
            maxCachedEvents: Math.max(1, Math.floor(options.maxCachedEvents ?? DEFAULT_ANALYTICS_OPTIONS.maxCachedEvents!)),
        };
        this.dataStore = dataStore || null;
        this.platformFacade = platformFacade || null;
        this.sessionTimer = sessionTimer || null;
        this.platformAdapter = this.createPlatformAdapter(this.getPlatform());
        this.initialized = true;

        if (this.options.persist !== false) {
            const saved = this.dataStore?.getModule<HAnalyticsSaveData>(this.getStorageModuleName(), {
                events: [],
                updatedAt: 0,
            });
            this.events = saved?.events || [];
        }

        this.track('analytics_init');
    }

    public track(name: string, data?: Record<string, unknown>): void {
        this.ensureInit();
        const event: HAnalyticsEvent = {
            name,
            data: data ? this.clone(data) : undefined,
            platform: this.getPlatform(),
            timestamp: Date.now(),
            sessionDurationMs: this.sessionTimer?.getOnlineDurationMs(),
        };

        this.events.push(event);
        this.trimEvents();
        this.save(false);
        const reportResult = this.reportToPlatform(event);

        if (this.options.debug) {
            console.log('[HAnalytics]', name, data || {}, reportResult || '');
        }
    }

    public error(name: string, error: unknown, data?: Record<string, unknown>): void {
        this.track(name, {
            ...(data || {}),
            errorMessage: this.getErrorMessage(error),
            errorStack: this.getErrorStack(error),
        });
    }

    public getEvents(): HAnalyticsEvent[] {
        this.ensureInit();
        return this.clone(this.events);
    }

    public reportEventToPlatform(name: string, data?: Record<string, unknown>): HAnalyticsReportResult {
        this.ensureInit();
        const event: HAnalyticsEvent = {
            name,
            data: data ? this.clone(data) : undefined,
            platform: this.getPlatform(),
            timestamp: Date.now(),
            sessionDurationMs: this.sessionTimer?.getOnlineDurationMs(),
        };
        return this.reportToPlatform(event) || {
            ok: false,
            platform: event.platform,
            name,
            reason: 'disabled',
        };
    }

    public clear(): void {
        this.events = [];
        this.save(true);
    }

    public async flush(): Promise<void> {
        this.ensureInit();
        if (this.events.length === 0) {
            return;
        }

        const events = this.getEvents();
        if (this.options.uploader) {
            await this.options.uploader(events);
            this.clear();
            return;
        }

        this.save(true);
    }

    private trimEvents(): void {
        const max = this.options.maxCachedEvents || 100;
        if (this.events.length <= max) {
            return;
        }
        this.events = this.events.slice(this.events.length - max);
    }

    private save(immediate: boolean): void {
        if (this.options.persist === false || !this.dataStore) {
            return;
        }
        this.dataStore.setModule<HAnalyticsSaveData>(this.getStorageModuleName(), {
            events: this.clone(this.events),
            updatedAt: Date.now(),
        }, { immediate });
    }

    private getStorageModuleName(): string {
        return this.options.storageModuleName?.trim() || 'analytics';
    }

    private getPlatform(): HResolvedPlatform {
        return this.platformFacade?.getPlatform() || 'mock';
    }

    private createPlatformAdapter(platform: HResolvedPlatform): HAnalyticsAdapter {
        if (platform === 'wechat') {
            return new HWechatAnalyticsAdapter();
        }
        if (platform === 'douyin') {
            return new HDouyinAnalyticsAdapter();
        }
        return new HUnsupportedAnalyticsAdapter(platform);
    }

    private reportToPlatform(event: HAnalyticsEvent): HAnalyticsReportResult | null {
        const options = this.getPlatformReportOptions();
        if (!options.enabled) {
            return null;
        }

        const ret = this.platformAdapter.report(event, options);
        if (this.options.debug && !ret.ok && ret.reason !== 'filtered' && ret.reason !== 'sampled') {
            console.warn('[HAnalytics] platform report failed', ret);
        }
        return ret;
    }

    private getPlatformReportOptions(): HAnalyticsPlatformReportOptions {
        const configured = this.options.platformReport;
        if (configured === true) {
            return { enabled: true };
        }
        if (!configured) {
            return { enabled: false };
        }
        return {
            ...configured,
            enabled: configured.enabled !== false,
        };
    }

    private getErrorMessage(error: unknown): string {
        if (!error) {
            return '';
        }
        if (typeof error === 'string') {
            return error;
        }
        return (error as any).message || `${error}`;
    }

    private getErrorStack(error: unknown): string {
        return error && typeof error === 'object' ? ((error as any).stack || '') : '';
    }

    private clone<T>(value: T): T {
        if (value === undefined || value === null) {
            return value;
        }
        return JSON.parse(JSON.stringify(value)) as T;
    }

    private ensureInit(): void {
        if (!this.initialized) {
            this.init();
        }
    }
}
