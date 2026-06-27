// 任务与成就的通用枚举和配置/状态结构

export enum TaskType {
    Main = 1,      // 主线 / 引导任务
    Daily = 2,     // 每日任务
    OneShot = 3,   // 一次性成长 / 支线任务
    LimitTime = 4, // 限时活动任务
}

export enum TaskState {
    Locked = 0,    // 未解锁
    Available = 1, // 可接
    Accepted = 2,  // 已接受 / 进行中
    CanReward = 3, // 已达成，可领奖
    Completed = 4, // 已领奖，完成
    Failed = 5,    // 失败（超时等）
}

export interface RewardItemConfig {
    /** 道具/货币 ID */
    propId: number;
    /** 数量 */
    count: number;
}

/** 任务 ID 类型 */
export type TaskId = number;

/**
 * 通用任务配置结构（从表里读出来后适配到这个结构）。
 * 文案相关字段存的是多语言 key。
 */
export interface TaskConfig {
    id: TaskId;

    /** 任务类型：主线 / 每日 / 一次性 / 限时 */
    type: TaskType;

    /** 标题多语言 key */
    titleKey: string;
    /** 描述多语言 key */
    descKey: string;
    /** 奖励说明多语言 key（可选，用于 UI 展示奖励说明文本） */
    rewardTextKey?: string;

    /** UI 分组用 key，例如 "main" / "daily" / "event" */
    groupKey?: string;

    /** 排序权重，值越小越靠前 */
    sortOrder?: number;

    /**
     * 解锁条件表达式（可选）：
     * - 为空 / 未配置：默认一开始就处于 Available（或由前置任务控制）
     * - 非空：表达式为 true 时，状态才允许从 Locked → Available
     * 表达式形式示例：
     *   "level>=5 && total_win>=1"
     */
    unlockExpr?: string;

    /**
     * 完成条件表达式（必填）：
     * - 仅在任务处于 Accepted 状态时才会被评估
     * - 表达式语法见 TaskExpression 说明
     */
    completeExpr: string;

    /**
     * 进度展示用的 metric key（可选）：
     * - 仅用于 UI 显示进度条，不参与完成判断逻辑（完成由 completeExpr 决定）
     */
    progressMetricKey?: string;
    /** 进度目标值（可选），例如 10 表示“杀 10 只怪” */
    progressTarget?: number;

    /** 前置任务 ID（任务链），前置未 Completed 时本任务强制 Locked */
    preTaskId?: TaskId;

    /** 限时任务：起始时间（秒，Unix 时间戳，0/undefined 表示不限制） */
    startTime?: number;
    /** 限时任务：结束时间（秒，超出后如果未完成则标记 Failed） */
    endTime?: number;

    /** Locked 状态时是否在列表中隐藏（否则以灰色展示） */
    isHiddenBeforeUnlock?: boolean;
}

/** 运行时任务状态，存储 + 运行逻辑 都用这个结构 */
export interface TaskRuntimeState {
    config: TaskConfig;
    state: TaskState;
    /** 进度值（通常来自 progressMetricKey 对应的 metric） */
    progressValue: number;
    /** 上次状态更新时间（秒） */
    lastUpdateTime: number;
}

/* ======================= 成就 ======================= */

export enum AchievementCategory {
    General = 0, // 通用
    Battle = 1,  // 战斗相关
    Growth = 2,  // 养成相关
    Social = 3,  // 社交相关
}

export interface AchievementConfig {
    id: number;

    titleKey: string;
    descKey: string;
    rewardTextKey?: string;

    /** 分类，用于 UI Tab 分组 */
    category?: AchievementCategory;

    sortOrder?: number;

    /**
     * 完成条件表达式：
     * - 语法与 TaskConfig.completeExpr 相同
     * - 成就是自动跟踪，不需要“接受”
     */
    completeExpr: string;

    /** 成就点数，用于汇总展示（可选） */
    score?: number;

    /** 是否在未解锁前隐藏（否则以灰色展示） */
    isHiddenBeforeUnlock?: boolean;
}

export interface AchievementRuntimeState {
    config: AchievementConfig;
    /** 是否已经完成（达到条件） */
    completed: boolean;
    /** 是否有未领取奖励（如果该成就有奖励的话） */
    canReward: boolean;
    lastUpdateTime: number;
}

