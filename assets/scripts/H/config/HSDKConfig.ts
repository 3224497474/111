import type { HSDKConfigData } from '../HTypes';

export const HDefaultSDKConfig: HSDKConfigData = {
    env: 'dev',
    platforms: {
        wechat: {
            ads: {
                reward: {
                    revive: "微信激励视频广告位ID",
                },
                interstitial: {
                    level_end: "微信插屏广告位ID",
                },
                banner: {
                    home_bottom: "微信Banner广告位ID",
                },
            },
        },
        douyin: {
            ads: {},
        },
        '4399': {
            ads: {},
        },
        web: {
            ads: {},
        },
        mock: {
            ads: {},
        },
    },
    share: {},
    cooldown: {},
    switches: {},
};
