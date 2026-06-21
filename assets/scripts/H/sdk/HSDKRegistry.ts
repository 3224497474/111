import type { HResolvedPlatform } from '../HTypes';
import { HDySDK } from './HDySDK';
import { HMockSDK } from './HMockSDK';
import type { HMiniGameSDKAdapter } from './HSDKAdapter';
import { HWxSDK } from './HWxSDK';

export type HSDKAdapterFactory = (platform: HResolvedPlatform) => HMiniGameSDKAdapter;
export type HSDKAdapterConstructor = new () => HMiniGameSDKAdapter;

/**
 * SDK adapter 注册中心。
 * HSDKFacade 不硬编码某个平台类，而是根据当前 platform 从这里创建 adapter。
 */
export class HSDKRegistry {
    private readonly factories: Partial<Record<HResolvedPlatform, HSDKAdapterFactory>> = {};
    private fallbackFactory: HSDKAdapterFactory = (platform) => new HMockSDK(platform);

    // 注册指定平台的工厂函数，适合需要传入构造参数的渠道。
    public register(platform: HResolvedPlatform, factory: HSDKAdapterFactory): this {
        this.factories[platform] = factory;
        return this;
    }

    // 注册无参 adapter 类，类里的 platform 字段会作为注册 key。
    public registerAdapterClass(AdapterClass: HSDKAdapterConstructor): this {
        const adapter = new AdapterClass();
        this.factories[adapter.platform] = () => new AdapterClass();
        return this;
    }

    public unregister(platform: HResolvedPlatform): this {
        delete this.factories[platform];
        return this;
    }

    public setFallback(factory: HSDKAdapterFactory): this {
        this.fallbackFactory = factory;
        return this;
    }

    public has(platform: HResolvedPlatform): boolean {
        return !!this.factories[platform];
    }

    public create(platform: HResolvedPlatform): HMiniGameSDKAdapter {
        const factory = this.factories[platform] || this.fallbackFactory;
        return factory(platform);
    }

    public getRegisteredPlatforms(): HResolvedPlatform[] {
        return Object.keys(this.factories) as HResolvedPlatform[];
    }
}

// 默认内置微信、抖音和 Mock；新增渠道可以在 Loading 阶段继续 registerAdapter/registerAdapterClass。
export const HDefaultSDKRegistry = new HSDKRegistry()
    .registerAdapterClass(HWxSDK)
    .registerAdapterClass(HDySDK)
    .registerAdapterClass(HMockSDK);
