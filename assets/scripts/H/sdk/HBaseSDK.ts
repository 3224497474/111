import type {
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
    HShareMenuOptions,
    HShareOptions,
    HShortcutOptions,
    HSidebarOptions,
} from '../HTypes';
import type { HMiniGameSDKAdapter, HSDKLifecycleListener } from './HSDKAdapter';
import { hasDefaultSDKFeature } from './HSDKFeature';

/**
 * HBaseSDK 是微信/抖音这类小游戏平台 adapter 的公共基类。
 *
 * 子类只需要实现 platform 和 getApi()，本类负责：
 * - 把平台 callback API 统一转成 Promise。
 * - 把 success/fail/timeout 统一归一化成 HSDKActionResult。
 * - 从平台回调字段里判断 completed，供 HSDKFacade 计算 rewardable。
 */
export abstract class HBaseSDK implements HMiniGameSDKAdapter {
    public abstract readonly platform: HResolvedPlatform;
    protected config: HSDKInitOptions = {};

    public abstract getApi(): any;

    // 保存统一 SDK 配置，主要给 callback 超时和分享菜单参数使用。
    public init(config: HSDKInitOptions): void {
        this.config = config;
    }

    public hasFeature(feature: HSDKFeature): boolean {
        return hasDefaultSDKFeature(this.platform, feature);
    }

    // 登录只负责平台 login code，奖励判定固定为 false，业务奖励不要依赖 login。
    public login(): Promise<HSDKLoginResult> {
        const api = this.getApi();
        if (!api?.login) {
            return Promise.resolve(this.loginFail('platform-unsupported', 'platform login unsupported'));
        }

        return this.callWithCallbacks<HSDKLoginResult>('login', {}, (raw) => {
            const login: HLoginResult = {
                ok: true,
                platform: this.platform,
                code: (raw as any)?.code,
                anonymousCode: (raw as any)?.anonymousCode,
                raw,
            };
            return {
                ...this.actionSuccess('login', raw, true),
                action: 'login',
                code: login.code,
                anonymousCode: login.anonymousCode,
                login,
            };
        }, (reason, raw, errorMessage) => this.loginFail(reason, errorMessage, raw));
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

    // 分享菜单属于平台全局设置，成功只代表菜单打开成功，不代表玩家完成分享。
    public setShareMenu(options: HShareMenuOptions = {}): HSDKActionResult {
        const api = this.getApi();
        if (!api?.showShareMenu && !api?.onShareAppMessage) {
            return this.unsupported('share');
        }

        const payload = this.buildSharePayload(options);
        try {
            api.showShareMenu?.({
                withShareTicket: options.withShareTicket,
                menus: options.menus,
                ...(options.extra || {}),
            });
            if (api.onShareAppMessage) {
                api.onShareAppMessage(() => payload);
            }
            return this.actionSuccess('share', undefined, true);
        } catch (error: any) {
            return this.actionFail('share', 'failed', error, error?.errCode, error?.errMsg || error?.message);
        }
    }

    public hideShareMenu(): HSDKActionResult {
        const api = this.getApi();
        if (!api?.hideShareMenu) {
            return this.unsupported('share');
        }

        try {
            api.hideShareMenu();
            return this.actionSuccess('share', undefined, true);
        } catch (error: any) {
            return this.actionFail('share', 'failed', error, error?.errCode, error?.errMsg || error?.message);
        }
    }

    public share(options: HShareOptions = {}): Promise<HSDKActionResult> {
        const payload = this.buildSharePayload(options);
        return this.callApiAction('share', 'shareAppMessage', payload, (raw) => this.detectCompleted(raw, true));
    }

    // 收藏、复访、侧边栏、添加桌面都统一走 callApiAction，输出相同结构给业务层。
    public showFavoriteGuide(options: HFavoriteGuideOptions = {}): Promise<HSDKActionResult> {
        return this.callApiAction('favorite', 'showFavoriteGuide', {
            type: options.type,
            content: options.content,
            position: options.position,
            ...(options.extra || {}),
        }, (raw) => this.detectCompleted(raw, true));
    }

    public showRevisitGuide(options: HRevisitGuideOptions = {}): Promise<HSDKActionResult> {
        return this.callApiAction('revisit', 'showRevisitGuide', {
            scene: options.scene,
            content: options.content,
            ...(options.extra || {}),
        }, (raw) => this.detectCompleted(raw, true));
    }

    public checkSidebar(options: HSidebarOptions = {}): Promise<HSDKActionResult> {
        return this.callApiAction('sidebar-check', 'checkScene', {
            scene: options.scene || 'sidebar',
            ...(options.extra || {}),
        }, (raw) => this.detectCompleted(raw, true));
    }

    public navigateToSidebar(options: HSidebarOptions = {}): Promise<HSDKActionResult> {
        return this.callApiAction('sidebar-navigate', 'navigateToScene', {
            scene: options.scene || 'sidebar',
            ...(options.extra || {}),
        }, (raw) => this.detectCompleted(raw, true));
    }

    public checkShortcut(options: HShortcutOptions = {}): Promise<HSDKActionResult> {
        return this.callApiAction('shortcut-check', 'checkShortcut', {
            ...(options.extra || {}),
        }, (raw) => this.detectCompleted(raw, true));
    }

    public addShortcut(options: HShortcutOptions = {}): Promise<HSDKActionResult> {
        return this.callApiAction('shortcut-add', 'addShortcut', {
            ...(options.extra || {}),
        }, (raw) => this.detectCompleted(raw, true));
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

    // 将某个具体平台 API 包一层：不存在则 unsupported，存在则走统一 success/fail/timeout。
    protected callApiAction(
        action: HSDKActionType,
        apiName: string,
        payload: Record<string, unknown>,
        completedDetector: (raw: unknown) => boolean,
    ): Promise<HSDKActionResult> {
        const api = this.getApi();
        if (!api?.[apiName]) {
            return Promise.resolve(this.unsupported(action));
        }

        return this.callWithCallbacks(apiName, payload, (raw) => {
            const completed = completedDetector(raw);
            return completed
                ? this.actionSuccess(action, raw, true)
                : this.actionFail(action, 'not-completed', raw);
        }, (reason, raw, errorMessage) => this.actionFail(
            action,
            reason,
            raw,
            (raw as any)?.errCode || (raw as any)?.errno,
            errorMessage,
        ));
    }

    // 微信/抖音 API 大多是 success/fail callback，这里统一处理超时、Promise 返回值和异常。
    protected callWithCallbacks<T extends HSDKActionResult>(
        apiName: string,
        payload: Record<string, unknown>,
        onSuccess: (raw: unknown) => T,
        onFail: (reason: HSDKActionReason, raw: unknown, errorMessage?: string) => T,
    ): Promise<T> {
        const api = this.getApi();
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

            timer = setTimeout(() => {
                settle(onFail('timeout', undefined, 'platform callback timeout'));
            }, timeoutMs);

            const success = (raw: unknown) => {
                settle(onSuccess(raw));
            };

            const fail = (raw: any) => {
                const message = raw?.errMsg || raw?.message || 'platform api failed';
                settle(onFail(this.mapFailReason(raw), raw, message));
            };

            try {
                const ret = api[apiName]({
                    ...payload,
                    success,
                    fail,
                });

                if (ret && typeof ret.then === 'function') {
                    ret.then(success, fail);
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

    // 不同平台完成态字段不完全一致，这里集中兼容，避免业务层到处写 isEnded/isAdded 等判断。
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

    // 结果构造统一放在底部，方便排查某个字段为什么出现在业务回调里。
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
