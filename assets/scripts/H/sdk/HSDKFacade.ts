import type { HAdFacade } from './ad/HAdFacade';
import type { HConfigFacade } from '../config/HConfigFacade';
import type { HDataStore } from '../data/HDataStore';
import type {
    HAdBannerOptions,
    HAdPreloadResult,
    HAdRewardCallback,
    HAdRewardResult,
    HAdShowResult,
    HAdStats,
    HClipboardOptions,
    HFavoriteGuideOptions,
    HResolvedPlatform,
    HRevisitGuideOptions,
    HSDKActionCallbacks,
    HSDKActionOptions,
    HSDKActionReason,
    HSDKActionResult,
    HSDKActionType,
    HSDKFeature,
    HSDKInitOptions,
    HSDKLoginResult,
    HSDKRewardPolicy,
    HSDKSessionSaveData,
    HSDKSourceFlags,
    HScreenAdaptOptions,
    HScreenAdaptResult,
    HScreenInfo,
    HSessionSnapshot,
    HShareMenuOptions,
    HShareOptions,
    HShortcutOptions,
    HSidebarOptions,
} from '../HTypes';
import type { HPlatformFacade } from './platform/HPlatformFacade';
import type { HScreenFacade } from './HScreenFacade';
import type { HSessionTimer } from '../session/HSessionTimer';
import { HMockSDK } from './HMockSDK';
import type { HMiniGameSDKAdapter } from './HSDKAdapter';
import { HDefaultSDKRegistry, HSDKAdapterConstructor, HSDKRegistry } from './HSDKRegistry';

/**
 * HSDKFacade 是 H.sdk 的统一入口。
 *
 * 排查 SDK 问题时建议按下面的链路看：
 * 1. init：读取平台层结果，根据 registry 创建 wx/dy/mock adapter，并绑定生命周期。
 * 2. login：调用平台登录并保存登录返回值，Loading 阶段通常先走这里。
 * 3. share/favorite/sidebar/shortcut：统一走 runAction，处理锁、冷却、完成判定和 rewardable。
 * 4. showReward/showInterstitial/showBanner：广告能力统一转给 HAdFacade。
 * 5. saveSession/loadSavedSession：保存登录、启动参数和进入参数，便于重启后恢复排查。
 */
const DEFAULT_SDK_CONFIG: HSDKInitOptions = {
    actionTimeoutMs: 12000,
    actionCooldownMs: 0,
    actionCooldowns: {
        'ad-reward': 30000,
        'ad-interstitial': 30000,
    },
    sessionStorageModuleName: 'platformSession',
    autoSaveLogin: true,
};

export class HSDKFacade {
    // Facade 只保存依赖和当前 adapter；具体微信/抖音 API 不在业务层直接调用。
    private config: HSDKInitOptions = { ...DEFAULT_SDK_CONFIG };
    private dataStore: HDataStore | null = null;
    private configFacade: HConfigFacade | null = null;
    private platformFacade: HPlatformFacade | null = null;
    private adFacade: HAdFacade | null = null;
    private sessionTimer: HSessionTimer | null = null;
    private screenFacade: HScreenFacade | null = null;
    private adapter: HMiniGameSDKAdapter = new HMockSDK();
    private registry: HSDKRegistry = HDefaultSDKRegistry;
    private platform: HResolvedPlatform = 'mock';
    private initialized = false;
    private loginResult: HSDKLoginResult | null = null;
    private sourceFlags: HSDKSourceFlags | null = null;

    /**
     * 初始化 SDK。
     * 平台识别由 HPlatformFacade 完成，SDK 这里只根据平台实例化对应 adapter。
     */
    public init(
        config: HSDKInitOptions = {},
        dataStore?: HDataStore,
        platformFacade?: HPlatformFacade,
        adFacade?: HAdFacade,
        sessionTimer?: HSessionTimer,
        configFacade?: HConfigFacade,
        screenFacade?: HScreenFacade,
    ): void {
        this.config = {
            ...DEFAULT_SDK_CONFIG,
            ...config,
            actionCooldowns: {
                ...(DEFAULT_SDK_CONFIG.actionCooldowns || {}),
                ...(config.actionCooldowns || {}),
            },
        };
        this.dataStore = dataStore || null;
        this.configFacade = configFacade || null;
        this.platformFacade = platformFacade || null;
        this.adFacade = adFacade || null;
        this.sessionTimer = sessionTimer || null;
        this.screenFacade = screenFacade || null;
        this.platform = this.platformFacade?.getPlatform() || 'mock';
        this.adapter = this.registry.create(this.platform);
        this.adapter.init(this.config);
        this.sessionTimer?.bindLifecycle(this.adapter);
        this.sourceFlags = null;
        this.loadSavedSession();
        this.initialized = true;

        if (this.config.shareMenu) {
            this.setShareMenu(this.config.shareMenu);
        }

        this.saveSession(false);
    }

    // Loading 阶段推荐先 await H.sdk.login()，返回值会存入 getLoginResult 和 session 数据。
    public async login(): Promise<HSDKLoginResult> {
        this.ensureInit();
        const lockKey = 'sdk:login';
        if (!this.sessionTimer!.acquireLock(lockKey)) {
            return this.loginFail('busy');
        }

        try {
            const ret = await this.adapter.login();
            const normalized: HSDKLoginResult = {
                ...ret,
                completed: ret.ok,
                rewardable: false,
            };
            this.refreshSourceFlags();
            this.loginResult = this.cloneLoginForSave(normalized);
            if (this.config.autoSaveLogin !== false) {
                this.saveSession(true);
            }
            return normalized;
        } finally {
            this.sessionTimer!.releaseLock(lockKey);
        }
    }

    public getLoginResult(): HSDKLoginResult | null {
        this.ensureInit();
        return this.loginResult ? this.clone(this.loginResult) : null;
    }

    public getLaunchOptions(): unknown {
        this.ensureInit();
        return this.adapter.getLaunchOptions();
    }

    public getEnterOptions(): unknown {
        this.ensureInit();
        return this.adapter.getEnterOptions();
    }

    public hasFeature(feature: HSDKFeature): boolean {
        this.ensureInit();
        const defaultValue = this.adapter.hasFeature(feature);
        return this.configFacade?.isSDKFeatureEnabled(feature, this.platform, defaultValue) ?? defaultValue;
    }

    // 文档里的 hasAbility 在 H 框架中作为 hasFeature 的语义别名，业务可读性更强。
    public hasAbility(feature: HSDKFeature): boolean {
        return this.hasFeature(feature);
    }

    public getSourceFlags(): HSDKSourceFlags {
        this.ensureInit();
        return this.cloneSourceFlags(this.sourceFlags || this.refreshSourceFlags());
    }

    public get fromSidebar(): boolean {
        return this.getSourceFlags().fromSidebar;
    }

    public get fromDesk(): boolean {
        return this.getSourceFlags().fromDesk;
    }

    public get fromFeed1(): boolean {
        return this.getSourceFlags().fromFeed1;
    }

    public get fromFeed2(): boolean {
        return this.getSourceFlags().fromFeed2;
    }

    public restartProgram(): HSDKActionResult {
        this.ensureInit();
        if (!this.hasAbility('restart')) {
            return this.actionFail('restart', 'platform-unsupported');
        }
        return this.adapter.restartProgram();
    }

    // 分享菜单是平台级开关，不参与奖励判定；真正分享奖励走 share() 的 rewardable。
    public setShareMenu(options?: HShareMenuOptions): HSDKActionResult {
        this.ensureInit();
        return this.adapter.setShareMenu(options);
    }

    public hideShareMenu(): HSDKActionResult {
        this.ensureInit();
        return this.adapter.hideShareMenu();
    }

    // 平台交互能力统一返回 ok/completed/rewardable，业务发奖励只看 rewardable。
    public share(options: HShareOptions = {}): Promise<HSDKActionResult> {
        return this.runAction('share', options, () => this.adapter.share(options));
    }

    public copyText(text: string, options: HClipboardOptions = {}): Promise<HSDKActionResult> {
        return this.runAction('clipboard-copy', options, () => this.adapter.copyText(text, options));
    }

    public triggerGC(): HSDKActionResult {
        this.ensureInit();
        if (!this.hasAbility('gc')) {
            return this.actionFail('gc', 'platform-unsupported');
        }
        return this.adapter.triggerGC();
    }

    public showFavoriteGuide(options: HFavoriteGuideOptions = {}): Promise<HSDKActionResult> {
        return this.runAction('favorite', options, () => this.adapter.showFavoriteGuide(options));
    }

    public showRevisitGuide(options: HRevisitGuideOptions = {}): Promise<HSDKActionResult> {
        return this.runAction('revisit', options, () => this.adapter.showRevisitGuide(options));
    }

    public checkSidebar(options: HSidebarOptions = {}): Promise<HSDKActionResult> {
        return this.runAction('sidebar-check', options, () => this.adapter.checkSidebar(options));
    }

    public navigateToSidebar(options: HSidebarOptions = {}): Promise<HSDKActionResult> {
        return this.runAction('sidebar-navigate', options, () => this.adapter.navigateToSidebar(options));
    }

    public checkShortcut(options: HShortcutOptions = {}): Promise<HSDKActionResult> {
        return this.runAction('shortcut-check', options, () => this.adapter.checkShortcut(options));
    }

    public addShortcut(options: HShortcutOptions = {}): Promise<HSDKActionResult> {
        return this.runAction('shortcut-add', options, () => this.adapter.addShortcut(options));
    }

    /**
     * 安全分享入口。
     *
     * @param options 分享参数。
     * @param callbacks 业务只处理 success/fail；平台能力、冷却、状态锁和完成判定由 SDK 内部处理。
     */
    public tryShare(options: HShareOptions = {}, callbacks: HSDKActionCallbacks = {}): boolean {
        return this.tryRunAction('share', 'share', callbacks, () => this.share(options));
    }

    /**
     * 安全添加桌面入口。
     *
     * @param options 添加桌面参数。
     * @param callbacks 业务只处理 success/fail。
     */
    public tryAddShortcut(options: HShortcutOptions = {}, callbacks: HSDKActionCallbacks = {}): boolean {
        return this.tryRunAction('shortcut', 'shortcut-add', callbacks, () => this.addShortcut(options));
    }

    /**
     * 安全收藏引导入口。
     *
     * @param options 收藏引导参数。
     * @param callbacks 业务只处理 success/fail。
     */
    public tryShowFavoriteGuide(options: HFavoriteGuideOptions = {}, callbacks: HSDKActionCallbacks = {}): boolean {
        return this.tryRunAction('favorite', 'favorite', callbacks, () => this.showFavoriteGuide(options));
    }

    /**
     * 安全复访引导入口。
     *
     * @param options 复访引导参数。
     * @param callbacks 业务只处理 success/fail。
     */
    public tryShowRevisitGuide(options: HRevisitGuideOptions = {}, callbacks: HSDKActionCallbacks = {}): boolean {
        return this.tryRunAction('revisit', 'revisit', callbacks, () => this.showRevisitGuide(options));
    }

    /**
     * 安全侧边栏入口。内部先 check，再 navigate。
     *
     * @param options 侧边栏参数。
     * @param callbacks 业务只处理 success/fail。
     */
    public tryShowSidebar(options: HSidebarOptions = {}, callbacks: HSDKActionCallbacks = {}): boolean {
        if (!this.hasAbility('sidebar')) {
            void this.dispatchActionCallbacks(this.actionFail('sidebar-navigate', 'platform-unsupported'), callbacks);
            return false;
        }

        void (async () => {
            try {
                const check = await this.checkSidebar(options);
                if (!check.ok || !check.completed) {
                    await this.dispatchActionCallbacks(check, callbacks);
                    return;
                }

                await this.dispatchActionCallbacks(await this.navigateToSidebar(options), callbacks);
            } catch (error) {
                await this.dispatchActionCallbacks(this.actionException('sidebar-navigate', error), callbacks);
            }
        })();

        return true;
    }

    /**
     * 安全复制文本入口。
     *
     * @param text 要写入系统剪贴板的文本。
     * @param callbacks 业务只处理 success/fail。
     * @param options 剪贴板调用配置。
     */
    public tryCopyText(text: string, callbacks: HSDKActionCallbacks = {}, options: HClipboardOptions = {}): boolean {
        return this.tryRunAction('clipboard', 'clipboard-copy', callbacks, () => this.copyText(text, options));
    }

    public tryTriggerGC(callbacks: HSDKActionCallbacks = {}): boolean {
        if (!this.hasAbility('gc')) {
            void this.dispatchActionCallbacks(this.actionFail('gc', 'platform-unsupported'), callbacks);
            return false;
        }

        void this.dispatchActionCallbacks(this.triggerGC(), callbacks);
        return true;
    }

    // 广告相关接口继续委托给 HAdFacade，这里只补 SDK 层的二次冷却保护。
    public preloadReward(placement: string): Promise<HAdPreloadResult> {
        this.ensureInit();
        return this.adFacade!.preloadReward(placement);
    }

    public isRewardReady(placement: string): boolean {
        this.ensureInit();
        return this.adFacade!.isRewardReady(placement);
    }

    public showReward(placement: string, cb?: HAdRewardCallback): Promise<HAdRewardResult> {
        this.ensureInit();
        const cooldownResult = this.checkAdCooldown('ad-reward', placement);
        if (cooldownResult) {
            const ret = this.rewardCooldownResult(placement, cooldownResult);
            cb?.(ret);
            return Promise.resolve(ret);
        }

        return this.adFacade!.showReward(placement, cb).then((ret) => {
            if (ret.shown || ret.rewarded) {
                this.markAdCooldown('ad-reward', placement);
            }
            return ret;
        });
    }

    public showRewardLegacy(placement: string, cb: (st: number, result?: HAdRewardResult) => void): void {
        this.ensureInit();
        this.adFacade!.showRewardLegacy(placement, cb);
    }

    public showInterstitial(placement: string): Promise<HAdShowResult> {
        this.ensureInit();
        const cooldownResult = this.checkAdCooldown('ad-interstitial', placement);
        if (cooldownResult) {
            return Promise.resolve(this.showCooldownResult('interstitial', placement, cooldownResult));
        }

        return this.adFacade!.showInterstitial(placement).then((ret) => {
            if (ret.shown || ret.ok) {
                this.markAdCooldown('ad-interstitial', placement);
            }
            return ret;
        });
    }

    public showBanner(placement: string, options?: HAdBannerOptions): Promise<HAdShowResult> {
        this.ensureInit();
        return this.adFacade!.showBanner(placement, options);
    }

    public hideBanner(): void {
        this.ensureInit();
        this.adFacade!.hideBanner();
    }

    public destroyBanner(): void {
        this.ensureInit();
        this.adFacade!.destroyBanner();
    }

    public getAdStats(): HAdStats {
        this.ensureInit();
        return this.adFacade!.getAdStats();
    }

    // 广告播放期间平台会暂停游戏；iOS 可能触发 onHide/onShow，业务可以用这个状态过滤误判。
    public isShowingAd(): boolean {
        this.ensureInit();
        return this.adFacade!.isShowingAd();
    }

    public resetAdStats(): void {
        this.ensureInit();
        this.adFacade!.resetAdStats();
    }

    public getPlatform(): HResolvedPlatform {
        this.ensureInit();
        return this.platform;
    }

    public getSessionSnapshot(): HSessionSnapshot {
        this.ensureInit();
        return this.sessionTimer!.getSnapshot();
    }

    public getOnlineDurationMs(): number {
        this.ensureInit();
        return this.sessionTimer!.getOnlineDurationMs();
    }

    public getScreenInfo(): HScreenInfo {
        this.ensureInit();
        return this.screenFacade!.getInfo();
    }

    public refreshScreenInfo(): Promise<HScreenInfo> {
        this.ensureInit();
        return this.screenFacade!.refresh();
    }

    public getScreenAdaptResult(options?: HScreenAdaptOptions): HScreenAdaptResult {
        this.ensureInit();
        return this.screenFacade!.getAdaptResult(options);
    }

    public applyScreenDesignResolution(options?: HScreenAdaptOptions): HScreenAdaptResult {
        this.ensureInit();
        return this.screenFacade!.applyDesignResolution(options);
    }

    // 运行期可注册新渠道 adapter，例如项目后续接入 4399/快手/OPPO 时不改业务入口。
    public registerAdapter(platform: HResolvedPlatform, factory: (platform: HResolvedPlatform) => HMiniGameSDKAdapter): void {
        this.registry.register(platform, factory);
        this.recreateAdapterIfCurrent(platform);
    }

    public registerAdapterClass(AdapterClass: HSDKAdapterConstructor): void {
        const adapter = new AdapterClass();
        this.registry.registerAdapterClass(AdapterClass);
        this.recreateAdapterIfCurrent(adapter.platform);
    }

    private tryRunAction(
        feature: HSDKFeature,
        action: HSDKActionType,
        callbacks: HSDKActionCallbacks,
        task: () => Promise<HSDKActionResult>,
    ): boolean {
        if (!this.hasAbility(feature)) {
            void this.dispatchActionCallbacks(this.actionFail(action, 'platform-unsupported'), callbacks);
            return false;
        }

        void task()
            .then((ret) => this.dispatchActionCallbacks(ret, callbacks))
            .catch((error) => this.dispatchActionCallbacks(this.actionException(action, error), callbacks));

        return true;
    }

    private async dispatchActionCallbacks(result: HSDKActionResult, callbacks: HSDKActionCallbacks): Promise<void> {
        const payload = {
            action: result.action,
            platform: result.platform,
            reason: result.reason,
            userMessage: result.userMessage,
            raw: result.raw,
        };

        try {
            if (result.ok && result.completed) {
                await callbacks.success?.(payload);
                return;
            }

            await callbacks.fail?.(payload);
        } catch (error) {
            console.warn('[HSDKFacade] action callback failed', error);
        }
    }

    private async runAction(
        action: HSDKActionType,
        options: HSDKActionOptions,
        call: () => Promise<HSDKActionResult>,
    ): Promise<HSDKActionResult> {
        this.ensureInit();

        // 同一个 action/cooldownKey 同时只能执行一次，并且可以按 action 配置冷却。
        const lockKey = `sdk:${options.cooldownKey || action}`;
        const cooldownMs = this.resolveCooldownMs(action, options);
        if (cooldownMs > 0) {
            const cooldown = this.sessionTimer!.canUseCooldown(lockKey, cooldownMs);
            if (!cooldown.allowed) {
                return this.actionFail(action, 'cooldown', `还需等待 ${Math.ceil(cooldown.remainingMs / 1000)} 秒`);
            }
        }

        if (!this.sessionTimer!.acquireLock(lockKey)) {
            return this.actionFail(action, 'busy');
        }

        try {
            const ret = await call();
            // rewardable 在这里统一计算，外部奖励结算无需理解每个平台的回调字段。
            const normalized = this.applyRewardPolicy(ret, options.rewardPolicy ?? this.getDefaultRewardPolicy(action));
            if (cooldownMs > 0 && this.shouldMarkCooldown(normalized)) {
                this.sessionTimer!.markCooldown(lockKey);
            }
            return normalized;
        } finally {
            this.sessionTimer!.releaseLock(lockKey);
        }
    }

    private resolveCooldownMs(action: HSDKActionType, options: HSDKActionOptions): number {
        if (typeof options.cooldownMs === 'number') {
            return Math.max(0, Math.floor(options.cooldownMs));
        }
        const configured = this.config.actionCooldowns?.[action] ?? this.config.actionCooldownMs ?? 0;
        return Math.max(0, Math.floor(configured));
    }

    // 广告冷却 key 支持全局 ad-reward，也支持 ad-reward:placement 精细配置。
    private resolveAdCooldownMs(kind: 'ad-reward' | 'ad-interstitial', placement: string): number {
        const map = this.config.actionCooldowns || {};
        const configured = map[`${kind}:${placement}`] ?? map[kind] ?? 0;
        return Math.max(0, Math.floor(configured));
    }

    private checkAdCooldown(kind: 'ad-reward' | 'ad-interstitial', placement: string): string {
        const cooldownMs = this.resolveAdCooldownMs(kind, placement);
        if (cooldownMs <= 0) {
            return '';
        }

        const key = `${kind}:${placement}`;
        const cooldown = this.sessionTimer!.canUseCooldown(key, cooldownMs);
        if (cooldown.allowed) {
            return '';
        }
        return `广告展示过于频繁，请 ${Math.ceil(cooldown.remainingMs / 1000)} 秒后再试`;
    }

    private markAdCooldown(kind: 'ad-reward' | 'ad-interstitial', placement: string): void {
        const cooldownMs = this.resolveAdCooldownMs(kind, placement);
        if (cooldownMs <= 0) {
            return;
        }
        this.sessionTimer!.markCooldown(`${kind}:${placement}`);
    }

    private getDefaultRewardPolicy(action: HSDKActionType): HSDKRewardPolicy {
        if (action === 'sidebar-check' || action === 'shortcut-check') {
            return 'none';
        }
        return 'completed';
    }

    // 奖励判定策略集中在这里，业务层只处理 ret.rewardable。
    private applyRewardPolicy(ret: HSDKActionResult, policy: HSDKRewardPolicy): HSDKActionResult {
        let rewardable = false;
        if (policy === 'api-success') {
            rewardable = ret.ok;
        } else if (policy === 'callback-success') {
            rewardable = ret.ok && ret.completed;
        } else if (policy === 'completed') {
            rewardable = ret.completed;
        }

        return {
            ...ret,
            rewardable,
            userMessage: ret.userMessage || (ret.ok ? undefined : this.getUserMessage(ret.reason)),
        };
    }

    private shouldMarkCooldown(ret: HSDKActionResult): boolean {
        return ret.ok || ret.reason === 'cancelled' || ret.reason === 'not-completed';
    }

    private recreateAdapterIfCurrent(platform: HResolvedPlatform): void {
        if (!this.initialized || this.platform !== platform) {
            return;
        }
        this.adapter = this.registry.create(this.platform);
        this.adapter.init(this.config);
        this.sessionTimer?.bindLifecycle(this.adapter);
        this.sourceFlags = null;
    }

    // 旧项目兼容用的失败结果构造，保持字段和 HAdRewardResult/HAdShowResult 一致。
    private rewardCooldownResult(placement: string, userMessage: string): HAdRewardResult {
        return {
            ok: false,
            shown: false,
            rewarded: false,
            completed: false,
            type: 'reward',
            placement,
            platform: this.platform,
            reason: 'cooldown',
            userMessage,
        };
    }

    private showCooldownResult(type: 'interstitial' | 'banner', placement: string, userMessage: string): HAdShowResult {
        return {
            ok: false,
            shown: false,
            type,
            placement,
            platform: this.platform,
            reason: 'cooldown',
            userMessage,
        };
    }

    // 登录返回和启动参数统一写入 DataStore，方便 Loading 阶段和调试面板读取。
    private loadSavedSession(): void {
        const saved = this.dataStore?.getModule<HSDKSessionSaveData>(this.getSessionModuleName(), {
            platform: this.platform,
            login: null,
            updatedAt: 0,
        });
        this.loginResult = saved?.login ? this.clone(saved.login) : null;
    }

    private saveSession(immediate: boolean): void {
        if (!this.dataStore) {
            return;
        }

        const data: HSDKSessionSaveData = {
            platform: this.platform,
            login: this.loginResult ? this.cloneLoginForSave(this.loginResult) : null,
            launchOptions: this.safeClone(this.adapter.getLaunchOptions()),
            enterOptions: this.safeClone(this.adapter.getEnterOptions()),
            sourceFlags: this.sourceFlags ? this.cloneSourceFlags(this.sourceFlags) : undefined,
            updatedAt: Date.now(),
        };
        this.dataStore.setModule<HSDKSessionSaveData>(this.getSessionModuleName(), data, { immediate });
    }

    private refreshSourceFlags(): HSDKSourceFlags {
        try {
            this.sourceFlags = this.cloneSourceFlags(this.adapter.getSourceFlags());
        } catch (error) {
            if (this.config.debug) {
                console.warn('[HSDKFacade] getSourceFlags failed', error);
            }
            this.sourceFlags = {
                fromSidebar: false,
                fromDesk: false,
                fromFeed1: false,
                fromFeed2: false,
            };
        }
        return this.sourceFlags;
    }

    private cloneSourceFlags(flags: HSDKSourceFlags): HSDKSourceFlags {
        return {
            fromSidebar: !!flags.fromSidebar,
            fromDesk: !!flags.fromDesk,
            fromFeed1: !!flags.fromFeed1,
            fromFeed2: !!flags.fromFeed2,
            rawLaunchOptions: this.safeClone(flags.rawLaunchOptions),
            rawEnterOptions: this.safeClone(flags.rawEnterOptions),
        };
    }

    private cloneLoginForSave(login: HSDKLoginResult): HSDKLoginResult {
        return {
            ok: login.ok,
            completed: login.completed,
            rewardable: false,
            platform: login.platform,
            action: 'login',
            reason: login.reason,
            userMessage: login.userMessage,
            errorCode: login.errorCode,
            errorMessage: login.errorMessage,
            code: login.code,
            anonymousCode: login.anonymousCode,
            login: login.login
                ? {
                    ok: login.login.ok,
                    platform: login.login.platform,
                    code: login.login.code,
                    anonymousCode: login.login.anonymousCode,
                    errorMessage: login.login.errorMessage,
                    raw: this.safeClone(login.login.raw),
                }
                : undefined,
            raw: this.safeClone(login.raw),
        };
    }

    private getSessionModuleName(): string {
        return this.config.sessionStorageModuleName?.trim() || 'platformSession';
    }

    private loginFail(reason: HSDKActionReason): HSDKLoginResult {
        return {
            ...this.actionFail('login', reason),
            action: 'login',
        };
    }

    private actionFail(action: HSDKActionType, reason: HSDKActionReason, userMessage?: string): HSDKActionResult {
        return {
            ok: false,
            completed: false,
            rewardable: false,
            platform: this.platform,
            action,
            reason,
            userMessage: userMessage || this.getUserMessage(reason),
        };
    }

    private actionException(action: HSDKActionType, error: unknown): HSDKActionResult {
        return {
            ok: false,
            completed: false,
            rewardable: false,
            platform: this.platform,
            action,
            reason: 'failed',
            userMessage: this.getErrorMessage(error),
            raw: error,
        };
    }

    private getUserMessage(reason?: HSDKActionReason): string {
        switch (reason) {
            case 'busy':
                return '功能正在执行中，请勿重复点击';
            case 'cooldown':
                return '操作过于频繁，请稍后再试';
            case 'cancelled':
                return '操作已取消';
            case 'not-completed':
                return '操作未完成';
            case 'platform-unsupported':
                return '当前平台暂不支持该功能';
            case 'timeout':
                return '平台回调超时，请稍后再试';
            case 'config-missing':
                return '功能配置未完成';
            default:
                return '功能调用失败，请稍后再试';
        }
    }

    private getErrorMessage(error: unknown): string {
        if (error && typeof error === 'object') {
            return (error as any).message || (error as any).errMsg || 'SDK action failed';
        }
        if (typeof error === 'string') {
            return error;
        }
        return 'SDK action failed';
    }

    private safeClone<T>(value: T): T | undefined {
        if (value === undefined || value === null) {
            return value as T;
        }

        try {
            return JSON.parse(JSON.stringify(value)) as T;
        } catch {
            return undefined;
        }
    }

    private clone<T>(value: T): T {
        return JSON.parse(JSON.stringify(value)) as T;
    }

    private ensureInit(): void {
        if (!this.initialized) {
            this.init();
        }
        if (!this.sessionTimer) {
            throw new Error('[HSDKFacade] H.session 未初始化');
        }
        if (!this.adFacade) {
            throw new Error('[HSDKFacade] H.ad 未初始化');
        }
        if (!this.screenFacade) {
            throw new Error('[HSDKFacade] H.screen 未初始化');
        }
    }
}
