import { GameAdFailReason, GameAdResolvedPlatform, GameAdRewardResult, GameAdShowResult } from "../GameAdTypes";

export class AdResultFactory {
    /**
     * 创建激励视频成功结果。
     * 该结果代表可以发奖。
     */
    public static rewardSuccess(platform: GameAdResolvedPlatform, placement: string, rawPlacement?: string, raw?: unknown): GameAdRewardResult {
        return {
            ok: true,
            shown: true,
            rewarded: true,
            completed: true,
            type: "reward",
            placement,
            rawPlacement,
            platform,
            raw,
        };
    }

    /**
     * 创建激励视频失败结果。
     * 该结果代表不能发奖，业务可根据 reason 或 userMessage 做提示。
     */
    public static rewardFail(
        platform: GameAdResolvedPlatform,
        placement: string,
        reason: GameAdFailReason,
        rawPlacement?: string,
        raw?: unknown,
        errorCode?: string | number,
        errorMessage?: string,
        userMessage?: string,
    ): GameAdRewardResult {
        return {
            ok: false,
            shown: reason == "cancelled",
            rewarded: false,
            completed: false,
            type: "reward",
            placement,
            rawPlacement,
            platform,
            reason,
            raw,
            errorCode,
            errorMessage,
            userMessage,
        };
    }

    /**
     * 创建 Banner 或插屏展示成功结果。
     */
    public static showSuccess(type: "interstitial" | "banner", platform: GameAdResolvedPlatform, placement: string, raw?: unknown): GameAdShowResult {
        return {
            ok: true,
            shown: true,
            type,
            placement,
            platform,
            raw,
        };
    }

    /**
     * 创建 Banner 或插屏展示失败结果。
     */
    public static showFail(
        type: "interstitial" | "banner",
        platform: GameAdResolvedPlatform,
        placement: string,
        reason: GameAdFailReason,
        raw?: unknown,
        errorCode?: string | number,
        errorMessage?: string,
        userMessage?: string,
    ): GameAdShowResult {
        return {
            ok: false,
            shown: false,
            type,
            placement,
            platform,
            reason,
            raw,
            errorCode,
            errorMessage,
            userMessage,
        };
    }
}
