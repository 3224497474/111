import { sys } from "cc";
import { GameAdInitConfig, GameAdResolvedPlatform } from "../GameAdTypes";

declare const wx: any;
declare const tt: any;

export class AdPlatformDetector {
    /**
     * 自动识别当前运行平台。
     * 优先使用用户指定平台，其次检查 wx/tt 全局 API，无法识别时回退到 mock。
     */
    public static detect(config: GameAdInitConfig): GameAdResolvedPlatform {
        if (config.platform && config.platform != "auto") {
            return config.platform;
        }

        const g = globalThis as any;
        if ((typeof wx != "undefined" || g.wx) && g.wx?.createRewardedVideoAd) {
            return "wechat";
        }

        if ((typeof tt != "undefined" || g.tt) && g.tt?.createRewardedVideoAd) {
            return "douyin";
        }

        if (sys.platform == sys.Platform.WECHAT_GAME && g.wx?.createRewardedVideoAd) {
            return "wechat";
        }

        return "mock";
    }
}
