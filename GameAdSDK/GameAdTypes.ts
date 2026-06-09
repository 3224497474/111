export type GameAdPlatform = "auto" | "wechat" | "douyin" | "mock" | "legacy-bridge";

export type GameAdResolvedPlatform = "wechat" | "douyin" | "mock" | "legacy-bridge" | "unknown";

export type GameAdType = "reward" | "interstitial" | "banner";

export type GameAdFailReason =
    | "busy"
    | "cooldown"
    | "unavailable"
    | "config-missing"
    | "platform-unsupported"
    | "adunit-empty"
    | "no-fill"
    | "frequency-limit"
    | "cancelled"
    | "timeout"
    | "platform-error";

export type GameAdLogLevel = "debug" | "info" | "warn" | "error";

export interface GameAdPlatformIds {
    reward?: Record<string, string>;
    interstitial?: Record<string, string>;
    banner?: Record<string, string>;
}

export interface GameAdIds {
    wechat?: GameAdPlatformIds;
    douyin?: GameAdPlatformIds;
    mock?: GameAdPlatformIds;
    legacyBridge?: GameAdPlatformIds;
}

export interface GameAdMockConfig {
    rewardResult?: "success" | "cancelled" | "no-fill" | "timeout" | "platform-error";
    delayMs?: number;
}

export interface GameAdInterstitialPolicy {
    launchDelayMs?: number;
    intervalMs?: number;
    afterRewardMs?: number;
}

export interface GameAdLegacyBridge {
    /**
     * 旧广告 SDK 激励视频桥接函数。
     * 用于把已有项目的广告系统临时接入 GameAdSDK，和具体游戏项目无关。
     * st: 1 完整观看，2 中途关闭，0 或其他值表示失败。
     */
    showRewardedAd?: (placement: string, cb: (st: number) => void) => void;
}

export interface GameAdInitConfig {
    platform?: GameAdPlatform;
    ids?: GameAdIds;
    debug?: boolean;
    mock?: GameAdMockConfig;
    rewardTimeoutMs?: number;
    interstitial?: GameAdInterstitialPolicy;
    placementAliasMap?: Record<string, string>;
    legacyBridge?: GameAdLegacyBridge;
    logger?: (level: GameAdLogLevel, message: string, data?: unknown) => void;
}

export interface GameAdBannerOptions {
    position?: "bottom-center" | "top-center" | "custom";
    left?: number;
    top?: number;
    width?: number;
    widthRatio?: number;
    adIntervals?: number;
}

export interface GameAdBaseResult {
    ok: boolean;
    shown: boolean;
    type: GameAdType;
    placement: string;
    rawPlacement?: string;
    platform: GameAdResolvedPlatform;
    reason?: GameAdFailReason;
    errorCode?: string | number;
    errorMessage?: string;
    userMessage?: string;
    raw?: unknown;
}

export interface GameAdRewardResult extends GameAdBaseResult {
    type: "reward";
    rewarded: boolean;
    completed: boolean;
}

export interface GameAdShowResult extends GameAdBaseResult {
    type: "interstitial" | "banner";
}

export type GameAdRewardCallback = (result: GameAdRewardResult) => void;

export type GameAdLegacyCallback = (st: number, result?: GameAdRewardResult) => void;
