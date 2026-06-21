import type {
    HAnalyticsEvent,
    HAnalyticsPlatformReportOptions,
    HAnalyticsReportResult,
    HResolvedPlatform,
} from '../HTypes';

export interface HAnalyticsAdapter {
    readonly platform: HResolvedPlatform;
    isSupported(): boolean;
    report(event: HAnalyticsEvent, options: HAnalyticsPlatformReportOptions): HAnalyticsReportResult;
}

abstract class HMiniGameAnalyticsAdapter implements HAnalyticsAdapter {
    public abstract readonly platform: HResolvedPlatform;

    protected abstract getApi(): any;

    public isSupported(): boolean {
        return typeof this.getApi()?.reportAnalytics === 'function';
    }

    public report(event: HAnalyticsEvent, options: HAnalyticsPlatformReportOptions): HAnalyticsReportResult {
        if (options.enabled === false) {
            return this.fail(event, 'disabled');
        }
        if (!this.isAllowedEvent(event.name, options)) {
            return this.fail(event, 'filtered');
        }
        if (!this.hitSample(options.sampleRate)) {
            return this.fail(event, 'sampled');
        }

        const reportName = this.normalizeName(options.eventNameMap?.[event.name] || event.name);
        if (!reportName) {
            return this.fail(event, 'invalid-name');
        }

        const api = this.getApi();
        if (typeof api?.reportAnalytics !== 'function') {
            return this.fail(event, 'platform-unsupported', reportName);
        }

        try {
            api.reportAnalytics(reportName, this.normalizeData(event, options));
            return {
                ok: true,
                platform: this.platform,
                name: event.name,
                reportName,
            };
        } catch (err) {
            return this.fail(event, 'platform-error', reportName, err);
        }
    }

    private isAllowedEvent(name: string, options: HAnalyticsPlatformReportOptions): boolean {
        if (options.denyEvents && options.denyEvents.indexOf(name) >= 0) {
            return false;
        }
        if (!options.allowEvents || options.allowEvents.length === 0) {
            return true;
        }
        return options.allowEvents.indexOf(name) >= 0;
    }

    private hitSample(sampleRate?: number): boolean {
        if (typeof sampleRate !== 'number') {
            return true;
        }
        const rate = Math.max(0, Math.min(1, sampleRate));
        return rate >= 1 || Math.random() < rate;
    }

    private normalizeName(name: string): string {
        const normalized = `${name || ''}`
            .trim()
            .replace(/[^A-Za-z0-9_]/g, '_')
            .replace(/^_+/, '')
            .slice(0, 64);
        return /^[A-Za-z][A-Za-z0-9_]*$/.test(normalized) ? normalized : '';
    }

    private normalizeData(event: HAnalyticsEvent, options: HAnalyticsPlatformReportOptions): Record<string, string | number | boolean> {
        const maxKeys = Math.max(1, Math.floor(options.maxDataKeys ?? 50));
        const maxStringLength = Math.max(1, Math.floor(options.maxStringLength ?? 200));
        const raw: Record<string, unknown> = {
            ...(event.data || {}),
            h_platform: event.platform,
            h_timestamp: event.timestamp,
            h_session_ms: event.sessionDurationMs,
        };
        const data: Record<string, string | number | boolean> = {};

        Object.keys(raw).slice(0, maxKeys).forEach((key) => {
            const normalizedKey = this.normalizeKey(key);
            if (!normalizedKey) {
                return;
            }
            const value = this.normalizeValue(raw[key], maxStringLength);
            if (value !== undefined) {
                data[normalizedKey] = value;
            }
        });

        return data;
    }

    private normalizeKey(key: string): string {
        return `${key || ''}`
            .trim()
            .replace(/[^A-Za-z0-9_]/g, '_')
            .replace(/^_+/, '')
            .slice(0, 64);
    }

    private normalizeValue(value: unknown, maxStringLength: number): string | number | boolean | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }
        if (typeof value === 'string') {
            return value.slice(0, maxStringLength);
        }
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : undefined;
        }
        if (typeof value === 'boolean') {
            return value;
        }

        try {
            return JSON.stringify(value).slice(0, maxStringLength);
        } catch {
            return `${value}`.slice(0, maxStringLength);
        }
    }

    private fail(
        event: HAnalyticsEvent,
        reason: HAnalyticsReportResult['reason'],
        reportName?: string,
        raw?: unknown,
    ): HAnalyticsReportResult {
        return {
            ok: false,
            platform: this.platform,
            name: event.name,
            reportName,
            reason,
            errorMessage: this.getErrorMessage(raw),
            raw,
        };
    }

    private getErrorMessage(raw: unknown): string | undefined {
        if (!raw) {
            return undefined;
        }
        if (typeof raw === 'string') {
            return raw;
        }
        return (raw as any).message || (raw as any).errMsg || `${raw}`;
    }
}

export class HWechatAnalyticsAdapter extends HMiniGameAnalyticsAdapter {
    public readonly platform = 'wechat' as const;

    protected getApi(): any {
        return (globalThis as any).wx;
    }
}

export class HDouyinAnalyticsAdapter extends HMiniGameAnalyticsAdapter {
    public readonly platform = 'douyin' as const;

    protected getApi(): any {
        return (globalThis as any).tt;
    }
}

export class HUnsupportedAnalyticsAdapter implements HAnalyticsAdapter {
    public readonly platform: HResolvedPlatform;

    public constructor(platform: HResolvedPlatform = 'mock') {
        this.platform = platform === 'unknown' ? 'mock' : platform;
    }

    public isSupported(): boolean {
        return false;
    }

    public report(event: HAnalyticsEvent): HAnalyticsReportResult {
        return {
            ok: false,
            platform: this.platform,
            name: event.name,
            reason: 'platform-unsupported',
        };
    }
}
