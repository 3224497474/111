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
 * HAdFacade 负责配置、频控、统计和上报；Adapter 只负责按平台官方 API 调用广告对象并归一化结果。
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

type HRewardAdCache = {
    ad: any;
    adUnitId: string;
    ready: boolean;
    loading: boolean;
    loadPromise: Promise<HAdPreloadResult> | null;
};

const PLATFORM_RETRY_ERROR_CODE = '2002';

/**
 * 微信/抖音小游戏广告 adapter 的公共结果归一化。
 * 注意：激励/插屏的真实官方 API 调用分别写在 HWechatAdAdapter / HDouyinAdAdapter，方便对照平台文档排查。
 */
abstract class HMiniGameAdAdapter implements HAdAdapter {
    public abstract readonly platform: HResolvedPlatform;
    protected config: HAdInitConfig = {};
    protected bannerAd: any = null;
    protected rewardedAds: Map<string, HRewardAdCache> = new Map();

    public abstract getApi(): any;
    public abstract preloadReward(placement: string, adUnitId: string): Promise<HAdPreloadResult>;
    public abstract showReward(placement: string, adUnitId: string, rawPlacement?: string): Promise<HAdRewardResult>;
    public abstract showInterstitial(placement: string, adUnitId: string): Promise<HAdShowResult>;

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

    public isRewardReady(_placement: string, adUnitId: string): boolean {
        if (!adUnitId) {
            return false;
        }
        return this.rewardedAds.get(adUnitId)?.ready === true;
    }

    // Banner 两个平台 API 接近，保留一份公共实现。
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

        this.bannerAd.onError?.((err: any) => {
            console.warn?.('[HAdAdapter] banner onError', err);
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

        return Promise.resolve(this.bannerAd.show())
            .then((raw) => this.showSuccess('banner', placement, raw))
            .catch((err: any) => this.showFail(
                'banner',
                placement,
                this.mapErrorReason(err),
                err,
                this.getErrorCode(err),
                this.getErrorMessage(err),
            ));
    }

    public hideBanner(): void {
        this.bannerAd?.hide?.();
    }

    public destroyBanner(): void {
        this.bannerAd?.destroy?.();
        this.bannerAd = null;
    }

    // 激励广告推荐提前创建实例并监听 onLoad/onError；show 时只根据 onClose.isEnded 发奖励。
    protected preloadRewardWithOfficialAd(
        placement: string,
        adUnitId: string,
        createRewardedVideoAd: () => any,
    ): Promise<HAdPreloadResult> {
        if (!adUnitId) {
            return Promise.resolve(this.preloadFail(placement, 'adunit-empty'));
        }

        let cache: HRewardAdCache;
        try {
            cache = this.getOrCreateRewardAd(adUnitId, createRewardedVideoAd);
        } catch (err: any) {
            return Promise.resolve(this.preloadFail(placement, this.mapErrorReason(err), err, this.getErrorCode(err), this.getErrorMessage(err)));
        }

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

            // 官方建议始终注册 onError，避免拉取/播放异常无处处理。
            const onError = (err?: any) => {
                cache.ready = false;
                this.destroyRewardAd(adUnitId);
                settle(this.preloadFail(
                    placement,
                    this.mapErrorReason(err),
                    err,
                    this.getErrorCode(err),
                    this.getErrorMessage(err),
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

    protected showRewardWithOfficialAd(
        placement: string,
        adUnitId: string,
        rawPlacement: string | undefined,
        createRewardedVideoAd: () => any,
    ): Promise<HAdRewardResult> {
        if (!adUnitId) {
            return Promise.resolve(this.rewardFail(placement, 'adunit-empty', rawPlacement));
        }

        let cache: HRewardAdCache;
        try {
            cache = this.getOrCreateRewardAd(adUnitId, createRewardedVideoAd);
        } catch (err: any) {
            return Promise.resolve(this.rewardFail(placement, this.mapErrorReason(err), rawPlacement, err, this.getErrorCode(err), this.getErrorMessage(err)));
        }

        return new Promise((resolve) => {
            let resolved = false;
            let didShow = false;
            const ad = cache.ad;

            const cleanup = () => {
                ad.offClose?.(onClose);
                ad.offError?.(onError);
            };

            const resolveOnce = (result: HAdRewardResult) => {
                if (resolved) {
                    return;
                }
                resolved = true;
                cache.ready = false;
                cache.loading = false;
                cache.loadPromise = null;
                cleanup();
                this.destroyRewardAd(cache.adUnitId);
                resolve(result);
            };

            // 官方奖励判定入口：只在 onClose 里读取 isEnded，完整观看才给奖励。
            const onClose = (res: any) => {
                if (res?.isEnded === true) {
                    resolveOnce(this.rewardSuccess(placement, rawPlacement, res));
                    return;
                }
                resolveOnce(this.rewardFail(placement, 'cancelled', rawPlacement, res));
            };

            // 拉取、展示、播放过程中任何平台异常都走 onError；2002 会在 HAdFacade 中转成 30 秒冷却。
            const onError = (err: any) => {
                resolveOnce(this.rewardFail(
                    placement,
                    this.mapErrorReason(err),
                    rawPlacement,
                    err,
                    this.getErrorCode(err),
                    this.getErrorMessage(err),
                    didShow,
                ));
            };

            ad.onClose?.(onClose);
            ad.onError?.(onError);

            const showOnce = () => Promise.resolve(ad.show()).then(() => {
                didShow = true;
                cache.ready = false;
            });

            // 兼容“广告还没 load 完就 show”的情况：show 失败后按官方常见写法 load 再 show 一次。
            showOnce().catch((showErr: any) => {
                if (!ad.load) {
                    throw showErr;
                }
                return Promise.resolve(ad.load()).then(() => showOnce());
            }).catch(onError);
        });
    }

    protected getOrCreateRewardAd(adUnitId: string, createRewardedVideoAd: () => any): HRewardAdCache {
        let cache = this.rewardedAds.get(adUnitId);
        if (cache) {
            return cache;
        }

        cache = {
            ad: createRewardedVideoAd(),
            adUnitId,
            ready: false,
            loading: false,
            loadPromise: null,
        };
        this.rewardedAds.set(adUnitId, cache);
        return cache;
    }

    protected destroyRewardAd(adUnitId: string): void {
        const cache = this.rewardedAds.get(adUnitId);
        if (!cache) {
            return;
        }

        cache.ad?.destroy?.();
        this.rewardedAds.delete(adUnitId);
    }

    protected isPlatformRetryError(err: any): boolean {
        const code = `${this.getErrorCode(err) || ''}`;
        const message = this.getErrorMessage(err).toLowerCase();
        return code === PLATFORM_RETRY_ERROR_CODE || message.indexOf(PLATFORM_RETRY_ERROR_CODE) >= 0;
    }

    // 平台 errCode/errMsg 映射成框架错误原因，Facade 会再转换成 userMessage 和统计事件。
    protected mapErrorReason(err: any): HAdFailReason {
        const code = `${this.getErrorCode(err) || ''}`;
        const message = this.getErrorMessage(err).toLowerCase();
        if (this.isPlatformRetryError(err)) {
            return 'frequency-limit';
        }
        if (['1004', '1005', '1006', '1007', '1008'].indexOf(code) >= 0 || message.indexOf('no ad') >= 0 || message.indexOf('no fill') >= 0) {
            return 'no-fill';
        }
        if (message.indexOf('frequency') >= 0 || message.indexOf('too often') >= 0 || message.indexOf('频繁') >= 0 || message.indexOf('too frequently') >= 0) {
            return 'frequency-limit';
        }
        if (message.indexOf('adunit') >= 0 || message.indexOf('unit') >= 0 || message.indexOf('广告位') >= 0) {
            return 'adunit-empty';
        }
        return 'platform-error';
    }

    protected getErrorCode(err: any): string | number | undefined {
        return err?.errCode ?? err?.errno ?? err?.errorCode ?? err?.code;
    }

    protected getErrorMessage(err: any): string {
        return `${err?.errMsg || err?.message || err?.errorMessage || ''}`;
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
        shown = false,
    ): HAdRewardResult {
        return {
            ok: false,
            shown: shown || reason === 'cancelled',
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

    protected showSuccess(type: 'interstitial' | 'banner', placement: string, raw?: unknown): HAdShowResult {
        return {
            ok: true,
            shown: true,
            type,
            placement,
            platform: this.platform,
            raw,
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

// 微信广告 adapter：这里直接写 wx 官方 API 形态，方便拿代码和微信官方文档逐行对照。
// 官方 API 入口：https://developers.weixin.qq.com/minigame/dev/api/
// 重点对照：wx.createRewardedVideoAd / wx.createInterstitialAd / wx.createBannerAd。
export class HWechatAdAdapter extends HMiniGameAdAdapter {
    public readonly platform = 'wechat' as const;

    public getApi(): any {
        return (globalThis as any).wx;
    }

    public preloadReward(placement: string, adUnitId: string): Promise<HAdPreloadResult> {
        const wx = (globalThis as any).wx;
        if (!wx?.createRewardedVideoAd) {
            return Promise.resolve(this.preloadFail(placement, 'platform-unsupported'));
        }
        if (!adUnitId) {
            return Promise.resolve(this.preloadFail(placement, 'adunit-empty'));
        }

        let cache: HRewardAdCache;
        try {
            cache = this.getOrCreateRewardAd(adUnitId, () => {
                // 微信官方写法：创建激励视频广告组件，参数只传广告位 id。
                // docs: https://developers.weixin.qq.com/minigame/dev/api/ad/wx.createRewardedVideoAd.html
                const rewardedVideoAd = wx.createRewardedVideoAd({
                    adUnitId,
                });
                return rewardedVideoAd;
            });
        } catch (err: any) {
            return Promise.resolve(this.preloadFail(placement, this.mapErrorReason(err), err, this.getErrorCode(err), this.getErrorMessage(err)));
        }

        if (cache.ready) {
            return Promise.resolve(this.preloadSuccess(placement, { cached: true }));
        }
        if (cache.loading && cache.loadPromise) {
            return cache.loadPromise;
        }

        cache.loading = true;
        cache.loadPromise = new Promise((resolve) => {
            let settled = false;
            const rewardedVideoAd = cache.ad;

            const cleanup = () => {
                rewardedVideoAd.offLoad?.(onLoad);
                rewardedVideoAd.offError?.(onError);
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

            // 微信官方事件写法：rewardedVideoAd.onLoad(callback)。
            const onLoad = (raw?: unknown) => {
                cache.ready = true;
                settle(this.preloadSuccess(placement, raw));
            };

            // 微信官方建议广告对象始终监听 onError，2002 等平台错误在 Facade 里统一转为 30 秒冷却。
            const onError = (err?: any) => {
                cache.ready = false;
                this.destroyRewardAd(adUnitId);
                settle(this.preloadFail(
                    placement,
                    this.mapErrorReason(err),
                    err,
                    this.getErrorCode(err),
                    this.getErrorMessage(err),
                ));
            };

            rewardedVideoAd.onLoad?.(onLoad);
            rewardedVideoAd.onError?.(onError);

            if (!rewardedVideoAd.load) {
                cache.ready = true;
                settle(this.preloadSuccess(placement, { noLoadApi: true }));
                return;
            }

            // 微信官方播放前可先 load；加载成功后标记 ready，真正发奖励仍然只看 onClose.isEnded。
            Promise.resolve(rewardedVideoAd.load())
                .then((raw) => {
                    cache.ready = true;
                    settle(this.preloadSuccess(placement, raw));
                })
                .catch(onError);
        });

        return cache.loadPromise;
    }

    public showReward(placement: string, adUnitId: string, rawPlacement?: string): Promise<HAdRewardResult> {
        const wx = (globalThis as any).wx;
        if (!wx?.createRewardedVideoAd) {
            return Promise.resolve(this.rewardFail(placement, 'platform-unsupported', rawPlacement));
        }
        if (!adUnitId) {
            return Promise.resolve(this.rewardFail(placement, 'adunit-empty', rawPlacement));
        }

        let cache: HRewardAdCache;
        try {
            cache = this.getOrCreateRewardAd(adUnitId, () => {
                // 微信官方写法：wx.createRewardedVideoAd({ adUnitId }) 返回激励视频广告实例。
                // docs: https://developers.weixin.qq.com/minigame/dev/api/ad/wx.createRewardedVideoAd.html
                const rewardedVideoAd = wx.createRewardedVideoAd({
                    adUnitId,
                });
                return rewardedVideoAd;
            });
        } catch (err: any) {
            return Promise.resolve(this.rewardFail(placement, this.mapErrorReason(err), rawPlacement, err, this.getErrorCode(err), this.getErrorMessage(err)));
        }

        return new Promise((resolve) => {
            let resolved = false;
            let didShow = false;
            const rewardedVideoAd = cache.ad;

            const cleanup = () => {
                rewardedVideoAd.offClose?.(onClose);
                rewardedVideoAd.offError?.(onError);
            };

            const resolveOnce = (result: HAdRewardResult) => {
                if (resolved) {
                    return;
                }
                resolved = true;
                cache.ready = false;
                cache.loading = false;
                cache.loadPromise = null;
                cleanup();
                this.destroyRewardAd(cache.adUnitId);
                resolve(result);
            };

            // 微信官方奖励判定入口：rewardedVideoAd.onClose(callback)，完整观看时 res.isEnded === true。
            const onClose = (res: any) => {
                if (res?.isEnded === true) {
                    resolveOnce(this.rewardSuccess(placement, rawPlacement, res));
                    return;
                }
                resolveOnce(this.rewardFail(placement, 'cancelled', rawPlacement, res));
            };

            // 微信官方异常入口：rewardedVideoAd.onError(callback)。
            // errCode === 2002 会由 HAdFacade 记录 30 秒平台冷却，避免马上重复请求。
            const onError = (err: any) => {
                resolveOnce(this.rewardFail(
                    placement,
                    this.mapErrorReason(err),
                    rawPlacement,
                    err,
                    this.getErrorCode(err),
                    this.getErrorMessage(err),
                    didShow,
                ));
            };

            rewardedVideoAd.onClose?.(onClose);
            rewardedVideoAd.onError?.(onError);

            const showOnce = () => Promise.resolve(rewardedVideoAd.show()).then(() => {
                didShow = true;
                cache.ready = false;
            });

            // 微信官方常见写法：show 失败时，先 load()，再 show()。
            showOnce().catch((showErr: any) => {
                if (!rewardedVideoAd.load) {
                    throw showErr;
                }
                return Promise.resolve(rewardedVideoAd.load()).then(() => showOnce());
            }).catch(onError);
        });
    }

    public showInterstitial(placement: string, adUnitId: string): Promise<HAdShowResult> {
        const wx = (globalThis as any).wx;
        if (!wx?.createInterstitialAd) {
            return Promise.resolve(this.showFail('interstitial', placement, 'platform-unsupported'));
        }
        if (!adUnitId) {
            return Promise.resolve(this.showFail('interstitial', placement, 'adunit-empty'));
        }

        return new Promise((resolve) => {
            let resolved = false;
            let interstitialAd: any;

            const resolveOnce = (result: HAdShowResult) => {
                if (resolved) {
                    return;
                }
                resolved = true;
                resolve(result);
            };

            const cleanup = () => {
                interstitialAd?.offError?.(onError);
                interstitialAd?.offClose?.(onClose);
            };

            let showRaw: unknown;

            const onClose = (raw?: unknown) => {
                cleanup();
                interstitialAd?.destroy?.();
                // 保持 Promise 到关闭时才结束，这样 HAdFacade.isShowingAd() 在广告展示期间一直为 true。
                resolveOnce(this.showSuccess('interstitial', placement, raw || showRaw));
            };

            const onError = (err: any) => {
                cleanup();
                interstitialAd?.destroy?.();
                resolveOnce(this.showFail(
                    'interstitial',
                    placement,
                    this.mapErrorReason(err),
                    err,
                    this.getErrorCode(err),
                    this.getErrorMessage(err),
                ));
            };

            try {
                // 微信官方写法：wx.createInterstitialAd({ adUnitId }) 每次创建插屏广告实例。
                // docs: https://developers.weixin.qq.com/minigame/dev/api/ad/wx.createInterstitialAd.html
                interstitialAd = wx.createInterstitialAd({
                    adUnitId,
                });
                // 插屏广告默认隐藏，必须调用 interstitialAd.show() 才展示；异常统一走 onError。
                interstitialAd.onError?.(onError);
                interstitialAd.onClose?.(onClose);

                Promise.resolve(interstitialAd.show())
                    .then((raw) => {
                        showRaw = raw;
                    })
                    .catch(onError);
            } catch (err: any) {
                onError(err);
            }
        });
    }
}

// 抖音广告 adapter：这里直接写 tt 官方 API 形态，方便拿代码和文档示例逐行对照。
export class HDouyinAdAdapter extends HMiniGameAdAdapter {
    public readonly platform = 'douyin' as const;

    public getApi(): any {
        return (globalThis as any).tt;
    }

    public preloadReward(placement: string, adUnitId: string): Promise<HAdPreloadResult> {
        const tt = (globalThis as any).tt;
        if (!tt?.createRewardedVideoAd) {
            return Promise.resolve(this.preloadFail(placement, 'platform-unsupported'));
        }

        return this.preloadRewardWithOfficialAd(placement, adUnitId, () => tt.createRewardedVideoAd({
            adUnitId,
        }));
    }

    public showReward(placement: string, adUnitId: string, rawPlacement?: string): Promise<HAdRewardResult> {
        const tt = (globalThis as any).tt;
        if (!tt?.createRewardedVideoAd) {
            return Promise.resolve(this.rewardFail(placement, 'platform-unsupported', rawPlacement));
        }

        return this.showRewardWithOfficialAd(placement, adUnitId, rawPlacement, () => tt.createRewardedVideoAd({
            adUnitId,
        }));
    }

    public showInterstitial(placement: string, adUnitId: string): Promise<HAdShowResult> {
        const tt = (globalThis as any).tt;
        if (!tt?.createInterstitialAd) {
            return Promise.resolve(this.showFail('interstitial', placement, 'platform-unsupported'));
        }
        if (!adUnitId) {
            return Promise.resolve(this.showFail('interstitial', placement, 'adunit-empty'));
        }

        return new Promise((resolve) => {
            let resolved = false;
            let interstitialAd: any;

            const resolveOnce = (result: HAdShowResult) => {
                if (resolved) {
                    return;
                }
                resolved = true;
                resolve(result);
            };

            const cleanup = () => {
                interstitialAd?.offError?.(onError);
                interstitialAd?.offClose?.(onClose);
            };

            let showRaw: unknown;

            const onClose = (raw?: unknown) => {
                cleanup();
                interstitialAd?.destroy?.();
                // 保持 Promise 到关闭时才结束，这样 HAdFacade.isShowingAd() 在广告展示期间一直为 true。
                resolveOnce(this.showSuccess('interstitial', placement, raw || showRaw));
            };

            const onError = (err: any) => {
                cleanup();
                interstitialAd?.destroy?.();
                resolveOnce(this.showFail(
                    'interstitial',
                    placement,
                    this.mapErrorReason(err),
                    err,
                    this.getErrorCode(err),
                    this.getErrorMessage(err),
                ));
            };

            try {
                // 官方说明：createInterstitialAd 每次都会创建全新实例；默认隐藏，必须 show() 才会展示。
                interstitialAd = tt.createInterstitialAd({
                    adUnitId,
                });
                // 官方建议始终注册 onError，所有异常统一处理，包括 2002 频控错误。
                interstitialAd.onError?.(onError);
                interstitialAd.onClose?.(onClose);

                Promise.resolve(interstitialAd.show())
                    .then((raw) => {
                        showRaw = raw;
                    })
                    .catch(onError);
            } catch (err: any) {
                onError(err);
            }
        });
    }
}

/**
 * Mock 广告 adapter 用于编辑器/Web 跑通广告流程。
 * 可通过 ad.mock.rewardResult 模拟 success/cancelled/no-fill/frequency-limit/timeout 等结果。
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
                    errorCode: result === 'frequency-limit' ? PLATFORM_RETRY_ERROR_CODE : undefined,
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
