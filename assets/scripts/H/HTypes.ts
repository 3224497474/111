import type { Asset, Node } from 'cc';

export type HPlatformType = 'auto' | 'wechat' | 'douyin' | 'mock';
export type HResolvedPlatform = 'wechat' | 'douyin' | 'mock' | 'unknown';

export type HUILayerName = 'layer1' | 'layer2' | 'layer3' | 'layer4' | 'transition' | 'tip';
export type HUICacheMode = 'destroy' | 'hide' | 'keep';
export type HUIType = 'page' | 'dialog' | 'loading' | 'tip' | 'custom';
export type HUIStatus = 'idle' | 'opening' | 'opened' | 'hiding' | 'closed' | 'destroyed';
export type HUIAnimationType =
    | 'none'
    | 'fade'
    | 'scale'
    | 'fade-scale'
    | 'slide-up'
    | 'slide-down'
    | 'slide-left'
    | 'slide-right';
export type HResourcePhase = 'critical' | 'preload' | 'background';
export type HResourceAssetKind = 'Asset' | 'Prefab' | 'SpriteFrame' | 'Texture2D' | 'AudioClip' | 'JsonAsset';
export type HResourceAssetType<T extends Asset = Asset> = new (...args: any[]) => T;
export type HResourceProgressListener = (finished: number, total: number, task: HResourceTask) => void;
export type HTransitionAnimation = 'none' | 'dots' | 'bar' | 'dots-bar';

export interface HInitOptions {
    uiRoot?: Node;
    ui?: HUIInitOptions;
    data?: HDataInitOptions;
    redDot?: HRedDotInitOptions;
    platform?: HPlatformInitOptions;
    ad?: HAdInitConfig;
    resource?: HResourceInitOptions;
    transition?: HTransitionInitOptions;
}

export interface HDataInitOptions {
    namespace?: string;
    flushDelayMs?: number;
    debug?: boolean;
    version?: number;
    storageMode?: HDataStorageMode;
    snapshotKey?: string;
    autoLoadLocal?: boolean;
    modules?: HDataModuleConfig[];
}

export interface HDataSetOptions {
    immediate?: boolean;
}

export type HDataStorageMode = 'module' | 'snapshot' | 'both';

export interface HDataModuleConfig<T = any> {
    name: string;
    defaultValue?: T;
    autoLoad?: boolean;
    version?: number;
    migrate?: (stored: unknown, fromVersion: number, toVersion: number) => T;
}

export interface HDataSnapshot {
    version: number;
    namespace: string;
    updatedAt: number;
    modules: Record<string, unknown>;
}

export interface HDataImportOptions {
    immediate?: boolean;
    merge?: boolean;
}

export interface HUIInitOptions {
    layerOrder?: Partial<Record<HUILayerName, number>>;
    persistRoot?: boolean;
    configs?: HUIConfig[];
    defaultLoadingId?: string;
}

export interface HUIConfig {
    id: string;
    layer?: HUILayerName;
    type?: HUIType;
    prefabPath?: string;
    bundle?: string;
    group?: string;
    mutexGroup?: string;
    cacheMode?: HUICacheMode;
    singleton?: boolean;
    exclusive?: boolean;
    blockBack?: boolean;
    order?: number;
    scriptName?: string;
    animation?: HUIAnimationType | HUIAnimationConfig;
}

export interface HUIAnimationConfig {
    open?: HUIAnimationType;
    close?: HUIAnimationType;
    duration?: number;
    openDuration?: number;
    closeDuration?: number;
    distance?: number;
}

export interface HUIOpenOptions extends HUIConfig {
    node?: Node;
    parent?: Node;
    params?: any;
    restorePreviousDialog?: boolean;
    silent?: boolean;
}

export interface HUIRecord {
    id: string;
    layer: HUILayerName;
    type: HUIType;
    node: Node;
    mutexGroup: string;
    group?: string;
    cacheMode: HUICacheMode;
    prefabPath?: string;
    bundle?: string;
    config: HUIConfig;
    script: HUILifecycle | null;
    params?: any;
    blockBack?: boolean;
    loaded?: boolean;
    closing?: boolean;
}

export interface HUILifecycle {
    uiId?: string;
    uiPanelId?: string;
    dialogPath?: string;
    uiConfig?: HUIConfig | null;
    uiParams?: any;
    uiStatus?: HUIStatus;
    bindUIContext?: (id: string, config: HUIConfig) => void;
    openUI?: (params?: any) => void;
    hideUI?: () => void;
    closeUI?: () => void;
    onUILoad?: (params?: any) => void;
    onUIOpen?: (params?: any) => void;
    onUIShow?: () => void;
    onUIHide?: () => void;
    onUIClose?: () => void;
    onUIRefresh?: (params?: any) => void;
    onUIBack?: () => boolean;
    show?: (params?: any) => void;
    hide?: () => void;
    updateInfo?: () => void;
    setMessage?: (message: string) => void;
    setProgress?: (progress: number) => void;
}

export interface HResourceTask<T extends Asset = Asset> {
    key?: string;
    path: string;
    bundle?: string;
    assetType?: HResourceAssetKind;
    type?: HResourceAssetType<T>;
    phase?: HResourcePhase;
    cache?: boolean;
    preloadOnly?: boolean;
}

export interface HResourceBundleTask {
    enabled?: boolean;
    name: string;
    phase?: HResourcePhase;
    note?: string;
}

export interface HResourceInitOptions {
    profile?: HResourceProfile;
    criticalBundles?: HResourceBundleTask[];
    preloadBundles?: HResourceBundleTask[];
    backgroundBundles?: HResourceBundleTask[];
    critical?: HResourceTask[];
    preload?: HResourceTask[];
    background?: HResourceTask[];
    backgroundConcurrency?: number;
    debug?: boolean;
}

export interface HResourceProfileItem {
    enabled?: boolean;
    key?: string;
    path: string;
    bundle?: string;
    assetType?: HResourceAssetKind;
    cache?: boolean;
    preloadOnly?: boolean;
    note?: string;
}

export interface HResourceProfile {
    name?: string;
    debug?: boolean;
    backgroundConcurrency?: number;
    criticalBundles?: HResourceBundleTask[];
    preloadBundles?: HResourceBundleTask[];
    backgroundBundles?: HResourceBundleTask[];
    critical?: HResourceProfileItem[];
    preload?: HResourceProfileItem[];
    background?: HResourceProfileItem[];
}

export interface HResourceBatchResult {
    ok: boolean;
    total: number;
    completed: number;
    failed: number;
    errors: Array<{
        task: HResourceTask;
        error: unknown;
    }>;
}

export interface HResourceBundleBatchResult {
    ok: boolean;
    total: number;
    completed: number;
    failed: number;
    errors: Array<{
        task: HResourceBundleTask;
        error: unknown;
    }>;
}

export interface HTransitionInitOptions {
    title?: string;
    message?: string;
    animation?: HTransitionAnimation;
    minShowMs?: number;
}

export interface HTransitionShowOptions extends HTransitionInitOptions {
    progress?: number;
}

export type HTransitionProgressSetter = (progress: number, message?: string) => void;

export interface HRedDotDefineOptions {
    persist?: boolean;
    compute?: () => boolean | number;
}

export type HRedDotStoredValue = boolean | number;
export type HRedDotListener = (visible: boolean, key: string, count: number) => void;

export interface HRedDotInitOptions {
    storageModuleName?: string;
    autoLoadLocal?: boolean;
    persistByDefault?: boolean;
}

export interface HRedDotExportData {
    values: Record<string, HRedDotStoredValue>;
}

export interface HPlatformInitOptions {
    platform?: HPlatformType;
    debug?: boolean;
}

export interface HLoginResult {
    ok: boolean;
    platform: HResolvedPlatform;
    code?: string;
    anonymousCode?: string;
    errorMessage?: string;
    raw?: unknown;
}

export interface HSettingResult {
    ok: boolean;
    platform: HResolvedPlatform;
    authSetting: Record<string, boolean>;
    raw?: unknown;
}

export interface HUserProfile {
    authorized: boolean;
    platform: HResolvedPlatform;
    nickName: string;
    avatarUrl: string;
    city?: string;
    province?: string;
    country?: string;
    gender?: number;
    raw?: unknown;
}

export interface HLocationInfo {
    authorized: boolean;
    platform: HResolvedPlatform;
    latitude?: number;
    longitude?: number;
    speed?: number;
    accuracy?: number;
    city?: string;
    province?: string;
    country?: string;
    raw?: unknown;
}

export interface HSystemInfo {
    platform: HResolvedPlatform;
    brand?: string;
    model?: string;
    system?: string;
    version?: string;
    SDKVersion?: string;
    screenWidth?: number;
    screenHeight?: number;
    raw?: unknown;
}

export interface HAdPlatformIds {
    reward?: Record<string, string>;
    interstitial?: Record<string, string>;
    banner?: Record<string, string>;
}

export interface HAdIds {
    wechat?: HAdPlatformIds;
    douyin?: HAdPlatformIds;
    mock?: HAdPlatformIds;
}

export interface HAdMockConfig {
    rewardResult?: 'success' | 'cancelled' | 'no-fill' | 'timeout' | 'platform-error';
    delayMs?: number;
}

export interface HAdInterstitialPolicy {
    launchDelayMs?: number;
    intervalMs?: number;
    afterRewardMs?: number;
}

export interface HAdInitConfig {
    platform?: HPlatformType;
    ids?: HAdIds;
    debug?: boolean;
    rewardTimeoutMs?: number;
    mock?: HAdMockConfig;
    interstitial?: HAdInterstitialPolicy;
    placementAliasMap?: Record<string, string>;
}

export type HAdType = 'reward' | 'interstitial' | 'banner';

export type HAdFailReason =
    | 'busy'
    | 'cooldown'
    | 'unavailable'
    | 'config-missing'
    | 'platform-unsupported'
    | 'adunit-empty'
    | 'no-fill'
    | 'frequency-limit'
    | 'cancelled'
    | 'timeout'
    | 'platform-error';

export interface HAdBannerOptions {
    position?: 'bottom-center' | 'top-center' | 'custom';
    left?: number;
    top?: number;
    width?: number;
    widthRatio?: number;
    adIntervals?: number;
}

export interface HAdBaseResult {
    ok: boolean;
    shown: boolean;
    type: HAdType;
    placement: string;
    rawPlacement?: string;
    platform: HResolvedPlatform;
    reason?: HAdFailReason;
    userMessage?: string;
    errorCode?: string | number;
    errorMessage?: string;
    raw?: unknown;
}

export interface HAdRewardResult extends HAdBaseResult {
    type: 'reward';
    rewarded: boolean;
    completed: boolean;
}

export interface HAdShowResult extends HAdBaseResult {
    type: 'interstitial' | 'banner';
}

export type HAdRewardCallback = (result: HAdRewardResult) => void;
