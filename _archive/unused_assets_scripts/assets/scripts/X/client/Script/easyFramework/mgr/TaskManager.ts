// 任务系统核心管理器

import { GameStorage } from './gameStorage';
import { TaskConfig, TaskRuntimeState, TaskState, TaskType } from './TaskTypes';
import { TaskExpression } from './TaskExpression';
import { ProgressMetrics } from './ProgressMetrics';

const TASK_STATE_KEY_PREFIX = 'TaskState_';
const TASK_PROGRESS_KEY_PREFIX = 'TaskProgress_';

/**
 * 任务系统核心：
 * - 纯逻辑类，不继承 Component
 * - 只负责状态流转和本地存储，不直接发奖励、不直接操作 UI
 */
export class TaskManager {
    private static _instance: TaskManager | null = null;

    public static get instance(): TaskManager {
        if (!this._instance) {
            this._instance = new TaskManager();
        }
        return this._instance;
    }

    /** 所有任务配置 */
    private readonly _configs = new Map<number, TaskConfig>();
    /** 运行时状态 */
    private readonly _states = new Map<number, TaskRuntimeState>();

    /** 发奖励回调，由项目层注入（可选） */
    private _rewardHandler: ((task: TaskRuntimeState) => void) | null = null;

    private constructor() {}

    /**
     * 初始化任务系统。
     * @param configs 任务配置数组（从表里读完后传进来）
     */
    public init(configs: TaskConfig[]): void {
        this._configs.clear();
        this._states.clear();

        for (const cfg of configs) {
            this._configs.set(cfg.id, cfg);
            const runtime = this.loadStateFromStorage(cfg);
            this._states.set(cfg.id, runtime);
        }

        // 初始时跑一遍，确保 Locked/Available/Failed 等状态刷新
        this.evaluateAll();
    }

    /** 注入发奖励逻辑（比如背包加道具），框架层不直接依赖任何道具系统 */
    public setRewardHandler(handler: ((task: TaskRuntimeState) => void) | null): void {
        this._rewardHandler = handler;
    }

    /** 获取所有任务运行时状态（可用于 UI） */
    public getAllTasks(): TaskRuntimeState[] {
        return Array.from(this._states.values());
    }

    public getTasksByType(type: TaskType): TaskRuntimeState[] {
        const result: TaskRuntimeState[] = [];
        for (const state of this._states.values()) {
            if (state.config.type === type) {
                result.push(state);
            }
        }
        return result;
    }

    public getTaskState(taskId: number): TaskState | undefined {
        const state = this._states.get(taskId);
        return state ? state.state : undefined;
    }

    /** 是否存在可以领奖的任务（可用于主入口红点） */
    public hasRewardableTask(type?: TaskType): boolean {
        for (const state of this._states.values()) {
            if (state.state === TaskState.CanReward) {
                if (type == null || state.config.type === type) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 事件驱动计数更新的辅助方法：
     * - 内部调用 ProgressMetrics，再自动重新评估所有任务。
     */
    public updateMetric(metricKey: string, delta: number): number {
        const value = ProgressMetrics.instance.update(metricKey, delta);
        this.evaluateAll();
        return value;
    }

    /** 手动设置某个 metric，再重新评估任务（适合加载存档后补算） */
    public setMetric(metricKey: string, value: number): void {
        ProgressMetrics.instance.set(metricKey, value);
        this.evaluateAll();
    }

    /** 接受任务：仅当状态为 Available 时有效 */
    public acceptTask(taskId: number): void {
        const runtime = this._states.get(taskId);
        if (!runtime) {
            return;
        }
        if (runtime.state !== TaskState.Available) {
            return;
        }
        runtime.state = TaskState.Accepted;
        runtime.lastUpdateTime = this.nowSeconds();
        this.saveStateToStorage(runtime);
    }

    /** 领取任务奖励：仅当状态为 CanReward 时有效 */
    public claimReward(taskId: number): void {
        const runtime = this._states.get(taskId);
        if (!runtime) {
            return;
        }
        if (runtime.state !== TaskState.CanReward) {
            return;
        }

        runtime.state = TaskState.Completed;
        runtime.lastUpdateTime = this.nowSeconds();
        this.saveStateToStorage(runtime);

        if (this._rewardHandler) {
            this._rewardHandler(runtime);
        }
    }

    /** 主动标记任务失败（例如限时结束） */
    public failTask(taskId: number): void {
        const runtime = this._states.get(taskId);
        if (!runtime) {
            return;
        }
        if (runtime.state === TaskState.Completed || runtime.state === TaskState.Failed) {
            return;
        }
        runtime.state = TaskState.Failed;
        runtime.lastUpdateTime = this.nowSeconds();
        this.saveStateToStorage(runtime);
    }

    /**
     * 每日重置：
     * - 清理所有 Daily 类型任务的状态和进度
     * - 调用方可以在收到 GD.event.overDay 时调用本方法
     */
    public resetDailyTasks(): void {
        const nowSec = this.nowSeconds();
        for (const state of this._states.values()) {
            if (state.config.type !== TaskType.Daily) {
                continue;
            }
            // 重置为 Locked，后续会在 evaluateAll 中根据 unlockExpr / preTaskId 刷新状态
            state.state = TaskState.Locked;
            state.progressValue = 0;
            state.lastUpdateTime = nowSec;
            this.saveStateToStorage(state);
        }

        // 重算一次，使 Daily 任务根据条件进入 Locked / Available 等状态
        this.evaluateAll();
    }

    /** 重新评估所有任务状态（在 metrics 变化后调用） */
    public evaluateAll(): void {
        const nowSec = this.nowSeconds();
        for (const state of this._states.values()) {
            this.evaluateSingleTask(state, nowSec);
        }
    }

    /* ======================= 内部实现 ======================= */

    private loadStateFromStorage(config: TaskConfig): TaskRuntimeState {
        const stateKey = TASK_STATE_KEY_PREFIX + config.id;
        const progressKey = TASK_PROGRESS_KEY_PREFIX + config.id;

        const storedState = GameStorage.getInt(stateKey, TaskState.Locked);
        const storedProgress = GameStorage.getInt(progressKey, 0);

        const runtime: TaskRuntimeState = {
            config,
            state: storedState as TaskState,
            progressValue: storedProgress,
            lastUpdateTime: this.nowSeconds(),
        };

        return runtime;
    }

    private saveStateToStorage(runtime: TaskRuntimeState): void {
        const stateKey = TASK_STATE_KEY_PREFIX + runtime.config.id;
        const progressKey = TASK_PROGRESS_KEY_PREFIX + runtime.config.id;

        GameStorage.setInt(stateKey, runtime.state);
        GameStorage.setInt(progressKey, Math.floor(runtime.progressValue));
    }

    private evaluateSingleTask(runtime: TaskRuntimeState, nowSec: number): void {
        const config = runtime.config;

        // 已完成或已失败的任务不再参与评估
        if (runtime.state === TaskState.Completed || runtime.state === TaskState.Failed) {
            return;
        }

        // 限时任务：结束时间已过且未完成 → 失败
        if (config.endTime && nowSec > config.endTime) {
            runtime.state = TaskState.Failed;
            runtime.lastUpdateTime = nowSec;
            this.saveStateToStorage(runtime);
            return;
        }

        // 前置任务未完成 → 强制 Locked
        if (config.preTaskId != null) {
            const pre = this._states.get(config.preTaskId);
            if (!pre || pre.state !== TaskState.Completed) {
                if (runtime.state !== TaskState.Locked) {
                    runtime.state = TaskState.Locked;
                    runtime.lastUpdateTime = nowSec;
                    this.saveStateToStorage(runtime);
                }
                return;
            }
        }

        const getMetric = (key: string): number => ProgressMetrics.instance.get(key);

        // 解锁条件
        const unlockOk = TaskExpression.evaluate(config.unlockExpr, getMetric);
        if (!unlockOk) {
            if (runtime.state !== TaskState.Locked) {
                runtime.state = TaskState.Locked;
                runtime.lastUpdateTime = nowSec;
                this.saveStateToStorage(runtime);
            }
            return;
        }

        // 通过解锁条件，最低变成 Available
        if (runtime.state === TaskState.Locked) {
            runtime.state = TaskState.Available;
            runtime.lastUpdateTime = nowSec;
            this.saveStateToStorage(runtime);
        }

        // 只有 Accepted 状态才检测是否达成（你已经明确不要自动接任务）
        if (runtime.state === TaskState.Accepted) {
            const complete = TaskExpression.evaluate(config.completeExpr, getMetric);
            if (complete) {
                runtime.state = TaskState.CanReward;
                this.updateProgressForRuntime(runtime, nowSec);
                this.saveStateToStorage(runtime);
                return;
            }
        }

        // 未完成时，仍然可以刷新进度（用于 UI 进度展示）
        this.updateProgressForRuntime(runtime, nowSec);
        this.saveStateToStorage(runtime);
    }

    private updateProgressForRuntime(runtime: TaskRuntimeState, nowSec: number): void {
        const cfg = runtime.config;
        if (cfg.progressMetricKey && cfg.progressTarget != null) {
            const current = ProgressMetrics.instance.get(cfg.progressMetricKey);
            runtime.progressValue = current;
            runtime.lastUpdateTime = nowSec;
        }
    }

    private nowSeconds(): number {
        return Math.floor(Date.now() / 1000);
    }
}

/** 方便直接使用的单例别名 */
export const taskManager = TaskManager.instance;

