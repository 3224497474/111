import type {
    HClipboardOptions,
    HFavoriteGuideOptions,
    HLoginResult,
    HResolvedPlatform,
    HRevisitGuideOptions,
    HSDKActionReason,
    HSDKActionResult,
    HSDKActionType,
    HSDKFeature,
    HSDKInitOptions,
    HSDKLoginResult,
    HSDKSourceFlags,
    HShareMenuOptions,
    HShareOptions,
    HShortcutOptions,
    HSidebarOptions,
} from '../HTypes';
import type { HMiniGameSDKAdapter, HSDKLifecycleListener } from './HSDKAdapter';
import { hasDefaultSDKFeature } from './HSDKFeature';

export type HOfficialCallbackInvoker = (callbacks: {
    success: (raw?: unknown) => void;
    fail: (raw?: unknown) => void;
}) => unknown;

/**
 * 微信/抖音 SDK adapter 公共基类。
 *
 * 注意：这里不再按字符串动态调用 wx/tt API。
 * 具体平台 API 的官方写法放在 HWxSDK / HDySDK 中，方便直接对照官方文档排查。
 * 本基类只保留：初始化、生命周期、来源解析、结果归一化、callback -> Promise。
 */
export abstract class HBaseSDK implements HMiniGameSDKAdapter {
    public abstract readonly platform: HResolvedPlatform;
    protected config: HSDKInitOptions = {};

    public abstract getApi(): any;

    public init(config: HSDKInitOptions): void {
        this.config = config;
    }

    public hasFeature(feature: HSDKFeature): boolean {
        return hasDefaultSDKFeature(this.platform, feature);
    }

    public login(): Promise<HSDKLoginResult> {
        return Promise.resolve(this.loginFail('platform-unsupported', 'platform login unsupported'));
    }

    public restartProgram(): HSDKActionResult {
        return this.unsupported('restart');
    }

    public getLaunchOptions(): unknown {
        const api = this.getApi();
        try {
            return api?.getLaunchOptionsSync?.() || null;
        } catch (error) {
            return error;
        }
    }

    public getEnterOptions(): unknown {
        const api = this.getApi();
        try {
            return api?.getEnterOptionsSync?.() || api?.getLaunchOptionsSync?.() || null;
        } catch (error) {
            return error;
        }
    }

    public getSourceFlags(): HSDKSourceFlags {
        const launchOptions = this.getLaunchOptions();
        const enterOptions = this.getEnterOptions();
        return {
            ...this.parseSourceFlags(launchOptions, enterOptions),
            rawLaunchOptions: launchOptions,
            rawEnterOptions: enterOptions,
        };
    }

    public setShareMenu(_options: HShareMenuOptions = {}): HSDKActionResult {
        return this.unsupported('share');
    }

    public hideShareMenu(): HSDKActionResult {
        return this.unsupported('share');
    }

    public share(_options: HShareOptions = {}): Promise<HSDKActionResult> {
        return Promise.resolve(this.unsupported('share'));
    }

    public copyText(_text: string, _options: HClipboardOptions = {}): Promise<HSDKActionResult> {
        return Promise.resolve(this.unsupported('clipboard-copy'));
    }

    public triggerGC(): HSDKActionResult {
        return this.unsupported('gc');
    }

    public showFavoriteGuide(_options: HFavoriteGuideOptions = {}): Promise<HSDKActionResult> {
        return Promise.resolve(this.unsupported('favorite'));
    }

    public showRevisitGuide(_options: HRevisitGuideOptions = {}): Promise<HSDKActionResult> {
        return Promise.resolve(this.unsupported('revisit'));
    }

    public checkSidebar(_options: HSidebarOptions = {}): Promise<HSDKActionResult> {
        return Promise.resolve(this.unsupported('sidebar-check'));
    }

    public navigateToSidebar(_options: HSidebarOptions = {}): Promise<HSDKActionResult> {
        return Promise.resolve(this.unsupported('sidebar-navigate'));
    }

    public checkShortcut(_options: HShortcutOptions = {}): Promise<HSDKActionResult> {
        return Promise.resolve(this.unsupported('shortcut-check'));
    }

    public addShortcut(_options: HShortcutOptions = {}): Promise<HSDKActionResult> {
        return Promise.resolve(this.unsupported('shortcut-add'));
    }

    public onShow(listener: HSDKLifecycleListener): void {
        this.getApi()?.onShow?.(listener);
    }

    public offShow(listener: HSDKLifecycleListener): void {
        this.getApi()?.offShow?.(listener);
    }

    public onHide(listener: HSDKLifecycleListener): void {
        this.getApi()?.onHide?.(listener);
    }

    public offHide(listener: HSDKLifecycleListener): void {
        this.getApi()?.offHide?.(listener);
    }

    /**
     * 平台官方 API 大多是：xxx({ success(res) {}, fail(err) {} })。
     * 子类负责把官方 API 明确写出来，本方法只负责超时、异常和结果归一化。
     */
    protected callOfficialCallbackApi<T extends HSDKActionResult>(
        action: HSDKActionType,
        invoke: HOfficialCallbackInvoker,
        onSuccess: (raw: unknown) => T,
        onFail: (reason: HSDKActionReason, raw: unknown, errorMessage?: string) => T,
    ): Promise<T> {
        const timeoutMs = Math.max(1000, Math.floor(this.config.actionTimeoutMs ?? 12000));

        return new Promise((resolve) => {
            let settled = false;
            let timer: ReturnType<typeof setTimeout> | null = null;

            const settle = (result: T) => {
                if (settled) {
                    return;
                }
                settled = true;
                if (timer) {
                    clearTimeout(timer);
                }
                resolve(result);
            };

            const success = (raw?: unknown) => {
                settle(onSuccess(raw));
            };

            const fail = (raw?: any) => {
                const message = raw?.errMsg || raw?.message || `${action} failed`;
                settle(onFail(this.mapFailReason(raw), raw, message));
            };

            timer = setTimeout(() => {
                settle(onFail('timeout', undefined, 'platform callback timeout'));
            }, timeoutMs);

            try {
                const ret = invoke({ success, fail });
                if (ret && typeof (ret as any).then === 'function') {
                    (ret as Promise<unknown>).then(success, fail);
                }
            } catch (error: any) {
                fail(error);
            }
        });
    }

    protected buildSharePayload(options: HShareOptions | HShareMenuOptions): Record<string, unknown> {
        return {
            title: options.title,
            imageUrl: options.imageUrl,
            query: options.query,
            ...(options.extra || {}),
        };
    }

    protected detectCompleted(raw: unknown, defaultValue: boolean): boolean {
        if (!raw || typeof raw !== 'object') {
            return defaultValue;
        }

        const data = raw as Record<string, any>;
        const keys = [
            'completed',
            'success',
            'isEnded',
            'isFavorited',
            'isFavorite',
            'isCollected',
            'isExist',
            'exist',
            'exists',
            'installed',
            'isAdded',
            'hasShortcut',
        ];

        for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                return this.toBoolean(data[key], defaultValue);
            }
        }

        if (data.status && typeof data.status === 'object') {
            return this.detectCompleted(data.status, defaultValue);
        }

        return defaultValue;
    }

    protected toBoolean(value: unknown, defaultValue: boolean): boolean {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            return value > 0;
        }
        if (typeof value === 'string') {
            const normalized = value.toLowerCase();
            if (normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'ok') {
                return true;
            }
            if (normalized === 'false' || normalized === 'no' || normalized === '0') {
                return false;
            }
        }
        return defaultValue;
    }

    protected parseSourceFlags(...sources: unknown[]): Omit<HSDKSourceFlags, 'rawLaunchOptions' | 'rawEnterOptions'> {
        const text = sources
            .map((source) => this.safeStringify(source))
            .join('|')
            .toLowerCase();

        return {
            fromSidebar: text.indexOf('sidebar') >= 0 || text.indexOf('021036') >= 0 || text.indexOf('101036') >= 0,
            fromDesk: text.indexOf('shortcut') >= 0
                || text.indexOf('desktop') >= 0
                || text.indexOf('desk') >= 0
                || text.indexOf('021020') >= 0
                || text.indexOf('101020') >= 0
                || text.indexOf('011020') >= 0
                || text.indexOf('061020') >= 0,
            fromFeed1: text.indexOf('feed1') >= 0 || text.indexOf('revisit') >= 0,
            fromFeed2: text.indexOf('feed2') >= 0 || text.indexOf('acquisition') >= 0 || text.indexOf('growth') >= 0,
        };
    }

    protected safeStringify(value: unknown): string {
        if (value === undefined || value === null) {
            return '';
        }
        if (typeof value === 'string') {
            return value;
        }

        try {
            return JSON.stringify(value);
        } catch {
            return `${value}`;
        }
    }

    protected mapFailReason(raw: any): HSDKActionReason {
        const message = `${raw?.errMsg || raw?.message || ''}`.toLowerCase();
        if (message.indexOf('cancel') >= 0) {
            return 'cancelled';
        }
        if (message.indexOf('not support') >= 0 || message.indexOf('unsupported') >= 0) {
            return 'platform-unsupported';
        }
        return 'failed';
    }

    protected actionSuccess(action: HSDKActionType, raw?: unknown, completed = true): HSDKActionResult {
        return {
            ok: true,
            completed,
            rewardable: false,
            platform: this.platform,
            action,
            raw,
        };
    }

    protected actionFail(
        action: HSDKActionType,
        reason: HSDKActionReason,
        raw?: unknown,
        errorCode?: string | number,
        errorMessage?: string,
    ): HSDKActionResult {
        return {
            ok: false,
            completed: false,
            rewardable: false,
            platform: this.platform,
            action,
            reason,
            raw,
            errorCode,
            errorMessage,
            userMessage: this.getUserMessage(reason),
        };
    }

    protected unsupported(action: HSDKActionType): HSDKActionResult {
        return this.actionFail(action, 'platform-unsupported', undefined, undefined, 'platform api unsupported');
    }

    protected loginSuccess(raw: any): HSDKLoginResult {
        const login: HLoginResult = {
            ok: true,
            platform: this.platform,
            code: raw?.code,
            anonymousCode: raw?.anonymousCode,
            raw,
        };

        return {
            ...this.actionSuccess('login', raw, true),
            action: 'login',
            code: login.code,
            anonymousCode: login.anonymousCode,
            login,
        };
    }

    protected loginFail(reason: HSDKActionReason, errorMessage?: string, raw?: unknown): HSDKLoginResult {
        const login: HLoginResult = {
            ok: false,
            platform: this.platform,
            errorMessage,
            raw,
        };
        return {
            ...this.actionFail('login', reason, raw, (raw as any)?.errCode || (raw as any)?.errno, errorMessage),
            action: 'login',
            login,
        };
    }

    protected completedResult(action: HSDKActionType, raw: unknown, defaultValue = true): HSDKActionResult {
        const completed = this.detectCompleted(raw, defaultValue);
        return completed
            ? this.actionSuccess(action, raw, true)
            : this.actionFail(action, 'not-completed', raw);
    }

    protected getUserMessage(reason: HSDKActionReason): string {
        switch (reason) {
            case 'busy':
                return 'action busy';
            case 'cooldown':
                return 'action cooldown';
            case 'cancelled':
                return 'action cancelled';
            case 'not-completed':
                return 'action not completed';
            case 'platform-unsupported':
                return 'platform unsupported';
            case 'timeout':
                return 'platform callback timeout';
            case 'config-missing':
                return 'config missing';
            default:
                return 'platform action failed';
        }
    }
}
