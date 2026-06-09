import { GameAdBannerOptions, GameAdInitConfig, GameAdRewardResult, GameAdShowResult } from "../GameAdTypes";
import { AdResultFactory } from "../core/AdResultFactory";
import { IAdAdapter } from "./IAdAdapter";

export class MockAdAdapter implements IAdAdapter {
    public readonly platform = "mock" as const;
    private config: GameAdInitConfig | null = null;
    private bannerVisible = false;

    /**
     * 保存 Mock 配置，用于模拟成功、取消、无广告、超时等结果。
     */
    public init(config: GameAdInitConfig): void {
        this.config = config;
    }

    /**
     * Mock 环境默认支持所有广告类型，方便编辑器和 Web 预览测试流程。
     */
    public isSupported(): boolean {
        return true;
    }

    /**
     * 模拟激励视频结果。
     * 个人没有广告 ID 时，可以通过这里练习完整广告流程。
     */
    public async showReward(placement: string, _adUnitId: string, rawPlacement?: string): Promise<GameAdRewardResult> {
        const mock = this.config?.mock || {};
        await this.wait(mock.delayMs ?? 300);

        switch (mock.rewardResult || "success") {
            case "success":
                return AdResultFactory.rewardSuccess(this.platform, placement, rawPlacement);
            case "cancelled":
                return AdResultFactory.rewardFail(this.platform, placement, "cancelled", rawPlacement);
            case "no-fill":
                return AdResultFactory.rewardFail(this.platform, placement, "no-fill", rawPlacement);
            case "timeout":
                return AdResultFactory.rewardFail(this.platform, placement, "timeout", rawPlacement);
            default:
                return AdResultFactory.rewardFail(this.platform, placement, "platform-error", rawPlacement);
        }
    }

    /**
     * 模拟插屏广告展示。
     */
    public async showInterstitial(placement: string): Promise<GameAdShowResult> {
        await this.wait(this.config?.mock?.delayMs ?? 200);
        return AdResultFactory.showSuccess("interstitial", this.platform, placement);
    }

    /**
     * 模拟 Banner 广告展示。
     */
    public async showBanner(placement: string, _adUnitId: string, _options?: GameAdBannerOptions): Promise<GameAdShowResult> {
        this.bannerVisible = true;
        await this.wait(50);
        return AdResultFactory.showSuccess("banner", this.platform, placement, { visible: this.bannerVisible });
    }

    /**
     * 模拟隐藏 Banner。
     */
    public hideBanner(): void {
        this.bannerVisible = false;
    }

    /**
     * 模拟销毁 Banner。
     */
    public destroyBanner(): void {
        this.bannerVisible = false;
    }

    /**
     * 模拟广告加载或展示过程中的异步等待。
     */
    private wait(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
