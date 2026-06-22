import type { Node } from 'cc';
import type { HStoreChange, HStoreSetOptions, HStoreState, HStoreWatchOptions } from '../../store/HStoreTypes';

/**
 * UI 数据绑定目标类型。
 *
 * 说明：
 * - label：把数据写入 Label.string。
 * - rich-text：把数据写入 RichText.string。
 * - active：把数据转成 boolean 后写入 Node.active。
 * - opacity：把数据转成 0-255 后写入 UIOpacity.opacity。
 * - progress：把数据转成 0-1 后写入 ProgressBar.progress。
 * - toggle：把数据转成 boolean 后写入 Toggle.isChecked。
 * - edit-box：把数据写入 EditBox.string。
 * - sprite-frame：把 SpriteFrame 写入 Sprite.spriteFrame。
 * - color：把 Color 写入 Label/Sprite 的 color。
 * - custom：交给自定义 apply 函数处理。
 */
export type HUIBindingTargetKind =
    | 'label'
    | 'rich-text'
    | 'active'
    | 'opacity'
    | 'progress'
    | 'toggle'
    | 'edit-box'
    | 'sprite-frame'
    | 'color'
    | 'custom';

/**
 * UI 数据绑定方向。
 *
 * 说明：
 * - one-way：Store -> UI，推荐默认模式。
 * - two-way：Store <-> UI，只建议用于 Toggle/EditBox 这类明确输入控件。
 */
export type HUIBindingMode = 'one-way' | 'two-way';

/**
 * UI 数据绑定值格式化函数。
 *
 * @param value 类型 unknown，作用是 Store 中读出的原始字段值。
 * @param state 类型 HStoreState，作用是当前模块完整数据副本。
 * @param binding 类型 HUIBindingConfig，作用是当前绑定配置。
 * @returns 类型 unknown，返回最终写入 UI 组件的值。
 */
export type HUIBindingFormatter = (
    value: unknown,
    state: HStoreState,
    binding: HUIBindingConfig,
) => unknown;

/**
 * UI 数据绑定自定义写入函数。
 *
 * @param value 类型 unknown，作用是已经经过 formatter/template 处理后的值。
 * @param context 类型 HUIBindingApplyContext，作用是提供节点、Store、绑定配置等上下文。
 */
export type HUIBindingApplyHandler = (value: unknown, context: HUIBindingApplyContext) => void;

/**
 * UI 数据绑定自定义回写函数。
 *
 * @param value 类型 unknown，作用是从 UI 控件读取到的值。
 * @param context 类型 HUIBindingApplyContext，作用是提供 Store、绑定配置等上下文。
 */
export type HUIBindingReadHandler = (value: unknown, context: HUIBindingApplyContext) => unknown;

/**
 * UI 数据绑定配置。
 *
 * 设计目标：
 * - 业务 UI 只声明 module/path/target，不主动拉数据。
 * - 框架在 UI 打开时监听 Store，Store 脏字段刷新时自动更新对应节点。
 */
export interface HUIBindingConfig {
    /** 类型 string。作用：Store 模块名，例如 user、bag、task。 */
    module: string;

    /** 类型 string。作用：模块内字段路径，例如 coin、profile.nickName。 */
    path: string;

    /** 类型 Node。作用：直接指定要写入的目标节点，优先级最高。 */
    node?: Node | null;

    /** 类型 string。作用：从当前 UI 根节点开始按路径查找节点，例如 top/coinLabel。 */
    nodePath?: string;

    /** 类型 string。作用：从当前 UI 根节点递归查找指定名字节点，例如 coinLabel。 */
    nodeName?: string;

    /** 类型 HUIBindingTargetKind。作用：声明写入目标组件或节点属性。 */
    target?: HUIBindingTargetKind;

    /** 类型 HUIBindingMode。作用：声明单向或双向绑定，默认 one-way。 */
    mode?: HUIBindingMode;

    /** 类型 unknown。作用：Store 字段不存在时使用的默认值。 */
    defaultValue?: unknown;

    /** 类型 string。作用：模板格式化，例如 "金币：{value}"。 */
    template?: string;

    /** 类型 number。作用：数值格式保留小数位，undefined 表示不处理。 */
    digits?: number;

    /** 类型 boolean。作用：写入 boolean 目标前是否取反。 */
    invert?: boolean;

    /** 类型 boolean。作用：是否监听子路径变化，默认 true。 */
    includeChildren?: boolean;

    /** 类型 boolean。作用：绑定启动时是否立即刷新一次，默认 true。 */
    immediate?: boolean;

    /** 类型 HStoreWatchOptions。作用：透传给 H.store.watch 的监听选项。 */
    watchOptions?: HStoreWatchOptions;

    /** 类型 HUIBindingFormatter。作用：代码侧自定义格式化。 */
    formatter?: HUIBindingFormatter;

    /** 类型 HUIBindingApplyHandler。作用：完全自定义写入 UI 的逻辑。 */
    apply?: HUIBindingApplyHandler;

    /** 类型 HUIBindingReadHandler。作用：双向绑定回写前处理 UI 控件值。 */
    read?: HUIBindingReadHandler;

    /** 类型 string。作用：调试日志中展示的绑定名称。 */
    debugName?: string;
}

/**
 * UI 数据绑定运行时记录。
 */
export interface HUIBindingRecord {
    /** 类型 number。作用：绑定唯一运行时 id。 */
    id: number;

    /** 类型 HUIBindingConfig。作用：标准化后的绑定配置。 */
    binding: HUIBindingConfig;

    /** 类型 Node | null。作用：已经解析好的目标节点，避免刷新时重复查找。 */
    node: Node | null;

    /** 类型 boolean。作用：是否已经注册 UI -> Store 的回写事件。 */
    writeBackConnected: boolean;

    /** 类型 Array<() => void>。作用：清理该绑定产生的事件和监听。 */
    disposers: Array<() => void>;
}

/**
 * UI 数据绑定写入上下文。
 */
export interface HUIBindingApplyContext {
    /** 类型 HUIBindingConfig。作用：当前绑定配置。 */
    binding: HUIBindingConfig;

    /** 类型 HUIBindingRecord。作用：当前绑定运行时记录。 */
    record: HUIBindingRecord;

    /** 类型 Node。作用：当前写入目标节点。 */
    node: Node;

    /** 类型 HStoreState。作用：当前 Store 模块完整数据。 */
    state: HStoreState;

    /** 类型 HStoreChange | null。作用：触发本次刷新的 Store 变化，手动刷新时为 null。 */
    change: HStoreChange | null;

    /** 类型 (value, options?) => void。作用：双向绑定回写 Store。 */
    setValue: (value: unknown, options?: HStoreSetOptions) => void;
}

/**
 * UI 数据绑定 Watcher 初始化参数。
 */
export interface HUIBindingWatcherOptions {
    /** 类型 string。作用：绑定拥有者名称，通常是 UI id。 */
    owner?: string;

    /** 类型 boolean。作用：是否输出绑定调试日志。 */
    debug?: boolean;
}
