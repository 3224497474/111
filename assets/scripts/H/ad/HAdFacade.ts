import type { HPlatformFacade } from '../platform/HPlatformFacade';
import type {
    HAdBannerOptions,
    HAdFailReason,
    HAdInitConfig,
    HAdRewardCallback,
    HAdRewardResult,
    HAdShowResult,
    HAdType,
    HResolvedPlatform,
} from '../HTypes';
import { HDouyinAdAdapter, HAdAdapter, HMockAdAdapter, HWechatAdAdapter } from './HAdAdapters';

const DEFAULT_AD_CONFIG: HAdInitConfig = {
    platform: 'auto',
    rewardTimeoutMs: 15000,
    mock: {
        rewardResult: 'success',
        delayMs: 300,
    },
    interstitial: {
        launchDelayMs: 30000,
        intervalMs: 60000,
        afterRewardMs: 60000,
    },
};

export class HAdFacade {
    private config: HAdInitConfig = { ...DEFAULT_AD_CONFIG };
    private platform: HResolvedPlatform = 'mock';
    private adapter: HAdAdapter = new HMockAdAdapter();
    private platformFacade: HPlatformFacade | null = null;
    private initialized = false;
    private showingReward = false;
    private rewardRequestId = 0;
    private showingInterstitial = false;
    private createdAt = Date.now();
    private lastRewardAt = 0;
    private lastInterstitialAt = 0;

    public init(config: HAdInitConfig = {}, platformFacade?: HPlatformFacade): void {
        this.config = {
            ...DEFAULT_AD_CONFIG,
            ...config,
            mock: {
                ...DEFAULT_AD_CONFIG.mock,
                ...(config.mock || {}),
            },
            interstitial: {
                ...DEFAULT_AD_CONFIG.interstitial,
                ...(config.interstitial || {}),
            },
        };
        this.platformFacade = platformFacade || null;
        this.platform = this.resolvePlatform();
        this.adapter = this.createAdapter(this.platform);
        this.adapter.init(this.config);
        this.initialized = true;
        this.createdAt = Date.now();
    }

    /**
     * 播放激励视频。只有 result.rewarded 为 true 时才允许发奖。
     */
    public async showReward(placement: string, cb?: HAdRewardCallback): Promise<HAdRewardResult> {
        this.ensureInit();
        const rawPlacement = placement;
        const normalizedPlacement = this.normalizePlacement(placement);
        const guardReason = this.canShowReward();
        if (guardReason) {
            const ret = this.rewardFail(normalizedPlacement, guardReason, rawPlacement);
            cb?.(ret);
            return ret;
        }

        this.markRewardStart();
        const requestId = this.rewardRequestId;

        if (!this.adapter.isSupported('reward')) {
            const ret = this.rewardFail(normalizedPlacement, 'platform-unsupported', rawPlacement);
            this.markRewardEnd(requestId, false);
            cb?.(ret);
            return ret;
        }

        const adUnitId = this.getAdUnitId('reward', normalizedPlacement);
        if (this.platform !== 'mock' && !adUnitId) {
            const ret = this.rewardFail(normalizedPlacement, 'config-missing', rawPlacement);
            this.markRewardEnd(requestId, false);
            cb?.(ret);
            return ret;
        }

        let shown = false;
        try {
            const ret = await this.withRewardTimeout(
                this.adapter.showReward(normalizedPlacement, adUnitId, rawPlacement),
                normalizedPlacement,
                rawPlacement,
            );
            shown = ret.shown;
            const normalizedRet = this.normalizeRewardResult(ret);
            cb?.(normalizedRet);
            return normalizedRet;
        } finally {
            this.markRewardEnd(requestId, shown);
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

    public async showInterstitial(placement: string): Promise<HAdShowResult> {
        this.ensureInit();
        const normalizedPlacement = this.normalizePlacement(placement);
        const guardReason = this.canShowInterstitial();
        if (guardReason) {
            return this.showFail('interstitial', normalizedPlacement, guardReason);
        }

        if (!this.adapter.isSupported('interstitial')) {
            return this.showFail('interstitial', normalizedPlacement, 'platform-unsupported');
        }

        const adUnitId = this.getAdUnitId('interstitial', normalizedPlacement);
        if (this.platform !== 'mock' && !adUnitId) {
            return this.showFail('interstitial', normalizedPlacement, 'config-missing');
        }

        this.showingInterstitial = true;
        try {
            return this.normalizeShowResult(await this.adapter.showInterstitial(normalizedPlacement, adUnitId));
        } finally {
            this.showingInterstitial = false;
            this.lastInterstitialAt = Date.now();
        }
    }

    public async showBanner(placement: string, options?: HAdBannerOptions): Promise<HAdShowResult> {
        this.ensureInit();
        const normalizedPlacement = this.normalizePlacement(placement);
        if (!this.adapter.isSupported('banner')) {
            return this.showFail('banner', normalizedPlacement, 'platform-unsupported');
        }

        const adUnitId = this.getAdUnitId('banner', normalizedPlacement);
        if (this.platform !== 'mock' && !adUnitId) {
            return this.showFail('banner', normalizedPlacement, 'config-missing');
        }

        return this.normalizeShowResult(await this.adapter.showBanner(normalizedPlacement, adUnitId, options));
    }

    public hideBanner(): void {
        this.ensureInit();
        this.adapter.hideBanner();
    }

    public destroyBanner(): void {
        this.ensureInit();
        this.adapter.destroyBanner();
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

    private resolvePlatform(): HResolvedPlatform {
        const configuredPlatform = this.config.platform || 'auto';
        if (configuredPlatform === 'wechat' || configuredPlatform === 'douyin' || configuredPlatform === 'mock') {
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
        return new HMockAdAdapter();
    }

    private normalizePlacement(placement: string): string {
        const normalizedPlacement = placement.trim();
        if (!normalizedPlacement) {
            throw new Error('[HAdFacade] placement 不能为空');
        }
        return this.config.placementAliasMap?.[normalizedPlacement] || normalizedPlacement;
    }

    private getAdUnitId(type: HAdType, placement: string): string {
        const platformIds = this.config.ids?.[this.platform as 'wechat' | 'douyin' | 'mock'];
        if (type === 'reward') {
            return platformIds?.reward?.[placement] || '';
        }
        if (type === 'interstitial') {
            return platformIds?.interstitial?.[placement] || '';
        }
        return platformIds?.banner?.[placement] || '';
    }

    private canShowReward(): HAdFailReason | null {
        if (this.showingReward || this.showingInterstitial) {
            return 'busy';
        }
        return null;
    }

    private markRewardStart(): void {
        this.showingReward = true;
        this.rewardRequestId += 1;
    }

    private markRewardEnd(requestId: number, shown: boolean): void {
        if (requestId !== this.rewardRequestId) {
            return;
        }

        this.showingReward = false;
        if (shown) {
            this.lastRewardAt = Date.now();
        }
    }

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

    private showFail(type: 'interstitial' | 'banner', placement: string, reason: HAdFailReason): HAdShowResult {
        return {
            ok: false,
            shown: false,
            type,
            placement,
            platform: this.platform,
            reason,
            userMessage: this.getUserMessage(reason),
        };
    }

    private getUserMessage(reason?: string): string {
        switch (reason) {
            case 'busy':
                return '广告正在加载中，请勿重复点击';
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
}
