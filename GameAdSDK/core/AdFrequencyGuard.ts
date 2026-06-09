import { GameAdInitConfig, GameAdFailReason } from "../GameAdTypes";

export class AdFrequencyGuard {
    private static appLaunchAt = Date.now();
    private static showingReward = false;
    private static rewardRequestId = 0;
    private static showingInterstitial = false;
    private static lastRewardAt = 0;
    private static lastInterstitialAt = 0;

    /**
     * 判断当前是否允许发起激励视频请求。
     * 网络卡顿时重复点击会在这里被拦截为 busy。
     */
    public static canShowReward(): GameAdFailReason | null {
        if (this.showingReward || this.showingInterstitial) {
            return "busy";
        }
        return null;
    }

    /**
     * 标记激励视频请求开始，并生成新的请求序号。
     */
    public static markRewardStart(): void {
        this.showingReward = true;
        this.rewardRequestId++;
    }

    /**
     * 标记激励视频请求结束。
     * countAsShown 为 true 时才会影响“激励后插屏冷却”。
     */
    public static markRewardEnd(requestId?: number, countAsShown = true): void {
        if (requestId && requestId != this.rewardRequestId) {
            return;
        }
        this.showingReward = false;
        if (countAsShown) {
            this.lastRewardAt = Date.now();
        }
    }

    /**
     * 获取当前激励视频请求序号，用于避免旧异步回调误释放新请求锁。
     */
    public static getRewardRequestId(): number {
        return this.rewardRequestId;
    }

    /**
     * 判断当前是否允许展示插屏广告。
     * 包含启动保护、两次插屏间隔、激励视频后冷却三类限制。
     */
    public static canShowInterstitial(config: GameAdInitConfig): GameAdFailReason | null {
        const policy = config.interstitial || {};
        const now = Date.now();
        const launchDelayMs = policy.launchDelayMs ?? 30000;
        const intervalMs = policy.intervalMs ?? 60000;
        const afterRewardMs = policy.afterRewardMs ?? 60000;

        if (this.showingReward || this.showingInterstitial) {
            return "busy";
        }
        if (now - this.appLaunchAt < launchDelayMs) {
            return "cooldown";
        }
        if (this.lastInterstitialAt > 0 && now - this.lastInterstitialAt < intervalMs) {
            return "cooldown";
        }
        if (this.lastRewardAt > 0 && now - this.lastRewardAt < afterRewardMs) {
            return "cooldown";
        }

        return null;
    }

    /**
     * 标记插屏广告开始展示。
     */
    public static markInterstitialStart(): void {
        this.showingInterstitial = true;
    }

    /**
     * 标记插屏广告结束，并记录最后展示时间。
     */
    public static markInterstitialEnd(): void {
        this.showingInterstitial = false;
        this.lastInterstitialAt = Date.now();
    }
}
