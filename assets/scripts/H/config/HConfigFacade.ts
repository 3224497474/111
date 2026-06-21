import type { HDataStore } from '../data/HDataStore';
import type {
    HAdIds,
    HAdInitConfig,
    HAdPlatformIds,
    HAdType,
    HConfigInitOptions,
    HFeatureMap,
    HResolvedPlatform,
    HSDKConfigData,
    HSDKFeature,
    HShareOptions,
} from '../HTypes';
import type { HPlatformFacade } from '../sdk/platform/HPlatformFacade';
import { HDefaultSDKConfig } from './HSDKConfig';

export class HConfigFacade {
    private localConfig: HSDKConfigData = this.clone(HDefaultSDKConfig);
    private remoteConfig: Partial<HSDKConfigData> = {};
    private storageModuleName = 'remoteConfig';
    private dataStore: HDataStore | null = null;
    private platformFacade: HPlatformFacade | null = null;
    private initialized = false;

    public init(options: HConfigInitOptions = {}, dataStore?: HDataStore, platformFacade?: HPlatformFacade): void {
        this.dataStore = dataStore || null;
        this.platformFacade = platformFacade || null;
        this.storageModuleName = options.storageModuleName?.trim() || this.storageModuleName;
        this.localConfig = this.mergeConfig(this.clone(HDefaultSDKConfig), options.local || {});

        if (options.autoLoadLocal !== false) {
            const saved = this.dataStore?.getModule<Partial<HSDKConfigData>>(this.storageModuleName, {});
            this.remoteConfig = this.mergeConfig(saved || {}, options.remote || {});
        } else {
            this.remoteConfig = this.clone(options.remote || {});
        }

        this.initialized = true;
    }

    public getConfig(): HSDKConfigData {
        this.ensureInit();
        return this.mergeConfig(this.localConfig, this.remoteConfig);
    }

    public getPlatformConfig(platform = this.getPlatform()) {
        const config = this.getConfig();
        return config.platforms?.[platform] || {};
    }

    public getAdId(type: HAdType, placement: string, platform = this.getPlatform()): string {
        const ads = this.getPlatformConfig(platform).ads;
        if (type === 'reward') {
            return ads?.reward?.[placement] || '';
        }
        if (type === 'interstitial') {
            return ads?.interstitial?.[placement] || '';
        }
        return ads?.banner?.[placement] || '';
    }

    public getAdIds(): HAdIds {
        const platforms = this.getConfig().platforms || {};
        return {
            wechat: this.clonePlatformAds(platforms.wechat?.ads),
            douyin: this.clonePlatformAds(platforms.douyin?.ads),
            '4399': this.clonePlatformAds(platforms['4399']?.ads),
            web: this.clonePlatformAds(platforms.web?.ads),
            mock: this.clonePlatformAds(platforms.mock?.ads),
        };
    }

    public getShareOptions(key: string): HShareOptions | null {
        this.ensureInit();
        const share = this.getConfig().share?.[key];
        return share ? this.clone(share) : null;
    }

    public getCooldown(key: string, defaultValue = 0): number {
        this.ensureInit();
        const value = this.getConfig().cooldown?.[key];
        return typeof value === 'number' ? Math.max(0, Math.floor(value)) : defaultValue;
    }

    public isFeatureEnabled(key: string, defaultValue = true): boolean {
        this.ensureInit();
        const value = this.getConfig().switches?.[key];
        return typeof value === 'boolean' ? value : defaultValue;
    }

    public getFeatureMap(platform = this.getPlatform()): HFeatureMap {
        const config = this.getConfig();
        return {
            ...(config.features?.[platform] || {}),
            ...(config.platforms?.[platform]?.features || {}),
        };
    }

    public isSDKFeatureEnabled(feature: HSDKFeature, platform = this.getPlatform(), defaultValue = true): boolean {
        const value = this.getFeatureMap(platform)[feature];
        return typeof value === 'boolean' ? value : defaultValue;
    }

    public setSwitch(key: string, enabled: boolean, immediate = true): void {
        this.ensureInit();
        this.remoteConfig = this.mergeConfig(this.remoteConfig, {
            switches: {
                [key]: enabled,
            },
        });
        this.saveRemoteConfig(immediate);
    }

    public mergeRemoteConfig(remote: Partial<HSDKConfigData>, immediate = true): HSDKConfigData {
        this.ensureInit();
        this.remoteConfig = this.mergeConfig(this.remoteConfig, remote);
        this.saveRemoteConfig(immediate);
        return this.getConfig();
    }

    public createAdInitConfig(adConfig: HAdInitConfig = {}): HAdInitConfig {
        const ids = {
            ...this.getAdIds(),
            ...(adConfig.ids || {}),
        };

        return {
            ...adConfig,
            ids,
        };
    }

    private saveRemoteConfig(immediate: boolean): void {
        this.dataStore?.setModule<Partial<HSDKConfigData>>(this.storageModuleName, this.remoteConfig, { immediate });
    }

    private getPlatform(): HResolvedPlatform {
        return this.platformFacade?.getPlatform() || 'mock';
    }

    private clonePlatformAds(ads?: HAdPlatformIds): HAdPlatformIds | undefined {
        return ads ? this.clone(ads) : undefined;
    }

    private mergeConfig<T extends Partial<HSDKConfigData>>(base: T, patch: Partial<HSDKConfigData>): T {
        const merged: HSDKConfigData = {
            ...this.clone(base),
            ...this.clone(patch),
            platforms: {
                ...(base.platforms || {}),
                ...(patch.platforms || {}),
            },
            share: {
                ...(base.share || {}),
                ...(patch.share || {}),
            },
            cooldown: {
                ...(base.cooldown || {}),
                ...(patch.cooldown || {}),
            },
            switches: {
                ...(base.switches || {}),
                ...(patch.switches || {}),
            },
            features: {
                ...(base.features || {}),
                ...(patch.features || {}),
            },
        };

        return merged as T;
    }

    private clone<T>(value: T): T {
        if (value === undefined || value === null) {
            return value;
        }
        return JSON.parse(JSON.stringify(value)) as T;
    }

    private ensureInit(): void {
        if (!this.initialized) {
            this.init();
        }
    }
}
