import type {
    HAdBannerOptions,
    HAdFailReason,
    HAdInitConfig,
    HAdRewardResult,
    HAdShowResult,
    HResolvedPlatform,
} from '../HTypes';

export interface HAdAdapter {
    readonly platform: HResolvedPlatform;
    init(config: HAdInitConfig): void;
    isSupported(type: 'reward' | 'interstitial' | 'banner'): boolean;
    showReward(placement: string, adUnitId: string, rawPlacement?: string): Promise<HAdRewardResult>;
    showInterstitial(placement: string, adUnitId: string): Promise<HAdShowResult>;
    showBanner(placement: string, adUnitId: string, options?: HAdBannerOptions): Promise<HAdShowResult>;
    hideBanner(): void;
    destroyBanner(): void;
}

abstract class HMiniGameAdAdapter implements HAdAdapter {
    public abstract readonly platform: HResolvedPlatform;
    protected config: HAdInitConfig = {};
    protected bannerAd: any = null;

    public abstract getApi(): any;

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
            const ad = api.createRewardedVideoAd({ adUnitId });

            const settle = (result: HAdRewardResult) => {
                if (settled) {
                    return;
                }
                settled = true;
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

    protected showWithLoadRetry(ad: any): Promise<void> {
        return Promise.resolve(ad.show()).catch(() => {
            if (!ad.load) {
                throw new Error('ad show failed');
            }
            return Promise.resolve(ad.load()).then(() => ad.show());
        });
    }

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

export class HWechatAdAdapter extends HMiniGameAdAdapter {
    public readonly platform = 'wechat' as const;

    public getApi(): any {
        return (globalThis as any).wx;
    }
}

export class HDouyinAdAdapter extends HMiniGameAdAdapter {
    public readonly platform = 'douyin' as const;

    public getApi(): any {
        return (globalThis as any).tt;
    }
}

export class HMockAdAdapter implements HAdAdapter {
    public readonly platform = 'mock' as const;
    private config: HAdInitConfig = {};

    public init(config: HAdInitConfig): void {
        this.config = config;
    }

    public isSupported(_type: 'reward' | 'interstitial' | 'banner'): boolean {
        return true;
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
