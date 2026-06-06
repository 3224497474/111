import { GameStorage } from "../mgr/gameStorage";
import HttpManager from "./HttpManager";
import { GameServerConfig } from "./conf";

export type WechatAuthSession = {
    uid: string;
    token: string;
    openid: string;
    restored: boolean;
};

export class WechatAuthManager {
    private static instance: WechatAuthManager | null = null;
    private readonly httpManager: HttpManager;

    public static getInstance() {
        if (!this.instance) {
            this.instance = new WechatAuthManager();
        }
        return this.instance;
    }

    private constructor() {
        this.httpManager = HttpManager.getInstance();
    }

    public async ensureAuthenticated(): Promise<WechatAuthSession> {
        this.httpManager.setBaseUrl(GameServerConfig.baseUrl);

        const cachedUid = GameStorage.getStringDisk('auth_uid', '');
        const cachedToken = GameStorage.getStringDisk('auth_token', '');
        const cachedOpenid = GameStorage.getStringDisk('auth_openid', '');

        if (cachedUid && cachedToken) {
            this.httpManager.setToken(cachedToken);

            try {
                const me = await this.httpManager.getAuthMe();
                if (me?.success && me.data?.uid) {
                    const session = {
                        uid: String(me.data.uid),
                        token: cachedToken,
                        openid: String(me.data.openid ?? cachedOpenid ?? ''),
                        restored: true,
                    };
                    this.applySession(session);
                    return session;
                }
            } catch (error) {
                console.warn('[WechatAuthManager] 本地登录态校验失败，将重新登录:', error);
            }
        }

        this.clearCachedSession();

        const code = await this.requestWechatCode();
        const loginResult = await this.httpManager.wechatLogin(code);

        if (!loginResult?.success || !loginResult?.data?.uid || !loginResult?.data?.token) {
            throw new Error(loginResult?.message ?? loginResult?.error ?? '微信登录失败');
        }

        const session = {
            uid: String(loginResult.data.uid),
            token: String(loginResult.data.token),
            openid: String(loginResult.data.openid ?? ''),
            restored: false,
        };

        this.applySession(session);
        return session;
    }

    public clearCachedSession() {
        GameStorage.setStringDisk('auth_uid', '');
        GameStorage.setStringDisk('auth_token', '');
        GameStorage.setStringDisk('auth_openid', '');
        GameStorage.setActiveUserScope('');
        this.httpManager.setToken('');
    }

    private applySession(session: WechatAuthSession) {
        GameStorage.setStringDisk('auth_uid', session.uid);
        GameStorage.setStringDisk('auth_token', session.token);
        GameStorage.setStringDisk('auth_openid', session.openid);
        GameStorage.setActiveUserScope(session.uid);
        this.httpManager.setToken(session.token);
    }

    private async requestWechatCode(): Promise<string> {
        const wxApi = (globalThis as any).wx;
        if (!wxApi || typeof wxApi.login !== 'function') {
            throw new Error('当前环境不支持微信登录');
        }

        return await new Promise<string>((resolve, reject) => {
            wxApi.login({
                success: (result: { code?: string; errMsg?: string }) => {
                    if (result?.code) {
                        resolve(result.code);
                        return;
                    }
                    reject(new Error(result?.errMsg ?? '微信登录未返回 code'));
                },
                fail: (error: { errMsg?: string }) => {
                    reject(new Error(error?.errMsg ?? '微信登录失败'));
                },
            });
        });
    }
}

export const wechatAuthManager = WechatAuthManager.getInstance();
