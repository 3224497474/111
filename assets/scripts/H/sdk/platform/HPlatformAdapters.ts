import type {
    HLocationInfo,
    HLoginResult,
    HResolvedPlatform,
    HSettingResult,
    HSystemInfo,
    HUserProfile,
} from '../../HTypes';

/**
 * 平台基础能力适配接口。
 * 这里覆盖登录、授权、用户资料、定位、系统信息，SDK 和屏幕适配都会复用这些数据。
 */
export interface HPlatformAdapter {
    readonly platform: HResolvedPlatform;
    login(): Promise<HLoginResult>;
    getSetting(): Promise<HSettingResult>;
    authorize(scope: string): Promise<boolean>;
    openSetting(): Promise<HSettingResult>;
    getUserProfile(desc?: string): Promise<HUserProfile>;
    getLocation(type?: string): Promise<HLocationInfo>;
    getSystemInfo(): Promise<HSystemInfo>;
}

/**
 * 微信/抖音平台基础能力的公共实现。
 * 平台 API 大多是 callback 风格，这里统一转成 Promise 并归一化字段。
 */
abstract class HBasePlatformAdapter implements HPlatformAdapter {
    public abstract readonly platform: HResolvedPlatform;

    public abstract getApi(): any;

    // 登录只拿 code/anonymousCode，后续换取 openid/token 应由项目服务端处理。
    public login(): Promise<HLoginResult> {
        const api = this.getApi();
        if (!api?.login) {
            return Promise.resolve({
                ok: false,
                platform: this.platform,
                errorMessage: '当前平台不支持登录',
            });
        }

        return new Promise((resolve) => {
            api.login({
                success: (res: any) => resolve({
                    ok: true,
                    platform: this.platform,
                    code: res?.code,
                    anonymousCode: res?.anonymousCode,
                    raw: res,
                }),
                fail: (err: any) => resolve({
                    ok: false,
                    platform: this.platform,
                    errorMessage: err?.errMsg || '登录失败',
                    raw: err,
                }),
            });
        });
    }

    public getSetting(): Promise<HSettingResult> {
        const api = this.getApi();
        if (!api?.getSetting) {
            return Promise.resolve({
                ok: false,
                platform: this.platform,
                authSetting: {},
            });
        }

        return new Promise((resolve) => {
            api.getSetting({
                success: (res: any) => resolve({
                    ok: true,
                    platform: this.platform,
                    authSetting: res?.authSetting || {},
                    raw: res,
                }),
                fail: (err: any) => resolve({
                    ok: false,
                    platform: this.platform,
                    authSetting: {},
                    raw: err,
                }),
            });
        });
    }

    public authorize(scope: string): Promise<boolean> {
        const api = this.getApi();
        if (!api?.authorize) {
            return Promise.resolve(false);
        }

        return new Promise((resolve) => {
            api.authorize({
                scope,
                success: () => resolve(true),
                fail: () => resolve(false),
            });
        });
    }

    public openSetting(): Promise<HSettingResult> {
        const api = this.getApi();
        if (!api?.openSetting) {
            return this.getSetting();
        }

        return new Promise((resolve) => {
            api.openSetting({
                success: (res: any) => resolve({
                    ok: true,
                    platform: this.platform,
                    authSetting: res?.authSetting || {},
                    raw: res,
                }),
                fail: (err: any) => resolve({
                    ok: false,
                    platform: this.platform,
                    authSetting: {},
                    raw: err,
                }),
            });
        });
    }

    // 头像昵称通常需要用户点击触发，外部调用时要放在按钮事件链路里。
    public getUserProfile(desc = '用于展示玩家头像和昵称'): Promise<HUserProfile> {
        const api = this.getApi();
        if (api?.getUserProfile) {
            return new Promise((resolve, reject) => {
                api.getUserProfile({
                    desc,
                    success: (res: any) => resolve(this.normalizeUserProfile(res)),
                    fail: (err: any) => reject(err),
                });
            });
        }

        if (api?.getUserInfo) {
            return new Promise((resolve, reject) => {
                api.getUserInfo({
                    success: (res: any) => resolve(this.normalizeUserProfile(res)),
                    fail: (err: any) => reject(err),
                });
            });
        }

        return Promise.resolve(this.getEmptyProfile(false));
    }

    public getLocation(type = 'wgs84'): Promise<HLocationInfo> {
        const api = this.getApi();
        if (!api?.getLocation) {
            return Promise.resolve({
                authorized: false,
                platform: this.platform,
            });
        }

        return new Promise((resolve, reject) => {
            api.getLocation({
                type,
                success: (res: any) => resolve({
                    authorized: true,
                    platform: this.platform,
                    latitude: res?.latitude,
                    longitude: res?.longitude,
                    speed: res?.speed,
                    accuracy: res?.accuracy,
                    city: res?.city,
                    province: res?.province,
                    country: res?.country,
                    raw: res,
                }),
                fail: (err: any) => reject(err),
            });
        });
    }

    // 优先同步接口，失败后降级异步接口；最终都归一化为 HSystemInfo。
    public getSystemInfo(): Promise<HSystemInfo> {
        const api = this.getApi();
        if (api?.getSystemInfoSync) {
            try {
                return Promise.resolve(this.normalizeSystemInfo(api.getSystemInfoSync()));
            } catch {
                // 继续走异步接口。
            }
        }

        if (!api?.getSystemInfo) {
            return Promise.resolve({
                platform: this.platform,
            });
        }

        return new Promise((resolve) => {
            api.getSystemInfo({
                success: (res: any) => resolve(this.normalizeSystemInfo(res)),
                fail: () => resolve({ platform: this.platform }),
            });
        });
    }

    // 归一化平台返回，避免业务直接依赖 wx/tt 原始字段。
    protected normalizeUserProfile(res: any): HUserProfile {
        const userInfo = res?.userInfo || res || {};
        return {
            authorized: true,
            platform: this.platform,
            nickName: userInfo.nickName || '',
            avatarUrl: userInfo.avatarUrl || '',
            city: userInfo.city,
            province: userInfo.province,
            country: userInfo.country,
            gender: userInfo.gender,
            raw: res,
        };
    }

    protected getEmptyProfile(authorized: boolean): HUserProfile {
        return {
            authorized,
            platform: this.platform,
            nickName: '',
            avatarUrl: '',
        };
    }

    protected normalizeSystemInfo(res: any): HSystemInfo {
        return {
            platform: this.platform,
            brand: res?.brand,
            model: res?.model,
            system: res?.system,
            version: res?.version,
            SDKVersion: res?.SDKVersion,
            pixelRatio: res?.pixelRatio,
            screenWidth: res?.screenWidth,
            screenHeight: res?.screenHeight,
            windowWidth: res?.windowWidth,
            windowHeight: res?.windowHeight,
            statusBarHeight: res?.statusBarHeight,
            safeArea: res?.safeArea
                ? {
                    left: res.safeArea.left || 0,
                    right: res.safeArea.right || 0,
                    top: res.safeArea.top || 0,
                    bottom: res.safeArea.bottom || 0,
                    width: res.safeArea.width || 0,
                    height: res.safeArea.height || 0,
                }
                : undefined,
            raw: res,
        };
    }
}

// 微信平台基础能力 adapter：调用全局 wx。
export class HWechatPlatformAdapter extends HBasePlatformAdapter {
    public readonly platform = 'wechat' as const;

    public getApi(): any {
        return (globalThis as any).wx;
    }
}

// 抖音平台基础能力 adapter：调用全局 tt。
export class HDouyinPlatformAdapter extends HBasePlatformAdapter {
    public readonly platform = 'douyin' as const;

    public getApi(): any {
        return (globalThis as any).tt;
    }
}

/**
 * Mock 平台 adapter。
 * 本地、Web 或未知平台会走这里，返回稳定假数据，保证框架流程可测试。
 */
export class HMockPlatformAdapter implements HPlatformAdapter {
    public readonly platform: HResolvedPlatform;

    public constructor(platform: HResolvedPlatform = 'mock') {
        this.platform = platform === 'unknown' ? 'mock' : platform;
    }

    public login(): Promise<HLoginResult> {
        return Promise.resolve({
            ok: true,
            platform: this.platform,
            code: `${this.platform}-login-code`,
        });
    }

    public getSetting(): Promise<HSettingResult> {
        return Promise.resolve({
            ok: true,
            platform: this.platform,
            authSetting: {
                'scope.userInfo': true,
                'scope.userLocation': true,
            },
        });
    }

    public authorize(_scope: string): Promise<boolean> {
        return Promise.resolve(true);
    }

    public openSetting(): Promise<HSettingResult> {
        return this.getSetting();
    }

    public getUserProfile(): Promise<HUserProfile> {
        return Promise.resolve({
            authorized: true,
            platform: this.platform,
            nickName: 'Mock玩家',
            avatarUrl: '',
            city: 'MockCity',
            province: 'MockProvince',
            country: 'MockCountry',
        });
    }

    public getLocation(): Promise<HLocationInfo> {
        return Promise.resolve({
            authorized: true,
            platform: this.platform,
            latitude: 31.2304,
            longitude: 121.4737,
            city: 'MockCity',
            province: 'MockProvince',
            country: 'MockCountry',
        });
    }

    public getSystemInfo(): Promise<HSystemInfo> {
        return Promise.resolve({
            platform: this.platform,
            brand: 'Mock',
            model: 'MockDevice',
            system: 'MockOS',
            pixelRatio: 2,
            screenWidth: 750,
            screenHeight: 1334,
            windowWidth: 750,
            windowHeight: 1334,
            statusBarHeight: 0,
            safeArea: {
                left: 0,
                right: 750,
                top: 0,
                bottom: 1334,
                width: 750,
                height: 1334,
            },
        });
    }
}
