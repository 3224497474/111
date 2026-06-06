import { GameStorage } from './gameStorage';

export type PlayerProfileSource = 'guest' | 'wechat';

export type PlayerProfileData = {
    nickname: string;
    avatarUrl: string;
    source: PlayerProfileSource;
    authorized: boolean;
    promptDismissed: boolean;
    updatedAt: number;
};

const PROFILE_STORAGE_KEY = 'player_profile_data';

export class PlayerProfileManager {
    private static instance: PlayerProfileManager | null = null;

    public static getInstance() {
        if (!this.instance) {
            this.instance = new PlayerProfileManager();
        }
        return this.instance;
    }

    public getProfile(): PlayerProfileData {
        const cached = this.readStoredProfile();
        const fallbackNickname = this.buildFallbackNickname();

        return {
            nickname: cached?.nickname?.trim() || fallbackNickname,
            avatarUrl: cached?.avatarUrl?.trim() || '',
            source: cached?.source === 'wechat' ? 'wechat' : 'guest',
            authorized: Boolean(cached?.authorized),
            promptDismissed: Boolean(cached?.promptDismissed),
            updatedAt: Number(cached?.updatedAt || 0),
        };
    }

    public saveProfile(profile: Partial<PlayerProfileData>) {
        const current = this.getProfile();
        const nextProfile: PlayerProfileData = {
            ...current,
            ...profile,
            nickname: String(profile.nickname ?? current.nickname ?? '').trim() || this.buildFallbackNickname(),
            avatarUrl: String(profile.avatarUrl ?? current.avatarUrl ?? '').trim(),
            source: profile.source === 'wechat' ? 'wechat' : current.source,
            authorized: profile.authorized ?? current.authorized,
            promptDismissed: profile.promptDismissed ?? current.promptDismissed,
            updatedAt: Number(profile.updatedAt ?? Date.now()),
        };

        GameStorage.setStringDisk(PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
        return nextProfile;
    }

    public markPromptDismissed() {
        return this.saveProfile({
            promptDismissed: true,
        });
    }

    public needsInitialPrompt() {
        const profile = this.getProfile();
        return !profile.authorized && !profile.promptDismissed;
    }

    public getInitial(name?: string) {
        const target = String(name ?? this.getProfile().nickname ?? '').trim();
        if (!target) {
            return '游';
        }
        return target.slice(0, 1).toUpperCase();
    }

    public canUseWechatProfile() {
        const wxApi = (globalThis as any).wx;
        return Boolean(wxApi && typeof wxApi.getUserProfile === 'function');
    }

    public async requestWechatProfile() {
        const wxApi = (globalThis as any).wx;
        if (!wxApi || typeof wxApi.getUserProfile !== 'function') {
            throw new Error('当前环境不支持微信资料授权');
        }

        const result = await new Promise<any>((resolve, reject) => {
            wxApi.getUserProfile({
                desc: '用于在设置界面展示你的头像和昵称',
                success: (response: any) => resolve(response),
                fail: (error: any) => reject(error),
            });
        });

        const userInfo = result?.userInfo ?? result ?? {};
        const nickname = String(userInfo.nickName ?? '').trim();
        const avatarUrl = String(userInfo.avatarUrl ?? '').trim();

        return this.saveProfile({
            nickname: nickname || this.buildFallbackNickname(),
            avatarUrl,
            source: 'wechat',
            authorized: true,
            promptDismissed: true,
        });
    }

    private readStoredProfile(): Partial<PlayerProfileData> | null {
        const raw = GameStorage.getStringDisk(PROFILE_STORAGE_KEY, '');
        if (!raw) {
            return null;
        }

        try {
            return JSON.parse(raw);
        } catch (_error) {
            return null;
        }
    }

    private buildFallbackNickname() {
        const roleName = GameStorage.getString('roleName', '').trim();
        if (roleName) {
            return roleName;
        }

        const uid = GameStorage.getStringDisk('auth_uid', '').trim();
        if (uid) {
            return `玩家${uid.slice(-4)}`;
        }

        return '游客';
    }
}

export const playerProfileManager = PlayerProfileManager.getInstance();
