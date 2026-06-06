/**
 * 红点系统模块入口
 * 
 * 统一导出红点系统所有模块
 */

// 类型定义
export {
    RedPointType,
    RedPointAnimation,
    AggregateRule,
    RefreshStrategy,
    PersistType,
    ResetRule,
} from './RedPointTypes';

export type {
    IRedPointConfig,
    IRedPointState,
    IRedPointSaveData,
    RedPointCallback,
} from './RedPointTypes';

// Key枚举
export {
    RedPointKey,
    RED_POINT_KEY_GROUPS,
    getAllRedPointKeys,
    getRedPointKeyDisplayName,
} from './RedPointKeys';

// 管理器
export { RedPointManagerV2, RedPointMgr } from './RedPointManagerV2';

// 组件
export { RedPointItemV2, RedPointDisplayType } from './RedPointItemV2';
