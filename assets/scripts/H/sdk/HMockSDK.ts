import type {
    HLoginResult,
    HResolvedPlatform,
    HSDKActionResult,
    HSDKActionType,
    HSDKFeature,
    HSDKInitOptions,
    HSDKLoginResult,
} from '../HTypes';
import type { HMiniGameSDKAdapter, HSDKLifecycleListener } from './HSDKAdapter';
import { hasDefaultSDKFeature } from './HSDKFeature';

/**
 * Mock SDK 用于编辑器、Web 或未接入真实平台时跑通框架流程。
 * 它不会调用 wx/tt，只模拟成功回调和生命周期事件，方便本地排查业务接入。
 */
export class HMockSDK implements HMiniGameSDKAdapter {
    public readonly platform: HResolvedPlatform;
    private config: HSDKInitOptions = {};
    private readonly showListeners = new Set<HSDKLifecycleListener>();
    private readonly hideListeners = new Set<HSDKLifecycleListener>();

    // unknown 统一降级为 mock，避免未识别平台导致 Loading 流程中断。
    public constructor(platform: HResolvedPlatform = 'mock') {
        this.platform = platform === 'unknown' ? 'mock' : platform;
    }

    public init(config: HSDKInitOptions): void {
        this.config = config;
    }

    public hasFeature(feature: HSDKFeature): boolean {
        return hasDefaultSDKFeature(this.platform, feature);
    }

    public login(): Promise<HSDKLoginResult> {
        const login: HLoginResult = {
            ok: true,
            platform: this.platform,
            code: 'mock-login-code',
            anonymousCode: 'mock-anonymous-code',
        };
        return Promise.resolve({
            ok: true,
            completed: true,
            rewardable: false,
            platform: this.platform,
            action: 'login',
            code: login.code,
            anonymousCode: login.anonymousCode,
            login,
        });
    }

    public getLaunchOptions(): unknown {
        return { scene: 'mock_launch' };
    }

    public getEnterOptions(): unknown {
        return { scene: 'mock_enter' };
    }

    public setShareMenu(): HSDKActionResult {
        return this.success('share');
    }

    public hideShareMenu(): HSDKActionResult {
        return this.success('share');
    }

    public share(): Promise<HSDKActionResult> {
        return this.delaySuccess('share');
    }

    public showFavoriteGuide(): Promise<HSDKActionResult> {
        return this.delaySuccess('favorite');
    }

    public showRevisitGuide(): Promise<HSDKActionResult> {
        return this.delaySuccess('revisit');
    }

    public checkSidebar(): Promise<HSDKActionResult> {
        return this.delaySuccess('sidebar-check');
    }

    public navigateToSidebar(): Promise<HSDKActionResult> {
        return this.delaySuccess('sidebar-navigate');
    }

    public checkShortcut(): Promise<HSDKActionResult> {
        return this.delaySuccess('shortcut-check');
    }

    public addShortcut(): Promise<HSDKActionResult> {
        return this.delaySuccess('shortcut-add');
    }

    // 测试生命周期绑定时可手动 emitShow/emitHide。
    public onShow(listener: HSDKLifecycleListener): void {
        this.showListeners.add(listener);
    }

    public offShow(listener: HSDKLifecycleListener): void {
        this.showListeners.delete(listener);
    }

    public onHide(listener: HSDKLifecycleListener): void {
        this.hideListeners.add(listener);
    }

    public offHide(listener: HSDKLifecycleListener): void {
        this.hideListeners.delete(listener);
    }

    public emitShow(raw?: unknown): void {
        this.showListeners.forEach((listener) => listener(raw));
    }

    public emitHide(raw?: unknown): void {
        this.hideListeners.forEach((listener) => listener(raw));
    }

    private delaySuccess(action: HSDKActionType): Promise<HSDKActionResult> {
        const delayMs = Math.max(0, Math.floor(this.config.actionTimeoutMs ? 80 : 60));
        return new Promise((resolve) => {
            setTimeout(() => resolve(this.success(action)), delayMs);
        });
    }

    private success(action: HSDKActionType): HSDKActionResult {
        return {
            ok: true,
            completed: true,
            rewardable: false,
            platform: this.platform,
            action,
        };
    }
}
