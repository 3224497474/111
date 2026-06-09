import { GameAdBannerOptions, GameAdInitConfig, GameAdResolvedPlatform, GameAdRewardResult, GameAdShowResult } from "../GameAdTypes";

export interface IAdAdapter {
    readonly platform: GameAdResolvedPlatform;

    /**
     * 初始化平台适配器。
     */
    init(config: GameAdInitConfig): void;

    /**
     * 判断当前平台是否支持指定广告类型。
     */
    isSupported(type: "reward" | "interstitial" | "banner"): boolean;

    /**
     * 展示激励视频广告。
     * Adapter 必须把平台回调统一转换为 GameAdRewardResult。
     */
    showReward(placement: string, adUnitId: string, rawPlacement?: string): Promise<GameAdRewardResult>;

    /**
     * 展示插屏广告。
     */
    showInterstitial(placement: string, adUnitId: string): Promise<GameAdShowResult>;

    /**
     * 展示 Banner 广告。
     */
    showBanner(placement: string, adUnitId: string, options?: GameAdBannerOptions): Promise<GameAdShowResult>;

    /**
     * 隐藏当前 Banner。
     */
    hideBanner(): void;

    /**
     * 销毁当前 Banner。
     */
    destroyBanner(): void;
}
