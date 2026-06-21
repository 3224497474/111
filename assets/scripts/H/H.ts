import type { HInitOptions } from './HTypes';
import { HAdFacade } from './sdk/ad/HAdFacade';
import { HAnalyticsFacade } from './analytics/HAnalyticsFacade';
import { HConfigFacade } from './config/HConfigFacade';
import { HEventBus } from './core/HEventBus';
import { HDataStore } from './data/HDataStore';
import { HStoreFacade } from './store/HStoreFacade';
import { HPlatformFacade } from './sdk/platform/HPlatformFacade';
import { HRedDotFacade } from './redDot/HRedDotFacade';
import { HResourceFacade } from './resource/HResourceFacade';
import { HRewardFacade } from './reward/HRewardFacade';
import { HSDKFacade } from './sdk/HSDKFacade';
import { HScreenFacade } from './sdk/HScreenFacade';
import { HSessionTimer } from './session/HSessionTimer';
import { HTransitionFacade } from './transition/HTransitionFacade';
import { HUIFacade } from './ui/HUIFacade';
import { HUserFacade } from './user/HUserFacade';

export class H {
    public static readonly event = new HEventBus();
    public static readonly data = new HDataStore();
    public static readonly store = new HStoreFacade();
    public static readonly ui = new HUIFacade();
    public static readonly redDot = new HRedDotFacade();
    public static readonly resource = new HResourceFacade();
    public static readonly transition = new HTransitionFacade();
    public static readonly platform = new HPlatformFacade();
    public static readonly config = new HConfigFacade();
    public static readonly user = new HUserFacade();
    public static readonly ad = new HAdFacade();
    public static readonly session = new HSessionTimer();
    public static readonly analytics = new HAnalyticsFacade();
    public static readonly sdk = new HSDKFacade();
    public static readonly screen = new HScreenFacade();
    public static readonly reward = new HRewardFacade();

    private static initialized = false;

    /**
     * H 框架总入口。建议在游戏启动阶段调用一次。
     */
    public static init(options: HInitOptions = {}): void {
        this.data.init(options.data);
        this.store.init(options.store, this.data);
        this.platform.init(options.platform);
        this.config.init(options.config, this.data, this.platform);
        this.session.init(options.session);
        this.screen.init(options.screen, this.platform);
        this.user.init(this.platform, this.data);
        this.redDot.init(this.data, options.redDot);
        this.resource.init(options.resource);
        this.analytics.init(options.analytics, this.data, this.platform, this.session);
        this.ad.init(this.config.createAdInitConfig(options.ad), this.platform, this.analytics, this.session);
        this.sdk.init(options.sdk, this.data, this.platform, this.ad, this.session, this.config, this.screen);
        this.reward.init(options.reward, this.data, this.sdk, this.config, this.analytics, this.session);
        this.ui.setEventBus(this.event);
        this.ui.setStore(this.store);

        if (options.uiRoot) {
            this.ui.init(options.uiRoot, options.ui);
            this.transition.init(this.ui);
        }

        this.initialized = true;
        this.event.emitHInit();
    }

    public static isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * 切后台、关键奖励、重要结算时可以手动调用，强制保存所有脏数据。
     */
    public static flush(): void {
        this.store.flushDirty();
        this.data.flush();
    }
}
