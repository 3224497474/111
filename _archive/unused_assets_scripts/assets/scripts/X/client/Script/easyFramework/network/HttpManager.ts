import { GameServerConfig } from "./conf";

/**
 * HTTP 请求管理器
 * 用于与游戏服务器进行 REST API 通信。
 * 微信小游戏环境下优先走 wx.cloud.callContainer，其他环境回退到普通 HTTPS 请求。
 */
export class HttpManager {
    private static instance: HttpManager = null!;
    private baseUrl: string = GameServerConfig.baseUrl;
    private token: string = '';
    private cloudInitialized = false;

    public static getInstance(): HttpManager {
        if (!this.instance) {
            this.instance = new HttpManager();
        }
        return this.instance;
    }

    /**
     * 设置认证 Token
     */
    public setToken(token: string) {
        this.token = token;
        console.log('[HttpManager] Token 已设置');
    }

    /**
     * 获取 Token
     */
    public getToken(): string {
        return this.token;
    }

    /**
     * 设置服务器地址
     */
    public setBaseUrl(url: string) {
        this.baseUrl = url;
    }

    /**
     * 发送 GET 请求
     */
    public async get(url: string, needAuth: boolean = true): Promise<any> {
        return await this.request('GET', url, undefined, needAuth);
    }

    /**
     * 发送 POST 请求
     */
    public async post(url: string, body: any, needAuth: boolean = true): Promise<any> {
        return await this.request('POST', url, body, needAuth);
    }

    /**
     * 发送 PUT 请求
     */
    public async put(url: string, body: any, needAuth: boolean = true): Promise<any> {
        return await this.request('PUT', url, body, needAuth);
    }

    private async request(method: string, url: string, body?: any, needAuth: boolean = true): Promise<any> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (needAuth && this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        try {
            if (this.canUseCloudContainer()) {
                return await this.requestByCloudContainer(method, url, headers, body);
            }

            if (typeof fetch === 'function') {
                return await this.requestByFetch(method, url, headers, body);
            }

            return await this.requestByXhr(method, url, headers, body);
        } catch (error) {
            console.error(`[HttpManager] ${method} 请求失败:`, error);
            throw error;
        }
    }

    private canUseCloudContainer(): boolean {
        const wxApi = (globalThis as any).wx;
        return Boolean(
            GameServerConfig.preferCloudContainer &&
            GameServerConfig.cloudEnv &&
            GameServerConfig.cloudService &&
            wxApi?.cloud &&
            typeof wxApi.cloud.callContainer === 'function',
        );
    }

    private ensureCloudInitialized() {
        if (this.cloudInitialized) {
            return;
        }

        const wxApi = (globalThis as any).wx;
        if (!wxApi?.cloud) {
            return;
        }

        if (typeof wxApi.cloud.init === 'function') {
            wxApi.cloud.init({
                env: GameServerConfig.cloudEnv,
                traceUser: true,
            });
        }

        this.cloudInitialized = true;
    }

    private async requestByCloudContainer(
        method: string,
        url: string,
        headers: Record<string, string>,
        body?: any,
    ): Promise<any> {
        this.ensureCloudInitialized();

        const wxApi = (globalThis as any).wx;
        const response = await wxApi.cloud.callContainer({
            config: {
                env: GameServerConfig.cloudEnv,
            },
            path: url,
            method,
            header: {
                ...headers,
                'X-WX-SERVICE': GameServerConfig.cloudService,
            },
            data: body,
        });

        const statusCode = Number(response?.statusCode ?? 200);
        const data = this.parseResponsePayload(response?.data);

        if (statusCode === 404) {
            return {
                success: false,
                error: '数据不存在',
                status: 404,
            };
        }

        if (statusCode < 200 || statusCode >= 300) {
            throw new Error(this.extractErrorMessage(data, `${method} ${url} 失败`));
        }

        return data;
    }

    private async requestByFetch(
        method: string,
        url: string,
        headers: Record<string, string>,
        body?: any,
    ): Promise<any> {
        const response = await fetch(`${this.baseUrl}${url}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });

        if (response.status === 404) {
            return {
                success: false,
                error: '数据不存在',
                status: 404,
            };
        }

        const rawText = await response.text();
        const data = this.parseResponsePayload(rawText);
        if (!response.ok) {
            throw new Error(this.extractErrorMessage(data, `${method} ${url} 失败`));
        }
        return data;
    }

    private async requestByXhr(
        method: string,
        url: string,
        headers: Record<string, string>,
        body?: any,
    ): Promise<any> {
        return await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, `${this.baseUrl}${url}`, true);

            Object.keys(headers).forEach((key) => {
                xhr.setRequestHeader(key, headers[key]);
            });

            xhr.onreadystatechange = () => {
                if (xhr.readyState !== 4) {
                    return;
                }

                if (xhr.status === 404) {
                    resolve({
                        success: false,
                        error: '数据不存在',
                        status: 404,
                    });
                    return;
                }

                const data = this.parseResponsePayload(xhr.responseText || '{}');
                if (xhr.status < 200 || xhr.status >= 300) {
                    reject(new Error(this.extractErrorMessage(data, `${method} ${url} 失败`)));
                    return;
                }

                resolve(data);
            };

            xhr.onerror = () => {
                reject(new Error(`${method} ${url} 网络异常`));
            };

            xhr.send(body === undefined ? null : JSON.stringify(body));
        });
    }

    private parseResponsePayload(payload: any) {
        if (payload === undefined || payload === null || payload === '') {
            return {};
        }

        if (typeof payload === 'string') {
            try {
                return JSON.parse(payload);
            } catch (_error) {
                return {
                    message: payload,
                };
            }
        }

        return payload;
    }

    private extractErrorMessage(payload: any, fallback: string): string {
        if (!payload) {
            return fallback;
        }

        if (typeof payload === 'string') {
            return payload;
        }

        if (payload.message) {
            return String(payload.message);
        }

        if (payload.error) {
            return String(payload.error);
        }

        return fallback;
    }

    // ==================== 游戏 API 封装 ====================

    /**
     * 用户注册
     */
    public async register(username: string, password: string, nickname: string): Promise<any> {
        const data = await this.post('/api/auth/register', {
            username,
            password,
            nickname,
        }, false);

        if (data.success && data.data.token) {
            this.setToken(data.data.token);
        }

        return data;
    }

    /**
     * 用户登录
     */
    public async login(username: string, password: string): Promise<any> {
        const data = await this.post('/api/auth/login', {
            username,
            password,
        }, false);

        if (data.success && data.data.token) {
            this.setToken(data.data.token);
        }

        return data;
    }

    /**
     * 微信小游戏静默登录
     */
    public async wechatLogin(code: string): Promise<any> {
        const data = await this.post('/api/auth/wechat-login', {
            code,
        }, false);

        if (data.success && data.data.token) {
            this.setToken(data.data.token);
        }

        return data;
    }

    /**
     * 校验当前登录态
     */
    public async getAuthMe(): Promise<any> {
        return await this.get('/api/auth/me');
    }

    /**
     * 获取用户信息
     */
    public async getUserInfo(): Promise<any> {
        return await this.get('/api/user/info');
    }

    /**
     * 更新用户信息
     */
    public async updateUserInfo(nickname?: string, avatar?: string): Promise<any> {
        const body: any = {};
        if (nickname) body.nickname = nickname;
        if (avatar) body.avatar = avatar;
        return await this.put('/api/user/info', body);
    }

    /**
     * 更新用户资源
     */
    public async updateResources(coins?: number, diamonds?: number, power?: number, exp?: number): Promise<any> {
        const body: any = {};
        if (coins !== undefined) body.coins = coins;
        if (diamonds !== undefined) body.diamonds = diamonds;
        if (power !== undefined) body.power = power;
        if (exp !== undefined) body.exp = exp;
        return await this.post('/api/user/resources', body);
    }

    /**
     * 保存游戏数据
     */
    public async saveGameData(dataKey: string, dataValue: any): Promise<any> {
        return await this.post('/api/game/save', {
            dataKey,
            dataValue,
        });
    }

    /**
     * 读取游戏数据
     */
    public async loadGameData(dataKey?: string): Promise<any> {
        const url = dataKey ? `/api/game/load?dataKey=${dataKey}` : '/api/game/load';
        return await this.get(url);
    }

    /**
     * 更新排行榜分数
     */
    public async updateLeaderboard(score: number): Promise<any> {
        return await this.post('/api/leaderboard/update', { score });
    }

    /**
     * 获取排行榜
     */
    public async getLeaderboard(limit: number = 100): Promise<any> {
        return await this.get(`/api/leaderboard?limit=${limit}`, false);
    }

    /**
     * 健康检查
     */
    public async healthCheck(): Promise<any> {
        return await this.get('/api/health', false);
    }
}

// 导出单例实例
export const httpManager = HttpManager.getInstance();
export default HttpManager;
