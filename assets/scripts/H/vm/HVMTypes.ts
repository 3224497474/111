import type { HStoreChange, HStoreSetOptions, HStoreState, HStoreWatchOptions } from '../store/HStoreTypes';

/**
 * VM tag 类型。
 *
 * 说明：
 * - 框架不内置 user、bag、task 这类项目业务 tag。
 * - 项目层应该定义自己的枚举，例如 ProjectVMTag.User = 'user'。
 */
export type HVMTagLike = string | number;

/**
 * VM 字段路径类型。
 *
 * 说明：
 * - 推荐项目层也用枚举定义字段路径，例如 UserVMPath.Coin = 'coin'。
 */
export type HVMPathLike = string | number;

/**
 * VM 监听唯一 id。
 *
 * 每次 H.vm.watch / H.vm.watchPath / H.vm.bindPath 都会返回一个数字 id。
 */
export type HVMWatchId = number;

/**
 * VM 生命周期状态。
 *
 * created：已经注册模型，但还未明确激活。
 * active：允许派发监听和 UI 刷新。
 * inactive：暂停派发监听，数据仍可读写。
 * removed：VM 门面引用已移除，监听也会被清理。
 */
export type HVMStatus = 'created' | 'active' | 'inactive' | 'removed';

/**
 * VM 初始化配置。
 */
export interface HVMInitOptions {
    /** 类型 boolean。作用：是否输出 VM 调试日志。 */
    debug?: boolean;
}

/**
 * VM.add 注册配置。
 */
export interface HVMAddOptions<TState extends HStoreState = HStoreState> {
    /** 类型 boolean。作用：是否持久化到 H.data，默认跟随 H.store 配置。 */
    persist?: boolean;

    /** 类型 string。作用：自定义本地存储模块名。 */
    storageName?: string;

    /** 类型 boolean。作用：是否自动读取本地数据。 */
    autoLoad?: boolean;

    /** 类型 boolean。作用：tag 已存在时是否覆盖注册。 */
    overwrite?: boolean;

    /** 类型 TState。作用：默认数据，未传时使用 data。 */
    defaultValue?: TState;

    /** 类型 boolean。作用：注册后是否立即激活监听派发，默认 true。 */
    active?: boolean;
}

/**
 * VM 生命周期快照。
 */
export interface HVMLifecycleInfo {
    /** 类型 string。作用：VM tag。 */
    tag: string;

    /** 类型 HVMStatus。作用：当前生命周期状态。 */
    status: HVMStatus;

    /** 类型 number。作用：创建时间戳。 */
    createdAt: number;

    /** 类型 number。作用：最近一次激活时间戳。 */
    activeAt: number;

    /** 类型 number。作用：最近一次暂停时间戳。 */
    inactiveAt: number;

    /** 类型 number。作用：移除时间戳。 */
    removedAt: number;
}

/**
 * VM 路径解析结果。
 */
export interface HVMPathInfo {
    /** 类型 string。作用：完整路径，例如 user.coin。 */
    fullPath: string;

    /** 类型 string。作用：VM tag，也就是 H.store 模块名。 */
    tag: string;

    /** 类型 string。作用：tag 之后的字段路径，例如 coin。 */
    path: string;

    /** 类型 string[]。作用：拆分后的完整路径数组，例如 ['user', 'coin']。 */
    pathArray: string[];
}

/**
 * VM 路径监听回调上下文。
 */
export interface HVMWatchContext<TValue = unknown, TState extends HStoreState = HStoreState> {
    /** 类型 HVMWatchId。作用：当前监听 id。 */
    id: HVMWatchId;

    /** 类型 HVMPathInfo。作用：当前监听路径信息。 */
    path: HVMPathInfo;

    /** 类型 TValue。作用：当前字段值。 */
    value: TValue;

    /** 类型 TValue | undefined。作用：上一次字段值。 */
    previousValue?: TValue;

    /** 类型 HStoreChange<TState> | undefined。作用：H.store 原始变化；immediate 刷新时为空。 */
    change?: HStoreChange<TState>;
}

/**
 * VM 路径监听函数。
 *
 * @param value 类型 TValue，作用是当前字段值。
 * @param previousValue 类型 TValue | undefined，作用是上一次字段值。
 * @param context 类型 HVMWatchContext，作用是提供监听 id、路径、原始 Store 变化等上下文。
 */
export type HVMWatchListener<TValue = unknown, TState extends HStoreState = HStoreState> = (
    value: TValue,
    previousValue: TValue | undefined,
    context: HVMWatchContext<TValue, TState>,
) => void;

/**
 * 兼容第三方 VM.bindPath 的回调形式。
 *
 * @param value 类型 TValue，作用是当前字段值。
 * @param previousValue 类型 TValue | undefined，作用是上一次字段值。
 * @param pathArray 类型 string[]，作用是完整路径数组，例如 ['user', 'coin']。
 */
export type HVMLegacyBindListener<TValue = unknown> = (
    value: TValue,
    previousValue: TValue | undefined,
    pathArray: string[],
) => void;

/**
 * VM 监听选项。
 */
export interface HVMWatchOptions extends HStoreWatchOptions {
    /** 类型 boolean。作用：是否允许监听完整 tag 根路径，例如 user。 */
    allowRootPath?: boolean;
}

/**
 * VM 写入选项。
 */
export type HVMSetOptions = HStoreSetOptions;

/**
 * VM 监听记录。
 */
export interface HVMWatchRecord {
    /** 类型 HVMWatchId。作用：监听唯一 id。 */
    id: HVMWatchId;

    /** 类型 HVMPathInfo。作用：监听路径信息。 */
    path: HVMPathInfo;

    /** 类型 Function。作用：原始监听函数，便于按 path + callback 取消。 */
    listener: Function;

    /** 类型 any。作用：调用方 thisArg，便于兼容第三方 VM.bindPath 风格。 */
    target?: any;

    /** 类型 boolean。作用：是否只触发一次。 */
    once: boolean;

    /** 类型 boolean。作用：是否监听子路径变化。 */
    includeChildren: boolean;
}
