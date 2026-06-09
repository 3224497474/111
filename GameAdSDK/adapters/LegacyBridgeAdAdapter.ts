import { GameAdBannerOptions, GameAdInitConfig, GameAdRewardResult, GameAdShowResult } from "../GameAdTypes";
import { AdResultFactory } from "../core/AdResultFactory";
import { IAdAdapter } from "./IAdAdapter";

export class LegacyBridgeAdAdapter implements IAdAdapter {
    public readonly platform = "legacy-bridge" as const;
    private config: GameAdInitConfig | null = null;

    /**
     * 保存旧广告 SDK 桥接配置。
     */
    public init(config: GameAdInitConfig): void {
        this.config = config;
    }

    /**
     * 通用旧 SDK 桥接 V1 只要求支持激励视频。
     */
    public isSupported(type: "reward" | "interstitial" | "banner"): boolean {
        if (type == "reward") {
            return !!this.config?.legacyBridge?.showRewardedAd;
        }
        return false;
    }

    /**
     * 调用项目传入的旧广告函数，并把旧数字状态转换为 SDK 统一结果。
     */
    public showReward(placement: string, _adUnitId: string, rawPlacement?: string): Promise<GameAdRewardResult> {
        const showRewardedAd = this.config?.legacyBridge?.showRewardedAd;
        if (!showRewardedAd) {
            return Promise.resolve(AdResultFactory.rewardFail(this.platform, placement, "platform-unsupported", rawPlacement));
        }

        return new Promise((resolve) => {
            let settled = false;

            const settle = (result: GameAdRewardResult) => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve(result);
            };

            try {
                showRewardedAd(rawPlacement || placement, (st: number) => {
                    if (st == 1) {
                        settle(AdResultFactory.rewardSuccess(this.platform, placement, rawPlacement, { st }));
                    } else if (st == 2) {
                        settle(AdResultFactory.rewardFail(this.platform, placement, "cancelled", rawPlacement, { st }));
                    } else {
                        settle(AdResultFactory.rewardFail(this.platform, placement, "platform-error", rawPlacement, { st }));
                    }
                });
            } catch (err: any) {
                settle(AdResultFactory.rewardFail(this.platform, placement, "platform-error", rawPlacement, err, undefined, err?.message));
            }
        });
    }

    /**
     * 旧桥接暂不处理插屏，统一返回平台不支持。
     */
    public showInterstitial(placement: string): Promise<GameAdShowResult> {
        return Promise.resolve(AdResultFactory.showFail("interstitial", this.platform, placement, "platform-unsupported"));
    }

    /**
     * 旧桥接暂不处理 Banner，统一返回平台不支持。
     */
    public showBanner(placement: string, _adUnitId: string, _options?: GameAdBannerOptions): Promise<GameAdShowResult> {
        return Promise.resolve(AdResultFactory.showFail("banner", this.platform, placement, "platform-unsupported"));
    }

    /**
     * 旧桥接没有 Banner 实例，这里保留空实现以满足统一接口。
     */
    public hideBanner(): void {
    }

    /**
     * 旧桥接没有 Banner 实例，这里保留空实现以满足统一接口。
     */
    public destroyBanner(): void {
    }
}
