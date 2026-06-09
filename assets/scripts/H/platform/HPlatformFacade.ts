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
} from '../HTypes';
import {
    HDouyinPlatformAdapter,
    HMockPlatformAdapter,
    HPlatformAdapter,
    HWechatPlatformAdapter,
} from './HPlatformAdapters';

export class HPlatformFacade {
    private platform: HResolvedPlatform = 'unknown';
    private adapter: HPlatformAdapter = new HMockPlatformAdapter();
    private options: HPlatformInitOptions = {};

    /**
     * 初始化平台层。auto 会根据当前运行环境识别微信、抖音或 Mock。
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

    public isMock(): boolean {
        return this.getPlatform() === 'mock';
    }

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

    private detect(platform: HPlatformType): HResolvedPlatform {
        if (platform === 'wechat' || platform === 'douyin' || platform === 'mock') {
            return platform;
        }

        const g = globalThis as any;
        if (g.wx?.createRewardedVideoAd || sys.platform === sys.Platform.WECHAT_GAME) {
            return 'wechat';
        }

        if (g.tt?.createRewardedVideoAd || g.tt?.login) {
            return 'douyin';
        }

        return 'mock';
    }

    private createAdapter(platform: HResolvedPlatform): HPlatformAdapter {
        if (platform === 'wechat') {
            return new HWechatPlatformAdapter();
        }
        if (platform === 'douyin') {
            return new HDouyinPlatformAdapter();
        }
        return new HMockPlatformAdapter();
    }
}
