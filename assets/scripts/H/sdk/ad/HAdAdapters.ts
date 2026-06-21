import type {
    HAdBannerOptions,
    HAdFailReason,
    HAdInitConfig,
    HAdPreloadResult,
    HAdRewardResult,
    HAdShowResult,
    HResolvedPlatform,
} from '../../HTypes';

/**
 * 广告平台适配接口。
 * HAdFacade 负责配置、频控、统计和上报；Adapter 只负责调用平台广告 API 并归一化结果。
 */
export interface HAdAdapter {
    readonly platform: HResolvedPlatform;
    init(config: HAdInitConfig): void;
    isSupported(type: 'reward' | 'interstitial' | 'banner'): boolean;
    preloadReward(placement: string, adUnitId: string): Promise<HAdPreloadResult>;
    isRewardReady(placement: string, adUnitId: string): boolean;
    showReward(placement: string, adUnitId: string, rawPlacement?: string): Promise<HAdRewardResult>;
    showInterstitial(placement: string, adUnitId: string): Promise<HAdShowResult>;
    showBanner(placement: string, adUnitId: string, options?: HAdBannerOptions): Promise<HAdShowResult>;
    hideBanner(): void;
    destroyBanner(): void;
}

/**
 * 微信/抖音小游戏广告 adapter 的公共实现。
 * 两个平台的广告对象 API 接近，这里统一处理 create/load/show/onClose/onError。
 */
abstract class HMiniGameAdAdapter implements HAdAdapter {
    public abstract readonly platform: HResolvedPlatform;
    protected config: HAdInitConfig = {};
    protected bannerAd: any = null;
    protected rewardedAds: Map<string, {
        ad: any;
        adUnitId: string;
        ready: boolean;
        loading: boolean;
        loadPromise: Promise<HAdPreloadResult> | null;
    }> = new Map();

    public abstract getApi(): any;

    // 只保存广告配置，广告位 id 由 HAdFacade 解析后传进来。
    public init(config: HAdInitConfig): void {
        this.config = config;
    }

    public isSupported(type: 'reward' | 'interstitial' | 'banner'): boolean {
        const api = this.getApi();
        if (type === 'reward') {
            return !!api?.createRewardedVideoAd;
        }
        if (type === 'interstitial') {
            return !!api?.createInterstitialAd;
        }
        return !!api?.createBannerAd;
    }

    // 预加载会缓存 rewardedVideoAd，重复 preload 同一广告位会复用正在加载的 Promise。
    public preloadReward(placement: string, adUnitId: string): Promise<HAdPreloadResult> {
        const api = this.getApi();
        if (!api?.createRewardedVideoAd) {
            return Promise.resolve(this.preloadFail(placement, 'platform-unsupported'));
        }
        if (!adUnitId) {
            return Promise.resolve(this.preloadFail(placement, 'adunit-empty'));
        }

        const cache = this.getOrCreateRewardAd(api, adUnitId);
        if (cache.ready) {
            return Promise.resolve(this.preloadSuccess(placement, { cached: true }));
        }
        if (cache.loading && cache.loadPromise) {
            return cache.loadPromise;
        }

        cache.loading = true;
        cache.loadPromise = new Promise((resolve) => {
            let settled = false;

            const cleanup = () => {
                cache.ad.offLoad?.(onLoad);
                cache.ad.offError?.(onError);
            };

            const settle = (result: HAdPreloadResult) => {
                if (settled) {
                    return;
                }
                settled = true;
                cache.loading = false;
                cache.loadPromise = null;
                cleanup();
                resolve(result);
            };

            const onLoad = (raw?: unknown) => {
                cache.ready = true;
                settle(this.preloadSuccess(placement, raw));
            };

            const onError = (err?: any) => {
                cache.ready = false;
                settle(this.preloadFail(
                    placement,
                    this.mapErrorReason(err),
                    err,
                    err?.errCode || err?.errno,
                    err?.errMsg || err?.message,
                ));
            };

            cache.ad.onLoad?.(onLoad);
            cache.ad.onError?.(onError);

            if (!cache.ad.load) {
                cache.ready = true;
                settle(this.preloadSuccess(placement, { noLoadApi: true }));
                return;
            }

            Promise.resolve(cache.ad.load())
                .then((raw) => {
                    cache.ready = true;
                    settle(this.preloadSuccess(placement, raw));
                })
                .catch(onError);
        });

        return cache.loadPromise;
    }

    public isRewardReady(_placement: string, adUnitId: string): boolean {
        if (!adUnitId) {
            return false;
        }
        return this.rewardedAds.get(adUnitId)?.ready === true;
    }

    // 激励展示的奖励判定只看平台 onClose 的 isEnded，未完整观看统一返回 cancelled。
    public showReward(placement: string, adUnitId: string, rawPlacement?: string): Promise<HAdRewardResult> {
        const api = this.getApi();
        if (!api?.createRewardedVideoAd) {
            return Promise.resolve(this.rewardFail(placement, 'platform-unsupported', rawPlacement));
        }
        if (!adUnitId) {
            return Promise.resolve(this.rewardFail(placement, 'adunit-empty', rawPlacement));
        }

        return new Promise((resolve) => {
            let settled = false;
            const cache = this.getOrCreateRewardAd(api, adUnitId);
            const ad = cache.ad;

            const settle = (result: HAdRewardResult) => {
                if (settled) {
                    return;
                }
                settled = true;
                cache.ready = false;
                ad.offClose?.(onClose);
                ad.offError?.(onError);
                resolve(result);
            };

            const onClose = (res: any) => {
                if (res?.isEnded === true) {
                    settle(this.rewardSuccess(placement, rawPlacement, res));
                    return;
                }
                settle(this.rewardFail(placement, 'cancelled', rawPlacement, res));
            };

            const onError = (err: any) => {
                settle(this.rewardFail(
                    placement,
                    this.mapErrorReason(err),
                    rawPlacement,
                    err,
                    err?.errCode || err?.errno,
                    err?.errMsg || err?.message,
                ));
            };

            ad.onClose?.(onClose);
            ad.onError?.(onError);

            this.showWithLoadRetry(ad).catch(onError);
        });
    }

    public showInterstitial(placement: string, adUnitId: string): Promise<HAdShowResult> {
        const api = this.getApi();
        if (!api?.createInterstitialAd) {
            return Promise.resolve(this.showFail('interstitial', placement, 'platform-unsupported'));
        }
        if (!adUnitId) {
            return Promise.resolve(this.showFail('interstitial', placement, 'adunit-empty'));
        }

        return new Promise((resolve) => {
            let settled = false;
            const ad = api.createInterstitialAd({ adUnitId });

            const settle = (result: HAdShowResult) => {
                if (settled) {
                    return;
                }
                settled = true;
                ad.offError?.(onError);
                resolve(result);
            };

            const onClose = () => {
                ad.offError?.(onError);
                ad.offClose?.(onClose);
                ad.destroy?.();
            };

            const onError = (err: any) => {
                ad.destroy?.();
                settle(this.showFail(
                    'interstitial',
                    placement,
                    this.mapErrorReason(err),
                    err,
                    err?.errCode || err?.errno,
                    err?.errMsg || err?.message,
                ));
            };

            ad.onError?.(onError);
            ad.onClose?.(onClose);
            this.showWithLoadRetry(ad)
                .then(() => settle(this.showSuccess('interstitial', placement)))
                .catch(onError);
        });
    }

    // Banner 每次展示前销毁旧 banner，避免多个平台 banner 重叠或遗留。
    public showBanner(placement: string, adUnitId: string, options: HAdBannerOptions = {}): Promise<HAdShowResult> {
        const api = this.getApi();
        if (!api?.createBannerAd) {
            return Promise.resolve(this.showFail('banner', placement, 'platform-unsupported'));
        }
        if (!adUnitId) {
            return Promise.resolve(this.showFail('banner', placement, 'adunit-empty'));
        }

        this.destroyBanner();

        const systemInfo = api.getSystemInfoSync?.() || {};
        const screenWidth = systemInfo.screenWidth || 750;
        const screenHeight = systemInfo.screenHeight || 1334;
        const width = options.width || Math.floor(screenWidth * (options.widthRatio || 0.8));
        const left = options.position === 'custom'
            ? options.left || 0
            : Math.floor((screenWidth - width) / 2);
        const top = options.position === 'top-center'
            ? options.top || 0
            : options.position === 'custom'
                ? options.top || 0
                : screenHeight - 120;

        this.bannerAd = api.createBannerAd({
            adUnitId,
            adIntervals: options.adIntervals,
            style: {
                left,
                top,
                width,
            },
        });

        this.bannerAd.onResize?.((res: any) => {
            if (!this.bannerAd?.style || options.position === 'custom') {
                return;
            }
            this.bannerAd.style.left = Math.floor((screenWidth - res.width) / 2);
            if (options.position !== 'top-center') {
                this.bannerAd.style.top = screenHeight - res.height;
            }
        });

        return this.bannerAd.show()
            .then(() => this.showSuccess('banner', placement))
            .catch((err: any) => this.showFail(
                'banner',
                placement,
                this.mapErrorReason(err),
                err,
                err?.errCode || err?.errno,
                err?.errMsg || err?.message,
            ));
    }

    public hideBanner(): void {
        this.bannerAd?.hide?.();
    }

    public destroyBanner(): void {
        this.bannerAd?.destroy?.();
        this.bannerAd = null;
    }

    // 每个 adUnitId 只创建一个 rewardedVideoAd，减少平台对象重复创建和事件管理成本。
    protected getOrCreateRewardAd(api: any, adUnitId: string) {
        let cache = this.rewardedAds.get(adUnitId);
        if (cache) {
            return cache;
        }

        cache = {
            ad: api.createRewardedVideoAd({ adUnitId }),
            adUnitId,
            ready: false,
            loading: false,
            loadPromise: null,
        };
        this.rewardedAds.set(adUnitId, cache);
        return cache;
    }

    // 平台 show 失败时尝试 load 后再 show，兼容微信/抖音“未加载先 show”的常见错误。
    protected showWithLoadRetry(ad: any): Promise<void> {
        return Promise.resolve(ad.show()).catch(() => {
            if (!ad.load) {
                throw new Error('ad show failed');
            }
            return Promise.resolve(ad.load()).then(() => ad.show());
        });
    }

    // 平台 errCode/errMsg 映射成框架错误原因，Facade 会再转换成 userMessage 和统计事件。
    protected mapErrorReason(err: any): HAdFailReason {
        const code = `${err?.errCode || err?.errno || ''}`;
        const message = `${err?.errMsg || err?.message || ''}`.toLowerCase();
        if (['1004', '1005', '1006', '1007', '1008'].indexOf(code) >= 0 || message.indexOf('no ad') >= 0 || message.indexOf('no fill') >= 0) {
            return 'no-fill';
        }
        if (message.indexOf('frequency') >= 0 || message.indexOf('too often') >= 0 || message.indexOf('频繁') >= 0) {
            return 'frequency-limit';
        }
        if (message.indexOf('adunit') >= 0 || message.indexOf('unit') >= 0) {
            return 'adunit-empty';
        }
        return 'platform-error';
    }

    // 以下 result 构造方法只做字段归一化，不做统计；统计统一在 HAdFacade.record*。
    protected preloadSuccess(placement: string, raw?: unknown): HAdPreloadResult {
        return {
            ok: true,
            ready: true,
            type: 'reward',
            placement,
            platform: this.platform,
            raw,
        };
    }

    protected preloadFail(
        placement: string,
        reason: HAdFailReason,
        raw?: unknown,
        errorCode?: string | number,
        errorMessage?: string,
    ): HAdPreloadResult {
        return {
            ok: false,
            ready: false,
            type: 'reward',
            placement,
            platform: this.platform,
            reason,
            raw,
            errorCode,
            errorMessage,
        };
    }

    protected rewardSuccess(placement: string, rawPlacement?: string, raw?: unknown): HAdRewardResult {
        return {
            ok: true,
            shown: true,
            rewarded: true,
            completed: true,
            type: 'reward',
            placement,
            rawPlacement,
            platform: this.platform,
            raw,
        };
    }

    protected rewardFail(
        placement: string,
        reason: HAdFailReason,
        rawPlacement?: string,
        raw?: unknown,
        errorCode?: string | number,
        errorMessage?: string,
    ): HAdRewardResult {
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
            errorCode,
            errorMessage,
        };
    }

    protected showSuccess(type: 'interstitial' | 'banner', placement: string): HAdShowResult {
        return {
            ok: true,
            shown: true,
            type,
            placement,
            platform: this.platform,
        };
    }

    protected showFail(
        type: 'interstitial' | 'banner',
        placement: string,
        reason: HAdFailReason,
        raw?: unknown,
        errorCode?: string | number,
        errorMessage?: string,
    ): HAdShowResult {
        return {
            ok: false,
            shown: false,
            type,
            placement,
            platform: this.platform,
            reason,
            raw,
            errorCode,
            errorMessage,
        };
    }
}

// 微信广告 adapter：调用全局 wx。
export class HWechatAdAdapter extends HMiniGameAdAdapter {
    public readonly platform = 'wechat' as const;

    public getApi(): any {
        return (globalThis as any).wx;
    }
}

// 抖音广告 adapter：调用全局 tt。
export class HDouyinAdAdapter extends HMiniGameAdAdapter {
    public readonly platform = 'douyin' as const;

    public getApi(): any {
        return (globalThis as any).tt;
    }
}

/**
 * Mock 广告 adapter 用于编辑器/Web 跑通广告流程。
 * 可通过 ad.mock.rewardResult 模拟 success/cancelled/no-fill/timeout 等结果。
 */
export class HMockAdAdapter implements HAdAdapter {
    public readonly platform: HResolvedPlatform;
    private config: HAdInitConfig = {};
    private readonly readyRewards = new Set<string>();

    public constructor(platform: HResolvedPlatform = 'mock') {
        this.platform = platform === 'unknown' ? 'mock' : platform;
    }

    public init(config: HAdInitConfig): void {
        this.config = config;
    }

    public isSupported(_type: 'reward' | 'interstitial' | 'banner'): boolean {
        return true;
    }

    public preloadReward(placement: string, _adUnitId: string): Promise<HAdPreloadResult> {
        this.readyRewards.add(placement);
        return Promise.resolve({
            ok: true,
            ready: true,
            type: 'reward',
            placement,
            platform: this.platform,
        });
    }

    public isRewardReady(placement: string): boolean {
        return this.readyRewards.has(placement);
    }

    public showReward(placement: string, _adUnitId: string, rawPlacement?: string): Promise<HAdRewardResult> {
        const result = this.config.mock?.rewardResult || 'success';
        const delayMs = Math.max(0, this.config.mock?.delayMs ?? 300);
        if (result === 'timeout') {
            return new Promise<HAdRewardResult>(() => {
                // 故意不 resolve，让 HAdFacade 的超时保护接管。
            });
        }

        return new Promise((resolve) => {
            setTimeout(() => {
                if (result === 'success') {
                    this.readyRewards.delete(placement);
                    resolve({
                        ok: true,
                        shown: true,
                        rewarded: true,
                        completed: true,
                        type: 'reward',
                        placement,
                        rawPlacement,
                        platform: this.platform,
                    });
                    return;
                }

                this.readyRewards.delete(placement);
                resolve({
                    ok: false,
                    shown: result === 'cancelled',
                    rewarded: false,
                    completed: false,
                    type: 'reward',
                    placement,
                    rawPlacement,
                    platform: this.platform,
                    reason: result === 'no-fill' ? 'no-fill' : result,
                });
            }, delayMs);
        });
    }

    public showInterstitial(placement: string): Promise<HAdShowResult> {
        return Promise.resolve({
            ok: true,
            shown: true,
            type: 'interstitial',
            placement,
            platform: this.platform,
        });
    }

    public showBanner(placement: string): Promise<HAdShowResult> {
        return Promise.resolve({
            ok: true,
            shown: true,
            type: 'banner',
            placement,
            platform: this.platform,
        });
    }

    public hideBanner(): void {
    }

    public destroyBanner(): void {
    }
}
