// 成就系统核心管理器

import { GameStorage } from './gameStorage';
import {
    AchievementConfig,
    AchievementRuntimeState,
} from './TaskTypes';
import { TaskExpression } from './TaskExpression';
import { ProgressMetrics } from './ProgressMetrics';

const ACHIEVE_COMPLETED_KEY_PREFIX = 'AchieveCompleted_';
const ACHIEVE_CAN_REWARD_KEY_PREFIX = 'AchieveCanReward_';

/**
 * 成就系统核心：
 * - 自动根据 ProgressMetrics 评估
 * - 不需要“接受成就”，只有“可领奖 / 已完成”两种核心状态
 */
export class AchievementManager {
    private static _instance: AchievementManager | null = null;

    public static get instance(): AchievementManager {
        if (!this._instance) {
            this._instance = new AchievementManager();
        }
        return this._instance;
    }

    private readonly _configs = new Map<number, AchievementConfig>();
    private readonly _states = new Map<number, AchievementRuntimeState>();

    private _rewardHandler: ((achieve: AchievementRuntimeState) => void) | null = null;

    private constructor() {}

    public init(configs: AchievementConfig[]): void {
        this._configs.clear();
        this._states.clear();

        for (const cfg of configs) {
            this._configs.set(cfg.id, cfg);
            const runtime = this.loadStateFromStorage(cfg);
            this._states.set(cfg.id, runtime);
        }

        this.evaluateAll();
    }

    /** 注入成就奖励处理逻辑（背包发奖励 / 弹窗等） */
    public setRewardHandler(handler: ((achieve: AchievementRuntimeState) => void) | null): void {
        this._rewardHandler = handler;
    }

    public getAll(): AchievementRuntimeState[] {
        return Array.from(this._states.values());
    }

    /** 是否存在可领取奖励的成就（可用于红点） */
    public hasRewardable(): boolean {
        for (const state of this._states.values()) {
            if (state.canReward) {
                return true;
            }
        }
        return false;
    }

    /** 在 metrics 变化后调用，用于重新评估所有成就 */
    public evaluateAll(): void {
        const nowSec = Math.floor(Date.now() / 1000);
        const getMetric = (key: string): number => ProgressMetrics.instance.get(key);

        for (const state of this._states.values()) {
            // 已经完成的成就仍然可以维持 completed=true / canReward=false
            if (state.completed) {
                continue;
            }

            const ok = TaskExpression.evaluate(state.config.completeExpr, getMetric);
            if (ok) {
                state.canReward = true;
                state.lastUpdateTime = nowSec;
                this.saveStateToStorage(state);
            }
        }
    }

    /** 在 metrics 更新时，如需自动评估成就，可调用本方法 */
    public handleMetricsUpdated(): void {
        this.evaluateAll();
    }

    /** 领取成就奖励（仅当 canReward=true 时有效） */
    public claimReward(id: number): void {
        const state = this._states.get(id);
        if (!state) {
            return;
        }
        if (!state.canReward || state.completed) {
            return;
        }

        state.canReward = false;
        state.completed = true;
        state.lastUpdateTime = Math.floor(Date.now() / 1000);
        this.saveStateToStorage(state);

        if (this._rewardHandler) {
            this._rewardHandler(state);
        }
    }

    /* ======================= 内部实现 ======================= */

    private loadStateFromStorage(config: AchievementConfig): AchievementRuntimeState {
        const completedKey = ACHIEVE_COMPLETED_KEY_PREFIX + config.id;
        const canRewardKey = ACHIEVE_CAN_REWARD_KEY_PREFIX + config.id;

        const completed = GameStorage.getBoolean(completedKey, false);
        const canReward = GameStorage.getBoolean(canRewardKey, false);

        const runtime: AchievementRuntimeState = {
            config,
            completed,
            canReward,
            lastUpdateTime: Math.floor(Date.now() / 1000),
        };
        return runtime;
    }

    private saveStateToStorage(state: AchievementRuntimeState): void {
        const completedKey = ACHIEVE_COMPLETED_KEY_PREFIX + state.config.id;
        const canRewardKey = ACHIEVE_CAN_REWARD_KEY_PREFIX + state.config.id;

        GameStorage.setBoolean(completedKey, state.completed);
        GameStorage.setBoolean(canRewardKey, state.canReward);
    }
}

/** 单例别名 */
export const achievementManager = AchievementManager.instance;

