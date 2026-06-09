import type { HInitOptions } from './HTypes';
import { HAdFacade } from './ad/HAdFacade';
import { HEventBus } from './core/HEventBus';
import { HDataStore } from './data/HDataStore';
import { HPlatformFacade } from './platform/HPlatformFacade';
import { HRedDotFacade } from './redDot/HRedDotFacade';
import { HResourceFacade } from './resource/HResourceFacade';
import { HTransitionFacade } from './transition/HTransitionFacade';
import { HUIFacade } from './ui/HUIFacade';
import { HUserFacade } from './user/HUserFacade';

export class H {
    public static readonly event = new HEventBus();
    public static readonly data = new HDataStore();
    public static readonly ui = new HUIFacade();
    public static readonly redDot = new HRedDotFacade();
    public static readonly resource = new HResourceFacade();
    public static readonly transition = new HTransitionFacade();
    public static readonly platform = new HPlatformFacade();
    public static readonly user = new HUserFacade();
    public static readonly ad = new HAdFacade();

    private static initialized = false;

    /**
     * H 框架总入口。建议在游戏启动阶段调用一次。
     */
    public static init(options: HInitOptions = {}): void {
        this.data.init(options.data);
        this.platform.init(options.platform);
        this.user.init(this.platform, this.data);
        this.redDot.init(this.data, options.redDot);
        this.resource.init(options.resource);
        this.ad.init(options.ad, this.platform);

        if (options.uiRoot) {
            this.ui.init(options.uiRoot, options.ui);
            this.transition.init(this.ui);
        }

        this.initialized = true;
        this.event.emit('h:init');
    }

    public static isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * 切后台、关键奖励、重要结算时可以手动调用，强制保存所有脏数据。
     */
    public static flush(): void {
        this.data.flush();
    }
}
