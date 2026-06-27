import type { HAnalyticsFacade } from '../analytics/HAnalyticsFacade';
import type { HConfigFacade } from '../config/HConfigFacade';
import type { HDataStore } from '../data/HDataStore';
import type {
    HRewardAdClaimOptions,
    HRewardBaseOptions,
    HRewardCallbacks,
    HRewardInitOptions,
    HRewardRecord,
    HRewardResult,
    HRewardSaveData,
    HRewardSDKActionClaimOptions,
} from '../HTypes';
import type { HSDKFacade } from '../sdk/HSDKFacade';
import type { HSessionTimer } from '../session/HSessionTimer';

const DEFAULT_REWARD_OPTIONS: HRewardInitOptions = {
    storageModuleName: 'reward',
    defaultCooldownMs: 0,
    debug: false,
};

export class HRewardFacade {
    private options: HRewardInitOptions = { ...DEFAULT_REWARD_OPTIONS };
    private dataStore: HDataStore | null = null;
    private sdkFacade: HSDKFacade | null = null;
    private configFacade: HConfigFacade | null = null;
    private analytics: HAnalyticsFacade | null = null;
    private sessionTimer: HSessionTimer | null = null;
    private saveData: HRewardSaveData = {
        records: {},
        updatedAt: 0,
    };
    private readonly claimingKeys = new Set<string>();
    private initialized = false;

    public init(
        options: HRewardInitOptions = {},
        dataStore?: HDataStore,
        sdkFacade?: HSDKFacade,
        configFacade?: HConfigFacade,
        analytics?: HAnalyticsFacade,
        sessionTimer?: HSessionTimer,
    ): void {
        this.options = {
            ...DEFAULT_REWARD_OPTIONS,
            ...options,
        };
        this.dataStore = dataStore || null;
        this.sdkFacade = sdkFacade || null;
        this.configFacade = configFacade || null;
        this.analytics = analytics || null;
        this.sessionTimer = sessionTimer || null;
        this.initialized = true;
        this.saveData = this.dataStore?.getModule<HRewardSaveData>(this.getStorageModuleName(), {
            records: {},
            updatedAt: 0,
        }) || {
            records: {},
            updatedAt: 0,
        };
    }

    public async claimByRewardAd(options: HRewardAdClaimOptions): Promise<HRewardResult> {
        this.ensureInit();
        const normalized = this.normalizeOptions(options);
        const lockKey = this.getClaimingKey(normalized);
        const busy = this.acquireClaiming(lockKey);
        if (busy) {
            return this.reject(normalized, 'failed', '奖励流程正在处理中，请勿重复点击');
        }

        try {
            const precheck = this.precheck(normalized);
            if (precheck) {
                return precheck;
            }

            this.analytics?.track('reward_claim_start', {
                rewardScene: normalized.rewardScene,
                rewardId: normalized.rewardId,
                placement: normalized.placement,
                type: 'rewardAd',
            });

            const ret = await this.sdkFacade!.showReward(normalized.placement);
            if (!ret.rewarded) {
                return this.reject(normalized, 'ad-not-rewarded', ret.userMessage || '观看完整广告后才能获得奖励', ret);
            }

            return this.grant(normalized, ret);
        } catch (error) {
            return this.reject(normalized, 'failed', this.getErrorMessage(error), error);
        } finally {
            this.releaseClaiming(lockKey);
        }
    }

    public async claimBySDKAction(options: HRewardSDKActionClaimOptions): Promise<HRewardResult> {
        this.ensureInit();
        const normalized = this.normalizeOptions(options);
        const lockKey = this.getClaimingKey(normalized);
        const busy = this.acquireClaiming(lockKey);
        if (busy) {
            return this.reject(normalized, 'failed', '奖励流程正在处理中，请勿重复点击');
        }

        try {
            const precheck = this.precheck(normalized);
            if (precheck) {
                return precheck;
            }

            this.analytics?.track('reward_claim_start', {
                rewardScene: normalized.rewardScene,
                rewardId: normalized.rewardId,
                type: 'sdkAction',
            });

            const ret = await normalized.action();
            if (!ret.rewardable) {
                return this.reject(normalized, 'sdk-not-completed', ret.userMessage || '操作完成后才能获得奖励', ret);
            }

            return this.grant(normalized, ret);
        } catch (error) {
            return this.reject(normalized, 'failed', this.getErrorMessage(error), error);
        } finally {
            this.releaseClaiming(lockKey);
        }
    }

    /**
     * 业务推荐入口：激励广告奖励只暴露 success/fail 两个回调。
     *
     * @param options 奖励广告配置，包含 rewardScene、rewardId、placement 等。
     * @param callbacks 业务只处理成功和失败；频控、状态、埋点、广告回调、奖励记录都在框架内部完成。
     */
    public async claimRewardAd(options: HRewardAdClaimOptions, callbacks: HRewardCallbacks = {}): Promise<void> {
        const result = await this.claimByRewardAdSafe(options);
        await this.dispatchCallbacks(result, callbacks);
    }

    /**
     * 业务推荐入口：分享、收藏、侧边栏、添加桌面等 SDK 行为奖励只暴露 success/fail 两个回调。
     *
     * @param options SDK 行为奖励配置，action 由框架 SDK 能力返回 rewardable。
     * @param callbacks 业务只处理成功和失败；完成判定、冷却和奖励记录都在框架内部完成。
     */
    public async claimSDKAction(options: HRewardSDKActionClaimOptions, callbacks: HRewardCallbacks = {}): Promise<void> {
        const result = await this.claimBySDKActionSafe(options);
        await this.dispatchCallbacks(result, callbacks);
    }

    public hasClaimed(rewardScene: string, rewardId: string): boolean {
        this.ensureInit();
        const record = this.saveData.records[this.getRecordKey(rewardScene, rewardId)];
        return !!record && record.count > 0;
    }

    public getRecord(rewardScene: string, rewardId: string): HRewardRecord | null {
        this.ensureInit();
        const record = this.saveData.records[this.getRecordKey(rewardScene, rewardId)];
        return record ? this.clone(record) : null;
    }

    public clear(): void {
        this.saveData = {
            records: {},
            updatedAt: Date.now(),
        };
        this.save(true);
    }

    private precheck(options: HRewardBaseOptions): HRewardResult | null {
        const normalized = this.normalizeOptions(options);
        if (normalized.switchKey && !this.configFacade?.isFeatureEnabled(normalized.switchKey, true)) {
            return this.reject(normalized, 'config-disabled', '当前奖励入口暂未开放');
        }

        const record = this.getOrCreateRecord(normalized);
        if (normalized.once && record.count > 0) {
            return this.reject(normalized, 'duplicated', '奖励已经领取过', undefined, true);
        }

        if (normalized.dailyLimit && normalized.dailyLimit > 0) {
            const today = this.getTodayKey();
            const dailyCount = record.dailyCount[today] || 0;
            if (dailyCount >= normalized.dailyLimit) {
                return this.reject(normalized, 'daily-limit', '今日领取次数已用完');
            }
        }

        const cooldownMs = this.resolveCooldownMs(normalized);
        if (cooldownMs > 0) {
            const cooldownKey = this.getCooldownKey(normalized);
            const state = this.sessionTimer!.canUseCooldown(cooldownKey, cooldownMs);
            if (!state.allowed) {
                return this.reject(normalized, 'cooldown', `还需等待 ${Math.ceil(state.remainingMs / 1000)} 秒`);
            }
        }

        return null;
    }

    private async claimByRewardAdSafe(options: HRewardAdClaimOptions): Promise<HRewardResult> {
        try {
            return await this.claimByRewardAd(options);
        } catch (error) {
            return this.exceptionResult(options, error);
        }
    }

    private async claimBySDKActionSafe(options: HRewardSDKActionClaimOptions): Promise<HRewardResult> {
        try {
            return await this.claimBySDKAction(options);
        } catch (error) {
            return this.exceptionResult(options, error);
        }
    }

    private async dispatchCallbacks(result: HRewardResult, callbacks: HRewardCallbacks): Promise<void> {
        const payload = {
            rewardScene: result.rewardScene,
            rewardId: result.rewardId,
            reason: result.reason,
            userMessage: result.userMessage,
        };

        try {
            if (result.ok && result.granted) {
                await callbacks.success?.(payload);
                return;
            }

            await callbacks.fail?.(payload);
        } catch (error) {
            console.warn('[HReward] reward callback failed', error);
        }
    }

    private acquireClaiming(key: string): boolean {
        if (this.claimingKeys.has(key)) {
            return true;
        }

        this.claimingKeys.add(key);
        return false;
    }

    private releaseClaiming(key: string): void {
        this.claimingKeys.delete(key);
    }

    private getClaimingKey(options: HRewardBaseOptions): string {
        return options.cooldownKey || `reward-flow:${options.rewardScene}:${options.rewardId}`;
    }

    private grant(options: HRewardBaseOptions, raw?: unknown): HRewardResult {
        const normalized = this.normalizeOptions(options);
        const record = this.getOrCreateRecord(normalized);
        const today = this.getTodayKey();
        record.count += 1;
        record.dailyCount[today] = (record.dailyCount[today] || 0) + 1;
        record.lastClaimAt = Date.now();
        this.saveData.updatedAt = Date.now();
        this.save(true);

        const cooldownMs = this.resolveCooldownMs(normalized);
        if (cooldownMs > 0) {
            this.sessionTimer!.markCooldown(this.getCooldownKey(normalized));
        }

        const result: HRewardResult = {
            ok: true,
            granted: true,
            duplicated: false,
            rewardScene: normalized.rewardScene,
            rewardId: normalized.rewardId,
            raw,
        };

        this.analytics?.track('reward_granted', {
            rewardScene: normalized.rewardScene,
            rewardId: normalized.rewardId,
        });

        if (this.options.debug) {
            console.log('[HReward] granted', normalized.rewardScene, normalized.rewardId);
        }

        return result;
    }

    private reject(
        options: HRewardBaseOptions,
        reason: HRewardResult['reason'],
        userMessage: string,
        raw?: unknown,
        duplicated = false,
    ): HRewardResult {
        const normalized = this.normalizeOptions(options);
        const result: HRewardResult = {
            ok: false,
            granted: false,
            duplicated,
            rewardScene: normalized.rewardScene,
            rewardId: normalized.rewardId,
            reason,
            userMessage,
            raw,
        };

        this.analytics?.track(duplicated ? 'reward_duplicated' : 'reward_rejected', {
            rewardScene: normalized.rewardScene,
            rewardId: normalized.rewardId,
            reason,
        });

        if (this.options.debug) {
            console.warn('[HReward] rejected', normalized.rewardScene, normalized.rewardId, reason, userMessage);
        }

        return result;
    }

    private exceptionResult(options: Partial<HRewardBaseOptions>, error: unknown): HRewardResult {
        const rewardScene = options.rewardScene?.trim() || 'unknown';
        const rewardId = options.rewardId?.trim() || 'unknown';
        const result: HRewardResult = {
            ok: false,
            granted: false,
            duplicated: false,
            rewardScene,
            rewardId,
            reason: 'failed',
            userMessage: this.getErrorMessage(error),
            raw: error,
        };

        this.analytics?.track('reward_exception', {
            rewardScene,
            rewardId,
            reason: result.reason,
            userMessage: result.userMessage,
        });

        return result;
    }

    private normalizeOptions<T extends HRewardBaseOptions>(options: T): T {
        const rewardScene = options.rewardScene.trim();
        const rewardId = options.rewardId.trim();
        if (!rewardScene || !rewardId) {
            throw new Error('[HRewardFacade] rewardScene 和 rewardId 不能为空');
        }
        return {
            ...options,
            rewardScene,
            rewardId,
        };
    }

    private getOrCreateRecord(options: HRewardBaseOptions): HRewardRecord {
        const key = this.getRecordKey(options.rewardScene, options.rewardId);
        if (!this.saveData.records[key]) {
            this.saveData.records[key] = {
                rewardScene: options.rewardScene,
                rewardId: options.rewardId,
                count: 0,
                dailyCount: {},
                lastClaimAt: 0,
            };
        }
        return this.saveData.records[key];
    }

    private resolveCooldownMs(options: HRewardBaseOptions): number {
        if (typeof options.cooldownMs === 'number') {
            return Math.max(0, Math.floor(options.cooldownMs));
        }
        return Math.max(0, Math.floor(this.options.defaultCooldownMs || 0));
    }

    private getCooldownKey(options: HRewardBaseOptions): string {
        return options.cooldownKey || `reward:${options.rewardScene}:${options.rewardId}`;
    }

    private getRecordKey(rewardScene: string, rewardId: string): string {
        return `${rewardScene.trim()}::${rewardId.trim()}`;
    }

    private getTodayKey(): string {
        const date = new Date();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${date.getFullYear()}-${month}-${day}`;
    }

    private getErrorMessage(error: unknown): string {
        if (error && typeof error === 'object') {
            return (error as any).message || '奖励流程失败，请稍后重试';
        }
        if (typeof error === 'string') {
            return error;
        }
        return '奖励流程失败，请稍后重试';
    }

    private save(immediate: boolean): void {
        this.dataStore?.setModule<HRewardSaveData>(this.getStorageModuleName(), this.clone(this.saveData), { immediate });
    }

    private getStorageModuleName(): string {
        return this.options.storageModuleName?.trim() || 'reward';
    }

    private clone<T>(value: T): T {
        return JSON.parse(JSON.stringify(value)) as T;
    }

    private ensureInit(): void {
        if (!this.initialized) {
            this.init();
        }
        if (!this.sdkFacade) {
            throw new Error('[HRewardFacade] H.sdk 未初始化');
        }
        if (!this.sessionTimer) {
            throw new Error('[HRewardFacade] H.session 未初始化');
        }
    }
}
