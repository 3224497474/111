import type { HSDKConfigData } from '../HTypes';

export const HDefaultSDKConfig: HSDKConfigData = {
    env: 'dev',
    platforms: {
        wechat: {
            ads: {},
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
