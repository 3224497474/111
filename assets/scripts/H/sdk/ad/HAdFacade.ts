import type { HAnalyticsFacade } from '../../analytics/HAnalyticsFacade';
import type { HPlatformFacade } from '../platform/HPlatformFacade';
import type { HSessionTimer } from '../../session/HSessionTimer';
import type {
    HAdBannerOptions,
    HAdFailReason,
    HAdInitConfig,
    HAdPlacementStats,
    HAdPreloadResult,
    HAdRewardCallback,
    HAdRewardResult,
    HAdShowResult,
    HAdStats,
    HAdType,
    HResolvedPlatform,
} from '../../HTypes';
import type { HAdAdapter } from './HAdAdapters';
import { HDouyinAdAdapter, HMockAdAdapter, HWechatAdAdapter } from './HAdAdapters';

/**
 * HAdFacade 是广告统一入口，业务不要直接调用 wx/tt 广告 API。
 *
 * 排查广告问题时建议按下面的链路看：
 * 1. preloadReward/showReward/showInterstitial/showBanner：业务入口和返回结果。
 * 2. canShowReward/canShowInterstitial：是否被忙碌、冷却、启动延迟或激励后间隔拦截。
 * 3. getAdUnitId：当前 platform + placement 是否能读到广告位 id。
 * 4. HAdAdapter：真正调用微信/抖音广告对象并归一化 close/error 回调。
 * 5. recordAd/trackAd：本地统计和 analytics 上报，方便对照平台后台数据。
 */
const DEFAULT_AD_CONFIG: HAdInitConfig = {
    platform: 'auto',
    rewardTimeoutMs: 15000,
    mock: {
        rewardResult: 'success',
        delayMs: 300,
    },
    reward: {
        intervalMs: 30000,
    },
    interstitial: {
        launchDelayMs: 30000,
        intervalMs: 60000,
        afterRewardMs: 60000,
    },
};

export class HAdFacade {
    // Facade 管配置、频控、统计和上报；adapter 只负责平台 API 调用。
    private config: HAdInitConfig = { ...DEFAULT_AD_CONFIG };
    private platform: HResolvedPlatform = 'mock';
    private adapter: HAdAdapter = new HMockAdAdapter();
    private platformFacade: HPlatformFacade | null = null;
    private analytics: HAnalyticsFacade | null = null;
    private sessionTimer: HSessionTimer | null = null;
    private initialized = false;
    private showingReward = false;
    private rewardRequestId = 0;
    private showingInterstitial = false;
    private createdAt = Date.now();
    private lastRewardAt = 0;
    private lastRewardRequestAt = 0;
    private lastInterstitialAt = 0;
    private stats: HAdStats = this.createEmptyStats();

    /**
     * 初始化广告层。
     * platform 为 auto 时跟随 HPlatformFacade；广告 id 从 HAdInitConfig.ids[platform] 读取。
     */
    public init(
        config: HAdInitConfig = {},
        platformFacade?: HPlatformFacade,
        analytics?: HAnalyticsFacade,
        sessionTimer?: HSessionTimer,
    ): void {
        this.config = {
            ...DEFAULT_AD_CONFIG,
            ...config,
            mock: {
                ...DEFAULT_AD_CONFIG.mock,
                ...(config.mock || {}),
            },
            reward: {
                ...DEFAULT_AD_CONFIG.reward,
                ...(config.reward || {}),
            },
            interstitial: {
                ...DEFAULT_AD_CONFIG.interstitial,
                ...(config.interstitial || {}),
            },
        };
        this.platformFacade = platformFacade || null;
        this.analytics = analytics || null;
        this.sessionTimer = sessionTimer || null;
        this.platform = this.resolvePlatform();
        this.adapter = this.createAdapter(this.platform);
        this.adapter.init(this.config);
        this.initialized = true;
        this.createdAt = Date.now();
        this.lastRewardAt = 0;
        this.lastRewardRequestAt = 0;
        this.lastInterstitialAt = 0;
        this.stats = this.createEmptyStats();
    }

    // 激励广告预加载入口。预加载只表示 ready，不发奖励。
    public async preloadReward(placement: string): Promise<HAdPreloadResult> {
        this.ensureInit();
        const normalizedPlacement = this.normalizePlacement(placement);
        this.recordPreload(normalizedPlacement);

        if (!this.adapter.isSupported('reward')) {
            const ret = this.preloadFail(normalizedPlacement, 'platform-unsupported');
            this.recordPreloadResult(ret);
            return ret;
        }

        const adUnitId = this.getAdUnitId('reward', normalizedPlacement);
        if (this.platform !== 'mock' && !adUnitId) {
            const ret = this.preloadFail(normalizedPlacement, 'config-missing');
            this.recordPreloadResult(ret);
            return ret;
        }

        try {
            const ret = this.normalizePreloadResult(await this.adapter.preloadReward(normalizedPlacement, adUnitId));
            this.recordPreloadResult(ret);
            return ret;
        } catch (err) {
            const ret = this.preloadFail(normalizedPlacement, 'platform-error', err);
            this.recordPreloadResult(ret);
            return ret;
        }
    }

    public isRewardReady(placement: string): boolean {
        this.ensureInit();
        const normalizedPlacement = this.normalizePlacement(placement);
        if (!this.adapter.isSupported('reward')) {
            return false;
        }

        const adUnitId = this.getAdUnitId('reward', normalizedPlacement);
        if (this.platform !== 'mock' && !adUnitId) {
            return false;
        }
        return this.adapter.isRewardReady(normalizedPlacement, adUnitId);
    }

    // 激励广告展示入口。业务发奖励只看返回值 rewarded/completed，旧回调由 cb 兼容。
    public async showReward(placement: string, cb?: HAdRewardCallback): Promise<HAdRewardResult> {
        this.ensureInit();
        const rawPlacement = placement;
        const normalizedPlacement = this.normalizePlacement(placement);
        this.recordRequest('reward', normalizedPlacement, rawPlacement);

        const guardReason = this.canShowReward(normalizedPlacement);
        if (guardReason) {
            const ret = this.rewardFail(normalizedPlacement, guardReason, rawPlacement);
            this.recordRewardResult(ret);
            cb?.(ret);
            return ret;
        }

        this.markRewardStart();
        const requestId = this.rewardRequestId;

        if (!this.adapter.isSupported('reward')) {
            const ret = this.rewardFail(normalizedPlacement, 'platform-unsupported', rawPlacement);
            this.markRewardEnd(requestId, false, normalizedPlacement);
            this.recordRewardResult(ret);
            cb?.(ret);
            return ret;
        }

        const adUnitId = this.getAdUnitId('reward', normalizedPlacement);
        if (this.platform !== 'mock' && !adUnitId) {
            const ret = this.rewardFail(normalizedPlacement, 'config-missing', rawPlacement);
            this.markRewardEnd(requestId, false, normalizedPlacement);
            this.recordRewardResult(ret);
            cb?.(ret);
            return ret;
        }

        let shown = false;
        let touchedPlatform = false;
        try {
            touchedPlatform = true;
            const ret = await this.withRewardTimeout(
                this.adapter.showReward(normalizedPlacement, adUnitId, rawPlacement),
                normalizedPlacement,
                rawPlacement,
            );
            shown = ret.shown;
            const normalizedRet = this.normalizeRewardResult(ret);
            this.recordRewardResult(normalizedRet);
            cb?.(normalizedRet);
            return normalizedRet;
        } finally {
            this.markRewardEnd(requestId, shown, normalizedPlacement, touchedPlatform);
        }
    }

    public showRewardLegacy(placement: string, cb: (st: number, result?: HAdRewardResult) => void): void {
        void this.showReward(placement).then((ret) => {
            if (ret.rewarded) {
                cb(1, ret);
            } else if (ret.reason === 'cancelled') {
                cb(2, ret);
            } else {
                cb(0, ret);
            }
        });
    }

    // 插屏广告会检查启动延迟、两次插屏间隔，以及激励广告后的保护间隔。
    public async showInterstitial(placement: string): Promise<HAdShowResult> {
        this.ensureInit();
        const normalizedPlacement = this.normalizePlacement(placement);
        this.recordRequest('interstitial', normalizedPlacement);

        const guardReason = this.canShowInterstitial();
        if (guardReason) {
            const ret = this.showFail('interstitial', normalizedPlacement, guardReason);
            this.recordShowResult(ret);
            return ret;
        }

        if (!this.adapter.isSupported('interstitial')) {
            const ret = this.showFail('interstitial', normalizedPlacement, 'platform-unsupported');
            this.recordShowResult(ret);
            return ret;
        }

        const adUnitId = this.getAdUnitId('interstitial', normalizedPlacement);
        if (this.platform !== 'mock' && !adUnitId) {
            const ret = this.showFail('interstitial', normalizedPlacement, 'config-missing');
            this.recordShowResult(ret);
            return ret;
        }

        this.showingInterstitial = true;
        let touchedPlatform = false;
        try {
            touchedPlatform = true;
            const ret = this.normalizeShowResult(await this.adapter.showInterstitial(normalizedPlacement, adUnitId));
            this.recordShowResult(ret);
            return ret;
        } catch (err) {
            const ret = this.showFail('interstitial', normalizedPlacement, 'platform-error', err);
            this.recordShowResult(ret);
            return ret;
        } finally {
            this.showingInterstitial = false;
            if (touchedPlatform) {
                this.lastInterstitialAt = Date.now();
            }
        }
    }

    // Banner 广告只负责展示/隐藏/销毁，不参与奖励。
    public async showBanner(placement: string, options?: HAdBannerOptions): Promise<HAdShowResult> {
        this.ensureInit();
        const normalizedPlacement = this.normalizePlacement(placement);
        this.recordRequest('banner', normalizedPlacement);

        if (!this.adapter.isSupported('banner')) {
            const ret = this.showFail('banner', normalizedPlacement, 'platform-unsupported');
            this.recordShowResult(ret);
            return ret;
        }

        const adUnitId = this.getAdUnitId('banner', normalizedPlacement);
        if (this.platform !== 'mock' && !adUnitId) {
            const ret = this.showFail('banner', normalizedPlacement, 'config-missing');
            this.recordShowResult(ret);
            return ret;
        }

        try {
            const ret = this.normalizeShowResult(await this.adapter.showBanner(normalizedPlacement, adUnitId, options));
            this.recordShowResult(ret);
            return ret;
        } catch (err) {
            const ret = this.showFail('banner', normalizedPlacement, 'platform-error', err);
            this.recordShowResult(ret);
            return ret;
        }
    }

    public hideBanner(): void {
        this.ensureInit();
        this.adapter.hideBanner();
    }

    public destroyBanner(): void {
        this.ensureInit();
        this.adapter.destroyBanner();
    }

    public getAdStats(): HAdStats {
        this.ensureInit();
        return this.clone(this.stats);
    }

    public resetAdStats(): void {
        this.stats = this.createEmptyStats();
    }

    public getPlatform(): HResolvedPlatform {
        this.ensureInit();
        return this.platform;
    }

    private ensureInit(): void {
        if (!this.initialized) {
            this.init();
        }
    }

    // 自动模式下跟随平台层；未识别平台降级 mock，保证本地流程可跑。
    private resolvePlatform(): HResolvedPlatform {
        const configuredPlatform = this.config.platform || 'auto';
        if (configuredPlatform === 'wechat' || configuredPlatform === 'douyin' || configuredPlatform === '4399' || configuredPlatform === 'web' || configuredPlatform === 'mock') {
            return configuredPlatform;
        }

        const detected = this.platformFacade?.getPlatform() || 'mock';
        return detected === 'unknown' ? 'mock' : detected;
    }

    private createAdapter(platform: HResolvedPlatform): HAdAdapter {
        if (platform === 'wechat') {
            return new HWechatAdAdapter();
        }
        if (platform === 'douyin') {
            return new HDouyinAdAdapter();
        }
        return new HMockAdAdapter(platform);
    }

    // placement 支持别名映射，方便业务使用稳定语义名，配置里再映射到广告位。
    private normalizePlacement(placement: string): string {
        const normalizedPlacement = placement.trim();
        if (!normalizedPlacement) {
            throw new Error('[HAdFacade] placement can not be empty');
        }
        return this.config.placementAliasMap?.[normalizedPlacement] || normalizedPlacement;
    }

    // 广告位 id 的唯一读取点。排查“广告配置未完成”时优先看这里和 H.init 的 ad.ids。
    private getAdUnitId(type: HAdType, placement: string): string {
        const platformIds = this.config.ids?.[this.platform as 'wechat' | 'douyin' | '4399' | 'web' | 'mock'];
        if (type === 'reward') {
            return platformIds?.reward?.[placement] || '';
        }
        if (type === 'interstitial') {
            return platformIds?.interstitial?.[placement] || '';
        }
        return platformIds?.banner?.[placement] || '';
    }

    // 激励频控：同时只允许一个广告流程，且同 placement 遵守 intervalMs。
    private canShowReward(placement: string): HAdFailReason | null {
        if (this.showingReward || this.showingInterstitial) {
            return 'busy';
        }

        const intervalMs = this.config.reward?.intervalMs ?? 0;
        if (intervalMs <= 0) {
            return null;
        }

        if (this.sessionTimer) {
            const cooldown = this.sessionTimer.canUseCooldown(this.getCooldownKey('reward', placement), intervalMs);
            return cooldown.allowed ? null : 'cooldown';
        }

        return Date.now() - this.lastRewardRequestAt < intervalMs ? 'cooldown' : null;
    }

    private markRewardStart(): void {
        this.showingReward = true;
        this.rewardRequestId += 1;
    }

    private markRewardEnd(requestId: number, shown: boolean, placement: string, markCooldown = shown): void {
        if (requestId !== this.rewardRequestId) {
            return;
        }

        this.showingReward = false;
        if (markCooldown) {
            this.lastRewardRequestAt = Date.now();
            this.sessionTimer?.markCooldown(this.getCooldownKey('reward', placement), this.lastRewardRequestAt);
        }
        if (shown) {
            this.lastRewardAt = Date.now();
        }
    }

    // 插屏频控：避免刚进游戏、刚看完激励、或刚展示过插屏时重复弹出。
    private canShowInterstitial(): HAdFailReason | null {
        const now = Date.now();
        const policy = this.config.interstitial || {};
        if (this.showingReward || this.showingInterstitial) {
            return 'busy';
        }
        if (now - this.createdAt < (policy.launchDelayMs || 0)) {
            return 'cooldown';
        }
        if (now - this.lastInterstitialAt < (policy.intervalMs || 0)) {
            return 'cooldown';
        }
        if (now - this.lastRewardAt < (policy.afterRewardMs || 0)) {
            return 'cooldown';
        }
        return null;
    }

    // 防止平台广告 close/error 回调丢失导致业务 Promise 永远不结束。
    private withRewardTimeout(promise: Promise<HAdRewardResult>, placement: string, rawPlacement?: string): Promise<HAdRewardResult> {
        const timeoutMs = this.config.rewardTimeoutMs ?? 15000;
        if (timeoutMs <= 0) {
            return promise;
        }

        return new Promise((resolve) => {
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve(this.rewardFail(placement, 'timeout', rawPlacement));
            }, timeoutMs);

            promise.then((ret) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                resolve(ret);
            }, (err) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                resolve(this.rewardFail(placement, 'platform-error', rawPlacement, err));
            });
        });
    }

    private normalizePreloadResult(ret: HAdPreloadResult): HAdPreloadResult {
        if (ret.ok) {
            return {
                ...ret,
                ready: ret.ready !== false,
            };
        }

        const reason = ret.reason === 'no-fill' ? 'unavailable' : ret.reason;
        return {
            ...ret,
            reason,
            userMessage: ret.userMessage || this.getUserMessage(reason),
        };
    }

    private normalizeRewardResult(ret: HAdRewardResult): HAdRewardResult {
        if (ret.rewarded) {
            return ret;
        }

        const reason = ret.reason === 'no-fill' ? 'unavailable' : ret.reason;
        return {
            ...ret,
            reason,
            userMessage: ret.userMessage || this.getUserMessage(reason),
        };
    }

    private normalizeShowResult(ret: HAdShowResult): HAdShowResult {
        if (ret.ok) {
            return ret;
        }

        const reason = ret.reason === 'no-fill' ? 'unavailable' : ret.reason;
        return {
            ...ret,
            reason,
            userMessage: ret.userMessage || this.getUserMessage(reason),
        };
    }

    // 失败结果统一构造，保证 UI 层可以直接展示 userMessage。
    private preloadFail(placement: string, reason: HAdFailReason, raw?: unknown): HAdPreloadResult {
        return {
            ok: false,
            ready: false,
            type: 'reward',
            placement,
            platform: this.platform,
            reason,
            raw,
            userMessage: this.getUserMessage(reason),
        };
    }

    private rewardFail(placement: string, reason: HAdFailReason, rawPlacement?: string, raw?: unknown): HAdRewardResult {
        return {
            ok: false,
            shown: reason === 'cancelled',
            rewarded: false,
            completed: false,
            type: 'reward',
            placement,
            rawPlacement,
            platform: this.platform,
            reason,
            raw,
            userMessage: this.getUserMessage(reason),
        };
    }

    private showFail(type: 'interstitial' | 'banner', placement: string, reason: HAdFailReason, raw?: unknown): HAdShowResult {
        return {
            ok: false,
            shown: false,
            type,
            placement,
            platform: this.platform,
            reason,
            raw,
            userMessage: this.getUserMessage(reason),
        };
    }

    // 统计和上报区：所有广告请求、展示、奖励、取消、失败都在这里累计。
    private recordRequest(type: HAdType, placement: string, rawPlacement?: string): void {
        this.stats.requests += 1;
        const item = this.getPlacementStats(placement);
        item.requests += 1;
        item.lastEventAt = Date.now();
        this.trackAd('ad_request', { type, placement, rawPlacement });
    }

    private recordPreload(placement: string): void {
        this.stats.preloads += 1;
        const item = this.getPlacementStats(placement);
        item.preloads += 1;
        item.lastEventAt = Date.now();
        this.trackAd('ad_preload_start', { type: 'reward', placement });
    }

    private recordPreloadResult(ret: HAdPreloadResult): void {
        const item = this.getPlacementStats(ret.placement);
        item.lastEventAt = Date.now();
        item.lastReason = ret.reason;
        item.lastErrorMessage = ret.errorMessage;
        if (ret.ok) {
            this.stats.preloadSuccess += 1;
            item.preloadSuccess += 1;
            this.trackAd('ad_preload_success', this.resultData(ret));
            return;
        }

        this.stats.preloadFail += 1;
        item.preloadFail += 1;
        this.recordFailureReason(item, ret.reason, ret.errorMessage);
        this.trackAd(this.failEventName(ret.reason), this.resultData(ret));
    }

    private recordRewardResult(ret: HAdRewardResult): void {
        const item = this.getPlacementStats(ret.placement);
        item.lastEventAt = Date.now();
        item.lastReason = ret.reason;
        item.lastErrorMessage = ret.errorMessage;

        if (ret.shown) {
            this.stats.shows += 1;
            item.shows += 1;
            this.trackAd('ad_show', this.resultData(ret));
        }
        if (ret.rewarded) {
            this.stats.rewards += 1;
            item.rewards += 1;
            this.trackAd('ad_reward', this.resultData(ret));
            return;
        }
        if (ret.reason === 'cancelled') {
            this.stats.cancels += 1;
            item.cancels += 1;
            this.trackAd('ad_cancel', this.resultData(ret));
            return;
        }

        this.recordFailureReason(item, ret.reason, ret.errorMessage);
        this.trackAd(this.failEventName(ret.reason), this.resultData(ret));
    }

    private recordShowResult(ret: HAdShowResult): void {
        const item = this.getPlacementStats(ret.placement);
        item.lastEventAt = Date.now();
        item.lastReason = ret.reason;
        item.lastErrorMessage = ret.errorMessage;

        if (ret.shown || ret.ok) {
            this.stats.shows += 1;
            item.shows += 1;
            this.trackAd('ad_show', this.resultData(ret));
            return;
        }

        this.recordFailureReason(item, ret.reason, ret.errorMessage);
        this.trackAd(this.failEventName(ret.reason), this.resultData(ret));
    }

    private recordFailureReason(item: HAdPlacementStats, reason?: HAdFailReason, errorMessage?: string): void {
        if (reason === 'cooldown') {
            this.stats.cooldownBlocks += 1;
            item.cooldownBlocks += 1;
            return;
        }
        if (reason === 'no-fill' || reason === 'unavailable') {
            this.stats.noFill += 1;
            item.noFill += 1;
            return;
        }

        this.stats.fails += 1;
        item.fails += 1;
        item.lastErrorMessage = errorMessage;
    }

    private failEventName(reason?: HAdFailReason): string {
        if (reason === 'cooldown') {
            return 'ad_cooldown_block';
        }
        if (reason === 'busy') {
            return 'ad_busy_block';
        }
        if (reason === 'no-fill' || reason === 'unavailable') {
            return 'ad_no_fill';
        }
        return 'ad_fail';
    }

    private resultData(ret: HAdPreloadResult | HAdRewardResult | HAdShowResult): Record<string, unknown> {
        return {
            type: ret.type,
            placement: ret.placement,
            platform: ret.platform,
            ok: ret.ok,
            reason: ret.reason,
            errorCode: ret.errorCode,
            errorMessage: ret.errorMessage,
        };
    }

    private trackAd(name: string, data: Record<string, unknown>): void {
        this.analytics?.track(name, {
            ...data,
            adPlatform: this.platform,
            onlineDurationMs: this.sessionTimer?.getOnlineDurationMs(),
        });
    }

    // 按 placement 细分统计，方便定位某个广告位填充率或奖励异常。
    private getPlacementStats(placement: string): HAdPlacementStats {
        let item = this.stats.byPlacement[placement];
        if (item) {
            return item;
        }

        item = {
            requests: 0,
            preloads: 0,
            preloadSuccess: 0,
            preloadFail: 0,
            shows: 0,
            rewards: 0,
            cancels: 0,
            fails: 0,
            noFill: 0,
            cooldownBlocks: 0,
            lastEventAt: 0,
        };
        this.stats.byPlacement[placement] = item;
        return item;
    }

    private createEmptyStats(): HAdStats {
        return {
            requests: 0,
            preloads: 0,
            preloadSuccess: 0,
            preloadFail: 0,
            shows: 0,
            rewards: 0,
            cancels: 0,
            fails: 0,
            noFill: 0,
            cooldownBlocks: 0,
            byPlacement: {},
        };
    }

    private getCooldownKey(type: HAdType, placement: string): string {
        return `ad:${type}:${placement}`;
    }

    private getUserMessage(reason?: string): string {
        switch (reason) {
            case 'busy':
                return '广告正在处理中，请勿重复点击';
            case 'cancelled':
                return '观看完整广告后才能获得奖励';
            case 'cooldown':
                return '广告展示过于频繁，请稍后再试';
            case 'timeout':
                return '广告加载超时，请稍后再试';
            case 'config-missing':
            case 'adunit-empty':
                return '广告配置未完成';
            case 'platform-unsupported':
                return '当前平台暂不支持广告';
            case 'unavailable':
            case 'no-fill':
                return '暂无广告，请稍后再试';
            case 'frequency-limit':
                return '广告请求过于频繁，请稍后再试';
            default:
                return '广告暂不可用，请稍后再试';
        }
    }

    private clone<T>(value: T): T {
        return JSON.parse(JSON.stringify(value)) as T;
    }
}
