/**
 * 游戏数据同步管理器
 * 负责本地存储和服务器数据之间的同步。
 */

import { GameStorage } from "../mgr/gameStorage";
import { HttpManager } from "./HttpManager";
import { GameServerConfig } from "./conf";

export class GameDataSync {
    private static instance: GameDataSync = null!;
    private httpManager: HttpManager;
    private isServerEnabled: boolean = GameServerConfig.enabled;
    private syncInterval: number = 30000; // 30 秒自动同步一次
    private syncTimer: any = null;

    public static getInstance(): GameDataSync {
        if (!this.instance) {
            this.instance = new GameDataSync();
        }
        return this.instance;
    }

    constructor() {
        this.httpManager = HttpManager.getInstance();
    }

    /**
     * 初始化数据同步
     */
    public async init() {
        if (!this.isServerEnabled) {
            console.log('[GameDataSync] 服务器功能未启用，使用本地存储');
            return;
        }

        try {
            const health = await this.httpManager.healthCheck();
            console.log('[GameDataSync] 服务器连接成功:', health.message);

            const autoLoginSuccess = await this.autoLogin();

            if (autoLoginSuccess) {
                // 仅在已有有效登录态时启动自动同步，避免未登录状态下持续空转。
                this.startAutoSync();
            } else {
                console.log('[GameDataSync] 未检测到有效登录态，已跳过游客账号创建');
            }
        } catch (error) {
            console.warn('[GameDataSync] 服务器连接失败，将使用本地存储:', error);
            this.isServerEnabled = false;
        }
    }

    /**
     * 启动自动同步
     */
    private startAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }

        this.syncTimer = setInterval(() => {
            this.syncToServer();
        }, this.syncInterval);

        console.log('[GameDataSync] 自动同步已启动');
    }

    /**
     * 停止自动同步
     */
    public stopAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            console.log('[GameDataSync] 自动同步已停止');
        }
    }

    /**
     * 用户登录
     */
    public async login(username: string, password: string): Promise<any> {
        if (!this.isServerEnabled) {
            return {
                success: true,
                local: true,
                data: {
                    username,
                    nickname: username,
                },
            };
        }

        try {
            const result = await this.httpManager.login(username, password);
            if (result.success) {
                GameStorage.setStringDisk('server_username', username);
                GameStorage.setStringDisk('server_token', result.data.token);
                this.startAutoSync();

                await this.loadFromServer();
            }
            return result;
        } catch (error) {
            console.error('[GameDataSync] 登录失败:', error);
            throw error;
        }
    }

    /**
     * 用户注册
     */
    public async register(username: string, password: string, nickname: string): Promise<any> {
        if (!this.isServerEnabled) {
            return {
                success: true,
                local: true,
                data: {
                    username,
                    nickname,
                },
            };
        }

        try {
            const result = await this.httpManager.register(username, password, nickname);
            if (result.success) {
                GameStorage.setStringDisk('server_username', username);
                GameStorage.setStringDisk('server_token', result.data.token);
                this.startAutoSync();
            }
            return result;
        } catch (error) {
            console.error('[GameDataSync] 注册失败:', error);
            throw error;
        }
    }

    /**
     * 自动登录
     */
    public async autoLogin(): Promise<boolean> {
        if (!this.isServerEnabled) {
            return true;
        }

        const username = GameStorage.getStringDisk('server_username', '');
        const token = GameStorage.getStringDisk('server_token', '');

        if (!username || !token) {
            return false;
        }

        try {
            this.httpManager.setToken(token);
            const userInfo = await this.httpManager.getUserInfo();

            if (userInfo.success) {
                console.log('[GameDataSync] 自动登录成功');
                await this.loadFromServer();
                return true;
            }
        } catch (error) {
            console.warn('[GameDataSync] 自动登录失败:', error);
        }

        GameStorage.setStringDisk('server_username', '');
        GameStorage.setStringDisk('server_token', '');
        this.httpManager.setToken('');

        return false;
    }

    /**
     * 同步数据到服务器
     */
    public async syncToServer() {
        if (!this.isServerEnabled) {
            return;
        }

        if (!this.httpManager.getToken()) {
            console.warn('[GameDataSync] 未登录，跳过同步');
            return;
        }

        try {
            const gameData = this.collectLocalData();
            await this.httpManager.saveGameData('gameData', gameData);
            console.log('[GameDataSync] 数据已同步到服务器');
        } catch (error) {
            console.error('[GameDataSync] 同步到服务器失败:', error);
        }
    }

    /**
     * 从服务器加载数据
     */
    public async loadFromServer() {
        if (!this.isServerEnabled) {
            return;
        }

        if (!this.httpManager.getToken()) {
            console.warn('[GameDataSync] 未登录，跳过加载');
            return;
        }

        try {
            const result = await this.httpManager.loadGameData('gameData');

            if (result.success && result.data && result.data.value) {
                this.applyServerData(result.data.value);
                console.log('[GameDataSync] 已从服务器加载数据');
            } else {
                console.log('[GameDataSync] 服务器暂无数据，使用本地数据');
            }
        } catch (error: any) {
            if (error.message && error.message.includes('404')) {
                console.log('[GameDataSync] 服务器暂无数据（首次运行），使用本地数据');
            } else {
                console.error('[GameDataSync] 从服务器加载数据失败:', error);
            }
        }
    }

    /**
     * 收集本地数据
     */
    private collectLocalData(): any {
        const gameData: any = {
            timestamp: Date.now(),
            version: '1.0.0',
        };

        try {
            // GameStorage 会自动补上 JSF_ 前缀，这里直接用业务 key 即可。
            const roleLv = GameStorage.getInt('roleLv', 1);
            const roleExp = GameStorage.getInt('roleExp', 0);
            const roleName = GameStorage.getString('roleName', '');

            const coins = GameStorage.getInt('coin', 0);
            const diamonds = GameStorage.getInt('diamonds', 0);
            const power = GameStorage.getInt('power', 100);

            gameData.player = {
                level: roleLv,
                exp: roleExp,
                name: roleName,
                coins,
                diamonds,
                power,
            };

            console.log('[GameDataSync] 收集游戏数据:', gameData);
        } catch (error) {
            console.warn('[GameDataSync] 收集数据时出错:', error);
        }

        return gameData;
    }

    /**
     * 应用服务器数据到本地
     */
    private applyServerData(data: any) {
        if (!data) {
            return;
        }

        console.log('[GameDataSync] 应用服务器数据:', data);

        try {
            // GameStorage 会自动补上 JSF_ 前缀，这里直接用业务 key 即可。
            if (data.player) {
                const player = data.player;

                if (player.level !== undefined) {
                    GameStorage.setInt('roleLv', player.level);
                }
                if (player.exp !== undefined) {
                    GameStorage.setInt('roleExp', player.exp);
                }
                if (player.name) {
                    GameStorage.setString('roleName', player.name);
                }
                if (player.coins !== undefined) {
                    GameStorage.setInt('coin', player.coins);
                }
                if (player.diamonds !== undefined) {
                    GameStorage.setInt('diamonds', player.diamonds);
                }
                if (player.power !== undefined) {
                    GameStorage.setInt('power', player.power);
                }

                console.log('[GameDataSync] 玩家数据已同步到本地');
            }
        } catch (error) {
            console.error('[GameDataSync] 应用数据时出错:', error);
        }
    }

    /**
     * 更新用户资源
     */
    public async updateResources(coins?: number, diamonds?: number, power?: number, exp?: number) {
        if (!this.isServerEnabled || !this.httpManager.getToken()) {
            return;
        }

        try {
            await this.httpManager.updateResources(coins, diamonds, power, exp);
            console.log('[GameDataSync] 资源已更新到服务器');
        } catch (error) {
            console.error('[GameDataSync] 更新资源失败:', error);
        }
    }

    /**
     * 更新排行榜
     */
    public async updateLeaderboard(score: number) {
        if (!this.isServerEnabled || !this.httpManager.getToken()) {
            return;
        }

        try {
            await this.httpManager.updateLeaderboard(score);
            console.log('[GameDataSync] 排行榜已更新');
        } catch (error) {
            console.error('[GameDataSync] 更新排行榜失败:', error);
        }
    }

    /**
     * 获取排行榜
     */
    public async getLeaderboard(limit: number = 100): Promise<any> {
        if (!this.isServerEnabled) {
            return { success: true, data: [] };
        }

        try {
            return await this.httpManager.getLeaderboard(limit);
        } catch (error) {
            console.error('[GameDataSync] 获取排行榜失败:', error);
            return { success: false, data: [] };
        }
    }
}

export const gameDataSync = GameDataSync.getInstance();
export default GameDataSync;
