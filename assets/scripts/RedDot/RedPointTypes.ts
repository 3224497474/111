/**
 * 红点系统类型定义
 * 
 * 支持：
 * - 多种红点类型（布尔、数值、时间、动画、图标）
 * - 聚合规则
 * - 持久化配置
 */

/**
 * 红点类型枚举
 */
export enum RedPointType {
    /** 布尔型：显示/隐藏 */
    Boolean = 'boolean',
    /** 数值型：显示数量 */
    Number = 'number',
    /** 时间型：限时显示 */
    Time = 'time',
    /** 动画型：带呼吸/闪烁效果 */
    Animation = 'animation',
    /** 图标型：自定义图标 */
    Icon = 'icon',
}

/**
 * 动画类型枚举
 */
export enum RedPointAnimation {
    /** 无动画 */
    None = 'none',
    /** 呼吸效果 */
    Breath = 'breath',
    /** 闪烁效果 */
    Blink = 'blink',
    /** 脉冲效果 */
    Pulse = 'pulse',
    /** 弹跳效果 */
    Bounce = 'bounce',
}

/**
 * 聚合规则枚举
 */
export enum AggregateRule {
    /** 求和 */
    Sum = 'sum',
    /** 取最大值 */
    Max = 'max',
    /** 任意为真即显示 */
    Any = 'any',
    /** 全部为真才显示 */
    All = 'all',
}

/**
 * 刷新策略枚举
 */
export enum RefreshStrategy {
    /** 立即刷新 */
    Immediate = 'immediate',
    /** 延迟刷新（批量） */
    Deferred = 'deferred',
    /** 下一帧刷新 */
    NextFrame = 'nextFrame',
}

/**
 * 持久化类型枚举
 */
export enum PersistType {
    /** 不持久化 */
    None = 'none',
    /** 本地存储 */
    Local = 'local',
    /** 服务器同步 */
    Server = 'server',
}

/**
 * 重置规则枚举
 */
export enum ResetRule {
    /** 不重置 */
    Never = 'never',
    /** 每日重置 */
    Daily = 'daily',
    /** 每周重置 */
    Weekly = 'weekly',
    /** 每月重置 */
    Monthly = 'monthly',
}

/**
 * 红点配置接口
 */
export interface IRedPointConfig {
    /** 唯一标识 */
    id: string;
    /** 红点类型 */
    type: RedPointType;
    /** 显示文本（数值型使用） */
    displayText?: string;
    /** 最大显示值（超过显示 99+） */
    maxValue?: number;
    /** 动画类型 */
    animation?: RedPointAnimation;
    /** 自定义图标路径 */
    iconPath?: string;
    /** 父节点ID */
    parentId?: string;
    /** 聚合规则 */
    aggregateRule?: AggregateRule;
    /** 持久化类型 */
    persistType?: PersistType;
    /** 重置规则 */
    resetRule?: ResetRule;
    /** 开始时间戳（限时红点） */
    startTime?: number;
    /** 结束时间戳（限时红点） */
    endTime?: number;
    /** 条件表达式 */
    condition?: string;
}

/**
 * 红点状态接口
 */
export interface IRedPointState {
    /** 配置ID */
    id: string;
    /** 原始值 */
    value: number;
    /** 聚合值 */
    totalValue: number;
    /** 是否可见 */
    visible: boolean;
    /** 最后更新时间 */
    lastUpdateTime: number;
    /** 是否脏（需要刷新） */
    dirty: boolean;
}

/**
 * 红点数据（用于持久化）
 */
export interface IRedPointSaveData {
    /** 红点值 */
    values: Record<string, number>;
    /** 重置时间记录 */
    resetTimes: Record<string, number>;
    /** 最后登录时间 */
    lastLoginTime: number;
}

/**
 * 红点回调类型
 */
export type RedPointCallback = (state: IRedPointState) => void;
