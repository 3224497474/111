import type { Node } from 'cc';
import type { HEventBus } from '../core/HEventBus';
import type { HStoreFacade } from '../store/HStoreFacade';
import type { HUIBindingConfig } from './binding/HUIBindingTypes';

/**
 * UI 框架公共类型集中在这里。
 * 查路由、层级、缓存、遮罩、动画、Loading 策略和 UI 事件字段时，优先看这个文件。
 */
export enum UIRoute {
    ToastTip = 'ToastTip',
    GuideMask = 'GuideMask',
    GlobalLoading = 'GlobalLoading',
}

export enum UILayer {
    Layer1 = 'layer1',
    Layer2 = 'layer2',
    Layer3 = 'layer3',
    Layer4 = 'layer4',
    Layer5 = 'layer5',
    Tip = 'tip',
    Guide = 'guide',
    Transition = 'transition',
}

// 路由 id 支持枚举和字符串，方便项目既能统一枚举，也能临时注册字符串路由。
export type HUIRouteId = UIRoute | string;

// 层级既支持框架标准层，也支持项目扩展层。
export type HUILayerName = UILayer | string;

// destroy: 关闭就销毁；hide: 关闭隐藏并缓存；keep: 常驻缓存，低内存是否清理由策略决定。
export type HUICacheMode = 'destroy' | 'hide' | 'keep';

// type 决定默认层级、默认动画、默认遮罩和默认缓存策略。
export type HUIType = 'page' | 'dialog' | 'tip' | 'loading' | 'guide' | 'custom';

// 关闭原因会传给 onBeforeClose/onClose，也会进入 UI 埋点事件。
export type HUICloseReason = 'api' | 'bgclose' | 'mask' | 'back' | 'auto' | 'force';
export type HUILowMemoryStrategy = 'destroy-hidden' | 'destroy-hidden-and-keep' | 'none';
export type HUIAutoClearScope = 'disable' | 'remove';

// UI 全局事件用于统计打开耗时、关闭原因、缓存清理和资源释放。
export type HUIEventType =
    | 'ui_open_start'
    | 'ui_open_end'
    | 'ui_open_fail'
    | 'ui_close_start'
    | 'ui_close_end'
    | 'ui_close_cancel'
    | 'ui_cache_trim'
    | 'ui_resource_release';
export type HUIStatus =
    | 'idle'
    | 'binding'
    | 'opening'
    | 'opened'
    | 'refreshing'
    | 'disabling'
    | 'closing'
    | 'closed'
    | 'removed'
    | 'destroyed';

export type HUIAnimationType =
    | 'none'
    | 'fade'
    | 'scale'
    | 'fade-scale'
    | 'slide-up'
    | 'slide-down'
    | 'slide-left'
    | 'slide-right';

export interface HUIAnimationConfig {
    open?: HUIAnimationType;
    close?: HUIAnimationType;
    duration?: number;
    openDuration?: number;
    closeDuration?: number;
    distance?: number;
}

// 慢加载 Loading 策略：延迟显示、最短显示和自定义 Loading 路由都由框架统一处理。
export interface HUIOpenLoadingPolicy {
    enabled?: boolean;
    loadingId?: HUIRouteId;
    delayMs?: number;
    minShowMs?: number;
    message?: string;
    params?: any;
}

export type UIOpenLoadingPolicy = HUIOpenLoadingPolicy;

export interface HUIMaskColor {
    r: number;
    g: number;
    b: number;
    a?: number;
}

export type HUICloseSoundPlayer = (sound: string, reason: HUICloseReason, config: HUIConfig) => void;

export interface HUIEventListenOptions {
    clearOn?: HUIAutoClearScope;
    owner?: string;
}

export interface HUITimerOptions {
    repeat?: boolean;
    immediate?: boolean;
    clearOn?: HUIAutoClearScope;
}

// 声明式数据依赖。UI 打开时框架自动订阅，关闭时自动断开。
export interface HUIModelWatchConfig {
    module: string;
    paths?: string | string[];
    immediate?: boolean;
    includeChildren?: boolean;
    once?: boolean;
}

// 资源策略控制隐藏缓存上限、prefab/bundle 释放以及低内存清理范围。
export interface HUIResourcePolicy {
    maxHiddenRecords?: number;
    releasePrefabOnDestroy?: boolean;
    releaseBundleOnUnused?: boolean;
    lowMemoryStrategy?: HUILowMemoryStrategy;
}

export interface HUIEvent {
    name: HUIEventType;
    id: string;
    type?: HUIType;
    layer?: HUILayerName;
    reason?: HUICloseReason | string;
    durationMs?: number;
    timestamp: number;
    config?: HUIConfig;
    error?: unknown;
}

export type HUIEventListener = (event: HUIEvent) => void;

// 单个 UI 路由的完整配置。业务打开 UI 时，大部分行为都应该通过这里声明。
export interface HUIConfig {
    id: HUIRouteId;
    type?: HUIType;
    layer?: HUILayerName;
    prefabPath?: string;
    bundle?: string;
    scriptName?: string;

    singleton?: boolean;
    cacheMode?: HUICacheMode;
    exclusive?: boolean;
    mutexGroup?: string;
    group?: string;

    blockInput?: boolean;
    showMask?: boolean;
    closeOnMask?: boolean;
    closeOnBack?: boolean;
    closeOnBgClose?: boolean;
    closeThrottleMs?: number;
    closeStopPropagation?: boolean;
    closeSound?: string;
    bgCloseName?: string;
    restorePreviousDialog?: boolean;
    maskOpacity?: number;
    maskColor?: HUIMaskColor;

    order?: number;
    priority?: number;
    animation?: HUIAnimationType | HUIAnimationConfig;
    autoRemoveMs?: number;
    openLoading?: boolean | HUIOpenLoadingPolicy;
    modelWatches?: HUIModelWatchConfig[];
    dataBindings?: HUIBindingConfig[];
    dataBindingDebug?: boolean;
}

export interface HUIOpenOptions extends HUIConfig {
    node?: Node;
    parent?: Node;
    params?: any;
    silent?: boolean;
}

export type HUIRouteConfigMap = Record<string, HUIConfig>;
export type HUIRouteConfigInput = HUIRouteConfigMap | HUIConfig[];

// H.ui.init(root, options) 的初始化参数，通常在 Loading 阶段统一注入。
export interface HUIInitOptions {
    layerOrder?: Partial<Record<UILayer, number>> & Record<string, number>;
    persistRoot?: boolean;
    routes?: HUIRouteConfigInput;
    configs?: HUIRouteConfigInput;
    defaultLoadingId?: HUIRouteId;
    openLoading?: boolean | HUIOpenLoadingPolicy;
    closeSoundPlayer?: HUICloseSoundPlayer;
    resource?: HUIResourcePolicy;
    eventReporter?: HUIEventListener;
}

export interface HUIViewBindContext<TParams = any> {
    id: string;
    config: HUIConfig;
    params?: TParams;
    manager: unknown;
    store?: HStoreFacade | null;
    eventBus?: HEventBus | null;
}
