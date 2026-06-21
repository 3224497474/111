import type { HAnalyticsFacade } from '../analytics/HAnalyticsFacade';
import type { HConfigFacade } from '../config/HConfigFacade';
import type { HDataStore } from '../data/HDataStore';
import type {
    HRewardAdClaimOptions,
    HRewardBaseOptions,
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
        const precheck = this.precheck(options);
        if (precheck) {
            return precheck;
        }

        this.analytics?.track('reward_claim_start', {
            rewardScene: options.rewardScene,
            rewardId: options.rewardId,
            placement: options.placement,
            type: 'rewardAd',
        });

        const ret = await this.sdkFacade!.showReward(options.placement);
        if (!ret.rewarded) {
            return this.reject(options, 'ad-not-rewarded', ret.userMessage || '观看完整广告后才能获得奖励', ret);
        }

        return this.grant(options, ret);
    }

    public async claimBySDKAction(options: HRewardSDKActionClaimOptions): Promise<HRewardResult> {
        this.ensureInit();
        const precheck = this.precheck(options);
        if (precheck) {
            return precheck;
        }

        this.analytics?.track('reward_claim_start', {
            rewardScene: options.rewardScene,
            rewardId: options.rewardId,
            type: 'sdkAction',
        });

        const ret = await options.action();
        if (!ret.rewardable) {
            return this.reject(options, 'sdk-not-completed', ret.userMessage || '操作完成后才能获得奖励', ret);
        }

        return this.grant(options, ret);
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
