import { DEFAULT_GAME_AD_CONFIG, getAdUnitId, normalizePlacement } from "./GameAdConfig";
import { DouyinAdAdapter } from "./adapters/DouyinAdAdapter";
import { IAdAdapter } from "./adapters/IAdAdapter";
import { LegacyBridgeAdAdapter } from "./adapters/LegacyBridgeAdAdapter";
import { MockAdAdapter } from "./adapters/MockAdAdapter";
import { WechatAdAdapter } from "./adapters/WechatAdAdapter";
import { AdFrequencyGuard } from "./core/AdFrequencyGuard";
import { AdLogger } from "./core/AdLogger";
import { AdPlatformDetector } from "./core/AdPlatformDetector";
import { AdResultFactory } from "./core/AdResultFactory";
import {
    GameAdBannerOptions,
    GameAdInitConfig,
    GameAdLegacyCallback,
    GameAdResolvedPlatform,
    GameAdRewardCallback,
    GameAdRewardResult,
    GameAdShowResult,
} from "./GameAdTypes";

export class GameAd {
    private static config: GameAdInitConfig = { ...DEFAULT_GAME_AD_CONFIG };
    private static platform: GameAdResolvedPlatform = "unknown";
    private static adapter: IAdAdapter = new MockAdAdapter();
    private static initialized = false;

    /**
     * 初始化广告 SDK，并根据配置或运行环境选择平台适配器。
     * 建议在游戏启动阶段调用一次，业务层后续只调用 GameAd 的静态方法。
     */
    public static init(config: GameAdInitConfig = {}): void {
        this.config = {
            ...DEFAULT_GAME_AD_CONFIG,
            ...config,
            rewardTimeoutMs: config.rewardTimeoutMs ?? DEFAULT_GAME_AD_CONFIG.rewardTimeoutMs,
            mock: {
                ...DEFAULT_GAME_AD_CONFIG.mock,
                ...(config.mock || {}),
            },
            interstitial: {
                ...DEFAULT_GAME_AD_CONFIG.interstitial,
                ...(config.interstitial || {}),
            },
        };

        AdLogger.init(this.config);
        this.platform = AdPlatformDetector.detect(this.config);
        this.adapter = this.createAdapter(this.platform);
        this.adapter.init(this.config);
        this.initialized = true;

        AdLogger.info("广告 SDK 初始化完成", {
            platform: this.platform,
        });
    }

    /**
     * 播放激励视频广告。
     * 只有返回值中的 rewarded 为 true 时，业务才可以发放奖励。
     */
    public static async showReward(placement: string, cb?: GameAdRewardCallback): Promise<GameAdRewardResult> {
        this.ensureInit();

        const rawPlacement = placement;
        const normalizedPlacement = normalizePlacement(placement, this.config.placementAliasMap);
        const guardReason = AdFrequencyGuard.canShowReward();
        if (guardReason) {
            const ret = AdResultFactory.rewardFail(this.platform, normalizedPlacement, guardReason, rawPlacement, undefined, undefined, undefined, this.getUserMessage(guardReason));
            cb?.(ret);
            return ret;
        }

        // 从进入 SDK 的第一时间上锁，避免网络卡顿时重复点击并发创建多个广告请求。
        AdFrequencyGuard.markRewardStart();
        const requestId = AdFrequencyGuard.getRewardRequestId();

        if (!this.adapter.isSupported("reward")) {
            const ret = AdResultFactory.rewardFail(this.platform, normalizedPlacement, "platform-unsupported", rawPlacement, undefined, undefined, undefined, this.getUserMessage("platform-unsupported"));
            cb?.(ret);
            AdFrequencyGuard.markRewardEnd(requestId, false);
            return ret;
        }

        const adUnitId = getAdUnitId(this.config, this.platform, "reward", normalizedPlacement);
        if (this.platform != "mock" && this.platform != "legacy-bridge" && !adUnitId) {
            const ret = AdResultFactory.rewardFail(this.platform, normalizedPlacement, "config-missing", rawPlacement, undefined, undefined, undefined, this.getUserMessage("config-missing"));
            cb?.(ret);
            AdFrequencyGuard.markRewardEnd(requestId, false);
            return ret;
        }

        let countAsShown = false;
        try {
            const ret = await this.withRewardTimeout(
                this.adapter.showReward(normalizedPlacement, adUnitId, rawPlacement),
                normalizedPlacement,
                rawPlacement,
            );
            countAsShown = ret.shown;
            const normalizedRet = this.normalizeNoAdResult(ret);
            cb?.(normalizedRet);
            return normalizedRet;
        } finally {
            // 只有真实展示过广告，才影响“激励视频后插屏冷却”。
            AdFrequencyGuard.markRewardEnd(requestId, countAsShown);
        }
    }

    /**
     * 旧项目数字状态兼容接口。
     * st: 1 表示完整观看，2 表示中途关闭，0 表示其他失败。
     */
    public static showRewardLegacy(placement: string, cb: GameAdLegacyCallback): void {
        void this.showReward(placement).then((ret) => {
            if (ret.rewarded) {
                cb(1, ret);
            } else if (ret.reason == "cancelled") {
                cb(2, ret);
            } else {
                cb(0, ret);
            }
        });
    }

    /**
     * 展示插屏广告。
     * 插屏不参与发奖，失败时也不应该阻断业务流程。
     */
    public static async showInterstitial(placement: string): Promise<GameAdShowResult> {
        this.ensureInit();

        const normalizedPlacement = normalizePlacement(placement, this.config.placementAliasMap);
        const guardReason = AdFrequencyGuard.canShowInterstitial(this.config);
        if (guardReason) {
            return AdResultFactory.showFail("interstitial", this.platform, normalizedPlacement, guardReason, undefined, undefined, undefined, this.getUserMessage(guardReason));
        }

        if (!this.adapter.isSupported("interstitial")) {
            return AdResultFactory.showFail("interstitial", this.platform, normalizedPlacement, "platform-unsupported", undefined, undefined, undefined, this.getUserMessage("platform-unsupported"));
        }

        const adUnitId = getAdUnitId(this.config, this.platform, "interstitial", normalizedPlacement);
        if (this.platform != "mock" && !adUnitId) {
            return AdResultFactory.showFail("interstitial", this.platform, normalizedPlacement, "config-missing", undefined, undefined, undefined, this.getUserMessage("config-missing"));
        }

        AdFrequencyGuard.markInterstitialStart();
        try {
            return this.normalizeShowResult(await this.adapter.showInterstitial(normalizedPlacement, adUnitId));
        } finally {
            AdFrequencyGuard.markInterstitialEnd();
        }
    }

    /**
     * 展示 Banner 广告。
     * 建议只在首页、商店等低操作压力界面调用，离开界面时调用 hideBanner 或 destroyBanner。
     */
    public static async showBanner(placement: string, options?: GameAdBannerOptions): Promise<GameAdShowResult> {
        this.ensureInit();

        const normalizedPlacement = normalizePlacement(placement, this.config.placementAliasMap);
        if (!this.adapter.isSupported("banner")) {
            return AdResultFactory.showFail("banner", this.platform, normalizedPlacement, "platform-unsupported", undefined, undefined, undefined, this.getUserMessage("platform-unsupported"));
        }

        const adUnitId = getAdUnitId(this.config, this.platform, "banner", normalizedPlacement);
        if (this.platform != "mock" && !adUnitId) {
            return AdResultFactory.showFail("banner", this.platform, normalizedPlacement, "config-missing", undefined, undefined, undefined, this.getUserMessage("config-missing"));
        }

        return this.normalizeShowResult(await this.adapter.showBanner(normalizedPlacement, adUnitId, options));
    }

    /**
     * 隐藏当前 Banner，但保留实例，适合短暂离开界面后还会继续展示的场景。
     */
    public static hideBanner(): void {
        this.ensureInit();
        this.adapter.hideBanner();
    }

    /**
     * 销毁当前 Banner 实例，适合场景销毁或长期不再展示 Banner 的场景。
     */
    public static destroyBanner(): void {
        this.ensureInit();
        this.adapter.destroyBanner();
    }

    /**
     * 获取 SDK 当前实际使用的平台适配器。
     */
    public static getPlatform(): GameAdResolvedPlatform {
        this.ensureInit();
        return this.platform;
    }

    /**
     * 懒初始化保护，避免业务忘记手动调用 init 时直接报错。
     */
    private static ensureInit(): void {
        if (!this.initialized) {
            this.init();
        }
    }

    /**
     * 根据平台类型创建对应适配器。
     * 新增平台时只需要在这里增加 Adapter 分支。
     */
    private static createAdapter(platform: GameAdResolvedPlatform): IAdAdapter {
        if (platform == "wechat") {
            return new WechatAdAdapter();
        }
        if (platform == "douyin") {
            return new DouyinAdAdapter();
        }
        if (platform == "legacy-bridge") {
            return new LegacyBridgeAdAdapter();
        }
        return new MockAdAdapter();
    }

    /**
     * 给激励视频请求加超时保护。
     * 网络卡顿或平台回调丢失时，会返回 timeout 并释放全局点击锁。
     */
    private static withRewardTimeout(promise: Promise<GameAdRewardResult>, placement: string, rawPlacement?: string): Promise<GameAdRewardResult> {
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
                resolve(AdResultFactory.rewardFail(this.platform, placement, "timeout", rawPlacement, undefined, undefined, undefined, this.getUserMessage("timeout")));
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
                resolve(AdResultFactory.rewardFail(this.platform, placement, "platform-error", rawPlacement, err, undefined, err?.message, this.getUserMessage("platform-error")));
            });
        });
    }

    /**
     * 统一整理激励视频失败结果。
     * 将平台无填充、配置缺失等情况转成业务可直接处理的提示信息。
     */
    private static normalizeNoAdResult(ret: GameAdRewardResult): GameAdRewardResult {
        if (ret.rewarded) {
            return ret;
        }

        const noAdReasons = ["no-fill", "adunit-empty", "config-missing", "platform-unsupported"];
        if (ret.reason && noAdReasons.indexOf(ret.reason) >= 0) {
            return {
                ...ret,
                reason: ret.reason == "no-fill" ? "unavailable" : ret.reason,
                userMessage: ret.userMessage || this.getUserMessage("unavailable"),
            };
        }

        return {
            ...ret,
            userMessage: ret.userMessage || this.getUserMessage(ret.reason),
        };
    }

    /**
     * 统一整理 Banner 和插屏失败结果。
     */
    private static normalizeShowResult(ret: GameAdShowResult): GameAdShowResult {
        if (ret.ok) {
            return ret;
        }

        const noAdReasons = ["no-fill", "adunit-empty", "config-missing", "platform-unsupported"];
        if (ret.reason && noAdReasons.indexOf(ret.reason) >= 0) {
            return {
                ...ret,
                reason: ret.reason == "no-fill" ? "unavailable" : ret.reason,
                userMessage: ret.userMessage || this.getUserMessage("unavailable"),
            };
        }

        return {
            ...ret,
            userMessage: ret.userMessage || this.getUserMessage(ret.reason),
        };
    }

    /**
     * 根据失败原因返回可直接给玩家展示的中文提示。
     */
    private static getUserMessage(reason?: string): string {
        switch (reason) {
            case "busy":
                return "广告正在加载中，请勿重复点击";
            case "cancelled":
                return "观看完整广告后才能获得奖励";
            case "cooldown":
                return "广告展示过于频繁，请稍后再试";
            case "timeout":
                return "广告加载超时，请稍后再试";
            case "config-missing":
            case "adunit-empty":
                return "广告配置未完成";
            case "platform-unsupported":
                return "当前平台暂不支持广告";
            case "unavailable":
            case "no-fill":
                return "暂无广告，请稍后再试";
            case "frequency-limit":
                return "广告请求过于频繁，请稍后再试";
            default:
                return "广告暂不可用，请稍后再试";
        }
    }
}
