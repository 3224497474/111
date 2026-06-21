import type { HDataStore } from '../data/HDataStore';
import type { HPlatformFacade } from '../sdk/platform/HPlatformFacade';
import type { HLocationInfo, HUserProfile } from '../HTypes';

interface HUserSaveData {
    profile: HUserProfile | null;
    location: HLocationInfo | null;
}

export class HUserFacade {
    private platform: HPlatformFacade | null = null;
    private dataStore: HDataStore | null = null;
    private profile: HUserProfile | null = null;
    private location: HLocationInfo | null = null;

    public init(platform: HPlatformFacade, dataStore: HDataStore): void {
        this.platform = platform;
        this.dataStore = dataStore;

        const saved = dataStore.getModule<HUserSaveData>('user', {
            profile: null,
            location: null,
        });
        this.profile = saved.profile;
        this.location = saved.location;
    }

    public getProfile(): HUserProfile | null {
        return this.profile ? { ...this.profile } : null;
    }

    public getNickName(defaultName = '游客'): string {
        return this.profile?.nickName || defaultName;
    }

    public getAvatarUrl(): string {
        return this.profile?.avatarUrl || '';
    }

    public getLocationSnapshot(): HLocationInfo | null {
        return this.location ? { ...this.location } : null;
    }

    public getDisplayInfo(): { nickName: string; avatarUrl: string; city?: string; province?: string; country?: string } {
        return {
            nickName: this.getNickName(),
            avatarUrl: this.getAvatarUrl(),
            city: this.profile?.city || this.location?.city,
            province: this.profile?.province || this.location?.province,
            country: this.profile?.country || this.location?.country,
        };
    }

    /**
     * 请求头像昵称。真实平台建议只在玩家点击按钮时调用。
     */
    public async requestProfileByUserTap(desc = '用于展示玩家头像和昵称'): Promise<HUserProfile> {
        this.ensureInit();
        try {
            const profile = await this.platform!.getUserProfile(desc);
            this.profile = profile;
            this.save();
            return { ...profile };
        } catch (error: any) {
            const fallback: HUserProfile = {
                authorized: false,
                platform: this.platform!.getPlatform(),
                nickName: '',
                avatarUrl: '',
                raw: error,
            };
            this.profile = fallback;
            this.save();
            return { ...fallback };
        }
    }

    /**
     * 请求定位信息。只有确实需要经纬度或地区榜时再调用。
     */
    public async requestLocation(type = 'wgs84'): Promise<HLocationInfo> {
        this.ensureInit();
        try {
            const location = await this.platform!.getLocation(type);
            this.location = location;
            this.save();
            return { ...location };
        } catch (error: any) {
            const fallback: HLocationInfo = {
                authorized: false,
                platform: this.platform!.getPlatform(),
                raw: error,
            };
            this.location = fallback;
            this.save();
            return { ...fallback };
        }
    }

    public clear(): void {
        this.profile = null;
        this.location = null;
        this.save(true);
    }

    private save(immediate = false): void {
        this.dataStore?.setModule<HUserSaveData>('user', {
            profile: this.profile ? this.cloneProfileForSave(this.profile) : null,
            location: this.location ? this.cloneLocationForSave(this.location) : null,
        }, { immediate });
    }

    private cloneProfileForSave(profile: HUserProfile): HUserProfile {
        return {
            authorized: profile.authorized,
            platform: profile.platform,
            nickName: profile.nickName,
            avatarUrl: profile.avatarUrl,
            city: profile.city,
            province: profile.province,
            country: profile.country,
            gender: profile.gender,
        };
    }

    private cloneLocationForSave(location: HLocationInfo): HLocationInfo {
        return {
            authorized: location.authorized,
            platform: location.platform,
            latitude: location.latitude,
            longitude: location.longitude,
            speed: location.speed,
            accuracy: location.accuracy,
            city: location.city,
            province: location.province,
            country: location.country,
        };
    }

    private ensureInit(): void {
        if (!this.platform || !this.dataStore) {
            throw new Error('[HUserFacade] 请先调用 H.init');
        }
    }
}
