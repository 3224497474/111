import type { Node } from 'cc';
import type { HEventBus } from '../../core/HEventBus';
import type { HUIFacade } from '../HUIFacade';
import type { HUICloseReason, HUIOpenOptions, HUIRouteId } from '../HUITypes';

/**
 * Tab 数字 id。
 *
 * 类型：number。
 * 作用：用于定位当前选中的底部 Tab，例如 1=首页、2=任务、3=商店。
 * 说明：框架推荐使用数字 id，方便策划表、服务器配置、埋点和存档统一表达。
 */
export type HUITabId = number;

/**
 * Tab 切换原因。
 *
 * 类型：字符串联合类型。
 * init：初始化或默认打开。
 * click：玩家点击底部 Tab。
 * api：业务代码主动调用 switchTo。
 * restore：恢复上次打开状态。
 */
export type HUITabSwitchReason = 'init' | 'click' | 'api' | 'restore';

/**
 * 单个 Tab 的配置。
 *
 * 作用：建立“数字 tabId -> UI 页面路由 pageId -> 普通 tab 节点”的关系。
 */
export interface HUITabConfig {
    /**
     * Tab 唯一数字 id。
     *
     * 类型：HUITabId(number)。
     * 作用：定位当前 Tab，例如 1=首页、2=任务、3=商店。
     */
    id: HUITabId;

    /**
     * 当前 Tab 对应的 UI 路由 id。
     *
     * 类型：HUIRouteId。
     * 作用：切换到这个 Tab 时，HUITabRouter 会通过 H.ui.open 打开这个页面。
     */
    pageId: HUIRouteId;

    /**
     * Tab 标题。
     *
     * 类型：string | undefined。
     * 作用：如果 Tab 节点下存在 label/title/text 文本节点，HUITabBar 会自动同步标题。
     */
    title?: string;

    /**
     * Tab 节点名。
     *
     * 类型：string | undefined。
     * 作用：当不希望按子节点顺序绑定 Tab 时，可通过节点名精确绑定。
     */
    nodeName?: string;

    /**
     * Tab 节点引用。
     *
     * 类型：Node | undefined。
     * 作用：运行时动态创建 Tab 节点时，可以直接传入节点引用。
     */
    node?: Node;

    /**
     * 打开页面时的默认参数。
     *
     * 类型：any。
     * 作用：调用 switchTo 时如果没有传 params，就使用这里的参数打开 pageId 对应页面。
     */
    params?: any;

    /**
     * 页面打开配置。
     *
     * 类型：Partial<HUIOpenOptions> | undefined。
     * 作用：传给 H.ui.open，例如 layer、cacheMode、animation、openLoading 等。
     */
    openOptions?: Partial<HUIOpenOptions>;

    /**
     * 是否默认选中。
     *
     * 类型：boolean | undefined。
     * 作用：多个 Tab 同时配置 default=true 时，框架取排序后的第一个。
     */
    default?: boolean;

    /**
     * 是否禁用。
     *
     * 类型：boolean | undefined。
     * 作用：disabled=true 时，Tab 不响应点击，也不会被 HUITabRouter 切换。
     */
    disabled?: boolean;

    /**
     * 是否显示 Tab 节点。
     *
     * 类型：boolean | undefined。
     * 作用：visible=false 时隐藏对应 Tab 节点，但配置仍保留。
     */
    visible?: boolean;

    /**
     * 排序值。
     *
     * 类型：number | undefined。
     * 作用：按普通子节点自动绑定时，用于稳定 Tab 顺序。
     */
    order?: number;
}

/**
 * Tab 切换请求。
 *
 * 作用：当业务层希望把切换请求包装成对象时使用。
 */
export interface HUITabSwitchRequest {
    /** 类型：HUITabId(number)。作用：目标 Tab id。 */
    tabId: HUITabId;

    /** 类型：any。作用：打开目标页面时传入的参数。 */
    params?: any;

    /** 类型：HUITabSwitchReason。作用：记录本次切换来源。 */
    reason?: HUITabSwitchReason;

    /** 类型：boolean。作用：是否强制切换，true 时允许重复切换到当前 Tab。 */
    force?: boolean;
}

/**
 * Tab 切换完成后的变化信息。
 *
 * 作用：用于 onChanged 回调、事件派发和业务统计。
 */
export interface HUITabChange {
    /** 类型：HUITabId(number)。作用：上一个 Tab id；没有上一个时为 0。 */
    previousId: HUITabId;

    /** 类型：HUITabId(number)。作用：当前 Tab id。 */
    currentId: HUITabId;

    /** 类型：HUITabConfig | null。作用：上一个 Tab 配置；没有上一个时为 null。 */
    previousConfig: HUITabConfig | null;

    /** 类型：HUITabConfig。作用：当前 Tab 配置。 */
    currentConfig: HUITabConfig;

    /** 类型：HUITabSwitchReason。作用：本次切换来源。 */
    reason: HUITabSwitchReason;

    /** 类型：Node | null。作用：本次打开的页面节点；切换失败或未打开时为 null。 */
    pageNode: Node | null;
}

/**
 * Tab 切换结果。
 *
 * 作用：switchTo/openDefault 的返回值，业务可根据 changed 判断是否真的发生了切换。
 */
export interface HUITabSwitchResult extends HUITabChange {
    /** 类型：boolean。作用：true 表示成功切换到了新 Tab。 */
    changed: boolean;
}

/**
 * 切换前拦截函数。
 *
 * 参数：
 * next 类型 HUITabConfig，表示将要切换到的 Tab 配置。
 * previous 类型 HUITabConfig | null，表示当前 Tab 配置。
 * reason 类型 HUITabSwitchReason，表示切换来源。
 *
 * 返回值：
 * boolean | Promise<boolean>，返回 false 时阻止切换。
 */
export type HUITabBeforeSwitchHandler = (
    next: HUITabConfig,
    previous: HUITabConfig | null,
    reason: HUITabSwitchReason,
) => boolean | Promise<boolean>;

/**
 * 切换完成回调。
 *
 * 参数：
 * change 类型 HUITabChange，表示本次切换的完整变化信息。
 */
export type HUITabChangedHandler = (change: HUITabChange) => void;

/**
 * HUITabRouter 初始化参数。
 *
 * 作用：控制 Tab 页面切换行为。
 */
export interface HUITabRouterOptions {
    /** 类型：HUIFacade | null | undefined。作用：UI 门面实例，默认由 HUITabBar 注入 this.manager。 */
    ui?: HUIFacade | null;

    /** 类型：HEventBus | null | undefined。作用：事件总线，切换完成后用于派发 ui:tab_changed。 */
    eventBus?: HEventBus | null;

    /** 类型：HUITabId(number) | undefined。作用：默认打开的 Tab id。 */
    defaultTabId?: HUITabId;

    /** 类型：boolean | undefined。作用：切换 Tab 时是否关闭上一个页面。 */
    closePrevious?: boolean;

    /** 类型：HUICloseReason | undefined。作用：关闭上一个页面时传入的关闭原因。 */
    previousCloseReason?: HUICloseReason;

    /** 类型：boolean | undefined。作用：是否允许重复切换到当前 Tab。 */
    allowRepeatSwitch?: boolean;

    /** 类型：HUITabBeforeSwitchHandler | undefined。作用：切换前拦截，例如等级不足、功能未解锁。 */
    beforeSwitch?: HUITabBeforeSwitchHandler;

    /** 类型：HUITabChangedHandler | undefined。作用：切换完成回调。 */
    onChanged?: HUITabChangedHandler;
}

/**
 * HUITabBar 初始化参数。
 *
 * 作用：在 Router 切页能力之外，补充底部 Tab 节点表现和点击控制。
 */
export interface HUITabBarOptions extends HUITabRouterOptions {
    /** 类型：number | undefined。作用：点击节流毫秒数，防止快速连点造成页面队列抖动。 */
    switchThrottleMs?: number;

    /** 类型：boolean | undefined。作用：是否允许重复点击当前 Tab。 */
    allowRepeatClick?: boolean;

    /** 类型：boolean | undefined。作用：未拖入 tabNodes 时，是否自动使用 tabRoot 的直接子节点。 */
    autoCollectNodes?: boolean;

    /** 类型：boolean | undefined。作用：onEnableView 阶段是否自动打开默认 Tab。 */
    autoSwitch?: boolean;
}
