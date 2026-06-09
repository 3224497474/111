import { GameAdBannerOptions, GameAdInitConfig, GameAdRewardResult, GameAdShowResult } from "../GameAdTypes";
import { AdLogger } from "../core/AdLogger";
import { AdResultFactory } from "../core/AdResultFactory";
import { IAdAdapter } from "./IAdAdapter";

declare const tt: any;

export class DouyinAdAdapter implements IAdAdapter {
    public readonly platform = "douyin" as const;
    private rewardedAd: any = null;
    private rewardedAdUnitId = "";
    private bannerAd: any = null;
    private config: GameAdInitConfig | null = null;

    /**
     * 保存 SDK 配置，抖音适配器目前主要使用全局 tt API。
     */
    public init(config: GameAdInitConfig): void {
        this.config = config;
    }

    /**
     * 检查抖音环境是否支持指定广告类型。
     */
    public isSupported(type: "reward" | "interstitial" | "banner"): boolean {
        const api = this.getTt();
        if (!api) {
            return false;
        }
        if (type == "reward") {
            return !!api.createRewardedVideoAd;
        }
        if (type == "interstitial") {
            return !!api.createInterstitialAd;
        }
        return !!api.createBannerAd;
    }

    /**
     * 展示抖音激励视频。
     * 只有 onClose 回调中的 isEnded 为 true 时才返回 rewarded=true。
     */
    public async showReward(placement: string, adUnitId: string, rawPlacement?: string): Promise<GameAdRewardResult> {
        const api = this.getTt();
        if (!api?.createRewardedVideoAd) {
            return AdResultFactory.rewardFail(this.platform, placement, "platform-unsupported", rawPlacement);
        }
        if (!adUnitId) {
            return AdResultFactory.rewardFail(this.platform, placement, "adunit-empty", rawPlacement);
        }

        let ad: any;
        try {
            ad = this.getOrCreateRewardedAd(api, adUnitId);
        } catch (err: any) {
            return AdResultFactory.rewardFail(this.platform, placement, "platform-error", rawPlacement, err, undefined, err?.message);
        }

        return new Promise((resolve) => {
            let settled = false;

            const cleanup = () => {
                ad.offClose?.(onClose);
                ad.offError?.(onError);
            };

            const settle = (ret: GameAdRewardResult) => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                resolve(ret);
            };

            const onClose = (res?: { isEnded?: boolean; count?: number }) => {
                if (res?.isEnded === true) {
                    settle(AdResultFactory.rewardSuccess(this.platform, placement, rawPlacement, res));
                } else {
                    settle(AdResultFactory.rewardFail(this.platform, placement, "cancelled", rawPlacement, res));
                }
            };

            const onError = (err?: any) => {
                const reason = this.mapErrorReason(err);
                settle(AdResultFactory.rewardFail(this.platform, placement, reason, rawPlacement, err, err?.errCode, err?.errMsg || err?.message));
            };

            ad.onClose?.(onClose);
            ad.onError?.(onError);

            this.loadAndShow(ad).catch(onError);
        });
    }

    /**
     * 展示抖音插屏广告。
     * 具体展示频控由 GameAd 的 AdFrequencyGuard 统一处理。
     */
    public async showInterstitial(placement: string, adUnitId: string): Promise<GameAdShowResult> {
        const api = this.getTt();
        if (!api?.createInterstitialAd) {
            return AdResultFactory.showFail("interstitial", this.platform, placement, "platform-unsupported");
        }
        if (!adUnitId) {
            return AdResultFactory.showFail("interstitial", this.platform, placement, "adunit-empty");
        }

        return new Promise((resolve) => {
            let ad: any = null;
            let settled = false;

            const cleanup = () => {
                ad?.offClose?.(onClose);
                ad?.offError?.(onError);
                ad?.destroy?.();
            };

            const settle = (ret: GameAdShowResult, cleanupNow = true) => {
                if (settled) {
                    return;
                }
                settled = true;
                if (cleanupNow) {
                    cleanup();
                }
                resolve(ret);
            };

            const onClose = () => {
                cleanup();
            };

            const onError = (err?: any) => {
                settle(AdResultFactory.showFail("interstitial", this.platform, placement, this.mapErrorReason(err), err, err?.errCode, err?.errMsg || err?.message));
            };

            try {
                ad = api.createInterstitialAd({ adUnitId });
                ad.onClose?.(onClose);
                ad.onError?.(onError);
                ad.show()
                    .then(() => settle(AdResultFactory.showSuccess("interstitial", this.platform, placement), false))
                    .catch(onError);
            } catch (err: any) {
                onError(err);
            }
        });
    }

    /**
     * 创建并展示抖音 Banner。
     * 每次展示前销毁旧 Banner，避免多个原生 Banner 叠加。
     */
    public async showBanner(placement: string, adUnitId: string, options?: GameAdBannerOptions): Promise<GameAdShowResult> {
        const api = this.getTt();
        if (!api?.createBannerAd) {
            return AdResultFactory.showFail("banner", this.platform, placement, "platform-unsupported");
        }
        if (!adUnitId) {
            return AdResultFactory.showFail("banner", this.platform, placement, "adunit-empty");
        }

        try {
            this.destroyBanner();

            const systemInfo = api.getSystemInfoSync?.() || {};
            const windowWidth = systemInfo.windowWidth || systemInfo.screenWidth || 375;
            const windowHeight = systemInfo.windowHeight || systemInfo.screenHeight || 667;
            const width = options?.width || Math.floor(windowWidth * (options?.widthRatio || 0.8));
            const top = this.getBannerTop(windowHeight, options);
            const left = options?.position == "custom" && typeof options.left == "number"
                ? options.left
                : Math.floor((windowWidth - width) / 2);

            this.bannerAd = api.createBannerAd({
                adUnitId,
                adIntervals: options?.adIntervals ?? 30,
                style: {
                    left,
                    top,
                    width,
                },
            });

            this.bannerAd.onResize?.((res: { width: number; height: number }) => {
                this.bannerAd.style.left = Math.floor((windowWidth - res.width) / 2);
                if (options?.position != "top-center") {
                    this.bannerAd.style.top = Math.floor(windowHeight - res.height);
                }
            });

            await this.bannerAd.show();
            return AdResultFactory.showSuccess("banner", this.platform, placement);
        } catch (err: any) {
            return AdResultFactory.showFail("banner", this.platform, placement, this.mapErrorReason(err), err, err?.errCode, err?.errMsg || err?.message);
        }
    }

    /**
     * 隐藏当前抖音 Banner。
     */
    public hideBanner(): void {
        this.bannerAd?.hide?.();
    }

    /**
     * 销毁当前抖音 Banner。
     */
    public destroyBanner(): void {
        this.bannerAd?.destroy?.();
        this.bannerAd = null;
    }

    /**
     * 获取抖音小游戏全局 API 对象。
     */
    private getTt(): any {
        return (globalThis as any).tt || (typeof tt != "undefined" ? tt : null);
    }

    /**
     * 获取或创建抖音激励视频实例。
     * 抖音激励视频按全局单实例维护。
     */
    private getOrCreateRewardedAd(api: any, adUnitId: string): any {
        // 抖音官方规则里激励视频全局只有一个实例，这里按单实例维护。
        if (this.rewardedAd && this.rewardedAdUnitId == adUnitId) {
            return this.rewardedAd;
        }

        this.rewardedAd?.destroy?.();
        this.rewardedAdUnitId = adUnitId;
        this.rewardedAd = api.createRewardedVideoAd({ adUnitId });
        return this.rewardedAd;
    }

    /**
     * 展示激励视频。
     * 如果 show 因未加载失败，则尝试 load 后再 show 一次。
     */
    private async loadAndShow(ad: any): Promise<void> {
        try {
            await ad.show();
        } catch (showErr) {
            AdLogger.debug("抖音激励视频 show 失败，尝试 load 后再次 show", showErr);
            await ad.load();
            await ad.show();
        }
    }

    /**
     * 根据 Banner 位置配置计算 top 坐标。
     */
    private getBannerTop(windowHeight: number, options?: GameAdBannerOptions): number {
        if (options?.position == "top-center") {
            return options.top ?? 0;
        }
        if (options?.position == "custom" && typeof options.top == "number") {
            return options.top;
        }
        return Math.floor(windowHeight - 120);
    }

    /**
     * 将抖音平台错误转换为 SDK 统一失败原因。
     */
    private mapErrorReason(err?: any) {
        const code = `${err?.errCode ?? ""}`;
        const message = `${err?.errMsg || err?.message || ""}`;
        if (code == "158886" || message.includes("频繁") || message.includes("frequency")) {
            return "frequency-limit" as const;
        }
        if (message.includes("no ad") || message.includes("no fill") || message.includes("暂无广告")) {
            return "no-fill" as const;
        }
        if (message.includes("not support") || message.includes("not supported") || message.includes("不支持")) {
            return "platform-unsupported" as const;
        }
        if (message.includes("adUnitId") && (message.includes("empty") || message.includes("为空"))) {
            return "adunit-empty" as const;
        }
        return "platform-error" as const;
    }
}
