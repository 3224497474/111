import { GameAdInitConfig, GameAdPlatformIds, GameAdResolvedPlatform, GameAdType } from "./GameAdTypes";

export const DEFAULT_GAME_AD_CONFIG: GameAdInitConfig = {
    platform: "auto",
    debug: false,
    rewardTimeoutMs: 15000,
    mock: {
        rewardResult: "success",
        delayMs: 300,
    },
    interstitial: {
        launchDelayMs: 30000,
        intervalMs: 60000,
        afterRewardMs: 60000,
    },
};

export const DEFAULT_PLACEMENT_ALIAS_MAP: Record<string, string> = {};

/**
 * 将项目自定义广告别名转换成稳定 placement。
 * SDK 默认不内置任何具体游戏的业务文案，项目需要兼容旧文案时通过 placementAliasMap 显式传入。
 */
export function normalizePlacement(rawPlacement: string, customMap?: Record<string, string>): string {
    const map = {
        ...DEFAULT_PLACEMENT_ALIAS_MAP,
        ...(customMap || {}),
    };

    if (map[rawPlacement]) {
        return map[rawPlacement];
    }

    return rawPlacement;
}

/**
 * 根据当前平台取出对应广告位配置组。
 */
export function getPlatformIds(config: GameAdInitConfig, platform: GameAdResolvedPlatform): GameAdPlatformIds | undefined {
    if (platform == "wechat") {
        return config.ids?.wechat;
    }
    if (platform == "douyin") {
        return config.ids?.douyin;
    }
    if (platform == "legacy-bridge") {
        return config.ids?.legacyBridge;
    }
    if (platform == "mock") {
        return config.ids?.mock;
    }
    return undefined;
}

/**
 * 根据平台、广告类型和 placement 获取真实平台广告 ID。
 * 业务层永远不直接传 adUnitId。
 */
export function getAdUnitId(
    config: GameAdInitConfig,
    platform: GameAdResolvedPlatform,
    type: GameAdType,
    placement: string,
): string {
    const platformIds = getPlatformIds(config, platform);
    if (!platformIds) {
        return "";
    }

    if (type == "reward") {
        return platformIds.reward?.[placement] || "";
    }
    if (type == "interstitial") {
        return platformIds.interstitial?.[placement] || "";
    }
    return platformIds.banner?.[placement] || "";
}
