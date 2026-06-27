import { sys } from 'cc';
import type {
    HLocationInfo,
    HLoginResult,
    HPlatformInitOptions,
    HPlatformType,
    HResolvedPlatform,
    HSettingResult,
    HSystemInfo,
    HUserProfile,
} from '../../HTypes';
import {
    HDouyinPlatformAdapter,
    HMockPlatformAdapter,
    HPlatformAdapter,
    HWechatPlatformAdapter,
} from './HPlatformAdapters';

/**
 * HPlatformFacade 负责识别当前运行平台，并把登录、授权、用户信息、系统信息转给对应 adapter。
 * HSDKFacade/HAdFacade/HScreenFacade 都依赖这里的 platform 结果。
 */
export class HPlatformFacade {
    private platform: HResolvedPlatform = 'unknown';
    private adapter: HPlatformAdapter = new HMockPlatformAdapter();
    private options: HPlatformInitOptions = {};

    /**
     * 初始化平台层。
     * auto 会根据当前运行环境识别微信、抖音或 Mock，项目强制指定平台时可传 platform。
     */
    public init(options: HPlatformInitOptions = {}): void {
        this.options = options;
        this.platform = this.detect(options.platform || 'auto');
        this.adapter = this.createAdapter(this.platform);

        if (options.debug) {
            console.log('[HPlatformFacade] platform:', this.platform);
        }
    }

    public getPlatform(): HResolvedPlatform {
        return this.platform === 'unknown' ? this.detect(this.options.platform || 'auto') : this.platform;
    }

    public isWechat(): boolean {
        return this.getPlatform() === 'wechat';
    }

    public isDouyin(): boolean {
        return this.getPlatform() === 'douyin';
    }

    public is4399(): boolean {
        return this.getPlatform() === '4399';
    }

    public isWeb(): boolean {
        return this.getPlatform() === 'web';
    }

    public isMock(): boolean {
        return this.getPlatform() === 'mock';
    }

    // 以下接口只做统一转发，具体 wx/tt callback 包装在 HPlatformAdapters。
    public login(): Promise<HLoginResult> {
        return this.adapter.login();
    }

    public getSetting(): Promise<HSettingResult> {
        return this.adapter.getSetting();
    }

    public authorize(scope: string): Promise<boolean> {
        return this.adapter.authorize(scope);
    }

    public openSetting(): Promise<HSettingResult> {
        return this.adapter.openSetting();
    }

    /**
     * 获取头像昵称。微信/抖音平台通常要求由用户点击行为触发。
     */
    public getUserProfile(desc?: string): Promise<HUserProfile> {
        return this.adapter.getUserProfile(desc);
    }

    public getLocation(type?: string): Promise<HLocationInfo> {
        return this.adapter.getLocation(type);
    }

    public getSystemInfo(): Promise<HSystemInfo> {
        return this.adapter.getSystemInfo();
    }

    // 平台识别集中在这里。新增渠道时先扩展 HResolvedPlatform，再补 detect/createAdapter。
    private detect(platform: HPlatformType): HResolvedPlatform {
        if (platform === 'wechat' || platform === 'douyin' || platform === '4399' || platform === 'web' || platform === 'mock') {
            return platform;
        }

        const g = globalThis as any;
        if (g.wx?.createRewardedVideoAd || sys.platform === sys.Platform.WECHAT_GAME) {
            return 'wechat';
        }

        if (g.tt?.createRewardedVideoAd || g.tt?.login) {
            return 'douyin';
        }

        // 在浏览器（Cocos Creator preview / browser）环境下识别为 web
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            return 'web';
        }

        return 'mock';
    }

    // 未接入真实 adapter 的平台统一降级 Mock，保证框架 Loading 流程不中断。
    private createAdapter(platform: HResolvedPlatform): HPlatformAdapter {
        if (platform === 'wechat') {
            return new HWechatPlatformAdapter();
        }
        if (platform === 'douyin') {
            return new HDouyinPlatformAdapter();
        }
        return new HMockPlatformAdapter(platform);
    }
}
