import type { Asset, Node } from 'cc';
import type { HStoreInitOptions } from './store/HStoreTypes';
import type { HUIInitOptions } from './ui/HUITypes';

export type HPlatformType = 'auto' | 'wechat' | 'douyin' | '4399' | 'web' | 'mock';
export type HResolvedPlatform = 'wechat' | 'douyin' | '4399' | 'web' | 'mock' | 'unknown';

export type HResourcePhase = 'critical' | 'preload' | 'background';
export type HResourceAssetKind = 'Asset' | 'Prefab' | 'SpriteFrame' | 'Texture2D' | 'AudioClip' | 'JsonAsset';
export type HResourceAssetType<T extends Asset = Asset> = new (...args: any[]) => T;
export type HResourceProgressListener = (finished: number, total: number, task: HResourceTask) => void;
export type HTransitionAnimation = 'none' | 'dots' | 'bar' | 'dots-bar';

export interface HInitOptions {
    uiRoot?: Node;
    ui?: HUIInitOptions;
    data?: HDataInitOptions;
    store?: HStoreInitOptions;
    redDot?: HRedDotInitOptions;
    platform?: HPlatformInitOptions;
    ad?: HAdInitConfig;
    sdk?: HSDKInitOptions;
    session?: HSessionTimerInitOptions;
    screen?: HScreenInitOptions;
    config?: HConfigInitOptions;
    analytics?: HAnalyticsInitOptions;
    reward?: HRewardInitOptions;
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
    pixelRatio?: number;
    screenWidth?: number;
    screenHeight?: number;
    windowWidth?: number;
    windowHeight?: number;
    statusBarHeight?: number;
    safeArea?: HSafeAreaInfo;
    raw?: unknown;
}

export interface HSafeAreaInfo {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
}

export interface HSafeAreaInsets {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export type HScreenFitMode = 'auto' | 'fit-width' | 'fit-height' | 'show-all' | 'cover';

export interface HScreenInitOptions {
    designWidth?: number;
    designHeight?: number;
    fitMode?: HScreenFitMode;
    autoRefresh?: boolean;
    applyDesignResolution?: boolean;
}

export interface HScreenAdaptOptions {
    designWidth?: number;
    designHeight?: number;
    fitMode?: HScreenFitMode;
    minScale?: number;
    maxScale?: number;
}

export interface HScreenInfo {
    platform: HResolvedPlatform;
    screenWidth: number;
    screenHeight: number;
    windowWidth: number;
    windowHeight: number;
    visibleWidth: number;
    visibleHeight: number;
    designWidth: number;
    designHeight: number;
    frameWidth: number;
    frameHeight: number;
    pixelRatio: number;
    statusBarHeight: number;
    safeArea: HSafeAreaInfo;
    safeAreaInsets: HSafeAreaInsets;
    safeAreaInsetsVisible: HSafeAreaInsets;
    screenAspect: number;
    windowAspect: number;
    visibleAspect: number;
    isPortrait: boolean;
    isLandscape: boolean;
    hasNotch: boolean;
    rawSystemInfo?: HSystemInfo;
}

export interface HScreenAdaptResult extends HScreenInfo {
    fitMode: HScreenFitMode;
    scaleX: number;
    scaleY: number;
    uiScale: number;
    contentWidth: number;
    contentHeight: number;
    extraWidth: number;
    extraHeight: number;
}

export type HSessionTaskCallback = () => void;

export interface HSessionTimerInitOptions {
    defaultCooldownMs?: number;
}

export interface HSessionSnapshot {
    enterAt: number;
    lastShowAt: number;
    lastHideAt: number;
    onlineDurationMs: number;
    foreground: boolean;
}

export interface HSessionCooldownState {
    allowed: boolean;
    remainingMs: number;
    lastAt: number;
}

export type HSDKActionType =
    | 'login'
    | 'share'
    | 'favorite'
    | 'revisit'
    | 'sidebar-check'
    | 'sidebar-navigate'
    | 'shortcut-check'
    | 'shortcut-add';

export type HSDKActionReason =
    | 'busy'
    | 'cooldown'
    | 'cancelled'
    | 'failed'
    | 'not-completed'
    | 'platform-unsupported'
    | 'config-missing'
    | 'timeout'
    | 'unknown';

export type HSDKRewardPolicy = 'none' | 'api-success' | 'callback-success' | 'completed';

export interface HSDKActionResult {
    ok: boolean;
    completed: boolean;
    rewardable: boolean;
    platform: HResolvedPlatform;
    action: HSDKActionType;
    reason?: HSDKActionReason;
    userMessage?: string;
    errorCode?: string | number;
    errorMessage?: string;
    raw?: unknown;
}

export interface HSDKLoginResult extends HSDKActionResult {
    action: 'login';
    code?: string;
    anonymousCode?: string;
    login?: HLoginResult;
}

export interface HSDKActionOptions {
    rewardPolicy?: HSDKRewardPolicy;
    cooldownKey?: string;
    cooldownMs?: number;
    timeoutMs?: number;
}

export interface HShareOptions extends HSDKActionOptions {
    title?: string;
    imageUrl?: string;
    query?: string;
    templateId?: string;
    channel?: string;
    extra?: Record<string, unknown>;
}

export interface HShareMenuOptions {
    withShareTicket?: boolean;
    menus?: string[];
    title?: string;
    imageUrl?: string;
    query?: string;
    extra?: Record<string, unknown>;
}

export interface HFavoriteGuideOptions extends HSDKActionOptions {
    type?: string;
    content?: string;
    position?: string;
    extra?: Record<string, unknown>;
}

export interface HRevisitGuideOptions extends HSDKActionOptions {
    scene?: string;
    content?: string;
    extra?: Record<string, unknown>;
}

export interface HSidebarOptions extends HSDKActionOptions {
    scene?: string;
    extra?: Record<string, unknown>;
}

export interface HShortcutOptions extends HSDKActionOptions {
    extra?: Record<string, unknown>;
}

export interface HSDKInitOptions {
    debug?: boolean;
    actionTimeoutMs?: number;
    actionCooldownMs?: number;
    actionCooldowns?: Record<string, number>;
    sessionStorageModuleName?: string;
    autoSaveLogin?: boolean;
    shareMenu?: HShareMenuOptions;
}

export interface HSDKSessionSaveData {
    platform: HResolvedPlatform;
    login: HSDKLoginResult | null;
    launchOptions?: unknown;
    enterOptions?: unknown;
    updatedAt: number;
}

export type HSDKFeature =
    | 'login'
    | 'rewardAd'
    | 'interstitialAd'
    | 'bannerAd'
    | 'share'
    | 'favorite'
    | 'revisit'
    | 'sidebar'
    | 'shortcut'
    | 'recordVideo'
    | 'leaderboard'
    | 'payment'
    | 'customerService';

export type HFeatureMap = Partial<Record<HSDKFeature, boolean>>;

export interface HPlatformSDKConfig {
    appId?: string;
    ads?: HAdPlatformIds;
    features?: HFeatureMap;
}

export interface HSDKConfigData {
    env?: 'dev' | 'test' | 'release' | string;
    platforms?: Partial<Record<HResolvedPlatform, HPlatformSDKConfig>>;
    share?: Record<string, HShareOptions>;
    cooldown?: Record<string, number>;
    switches?: Record<string, boolean>;
    features?: Partial<Record<HResolvedPlatform, HFeatureMap>>;
}

export interface HConfigInitOptions {
    local?: HSDKConfigData;
    remote?: Partial<HSDKConfigData>;
    storageModuleName?: string;
    autoLoadLocal?: boolean;
}

export interface HAnalyticsEvent {
    name: string;
    data?: Record<string, unknown>;
    platform: HResolvedPlatform;
    timestamp: number;
    sessionDurationMs?: number;
}

export interface HAnalyticsPlatformReportOptions {
    enabled?: boolean;
    allowEvents?: string[];
    denyEvents?: string[];
    eventNameMap?: Record<string, string>;
    sampleRate?: number;
    maxDataKeys?: number;
    maxStringLength?: number;
}

export type HAnalyticsReportReason =
    | 'disabled'
    | 'filtered'
    | 'sampled'
    | 'invalid-name'
    | 'platform-unsupported'
    | 'platform-error';

export interface HAnalyticsReportResult {
    ok: boolean;
    platform: HResolvedPlatform;
    name: string;
    reportName?: string;
    reason?: HAnalyticsReportReason;
    errorMessage?: string;
    raw?: unknown;
}

export interface HAnalyticsInitOptions {
    debug?: boolean;
    persist?: boolean;
    storageModuleName?: string;
    maxCachedEvents?: number;
    platformReport?: boolean | HAnalyticsPlatformReportOptions;
    uploader?: (events: HAnalyticsEvent[]) => Promise<void> | void;
}

export interface HAnalyticsSaveData {
    events: HAnalyticsEvent[];
    updatedAt: number;
}

export type HRewardReason =
    | 'sdk-not-completed'
    | 'ad-not-rewarded'
    | 'cooldown'
    | 'daily-limit'
    | 'duplicated'
    | 'server-rejected'
    | 'network-error'
    | 'config-disabled'
    | 'failed';

export interface HRewardResult {
    ok: boolean;
    granted: boolean;
    duplicated: boolean;
    rewardScene: string;
    rewardId: string;
    reason?: HRewardReason;
    userMessage?: string;
    raw?: unknown;
}

export interface HRewardBaseOptions {
    rewardScene: string;
    rewardId: string;
    cooldownKey?: string;
    cooldownMs?: number;
    once?: boolean;
    dailyLimit?: number;
    switchKey?: string;
}

export interface HRewardAdClaimOptions extends HRewardBaseOptions {
    placement: string;
}

export interface HRewardSDKActionClaimOptions extends HRewardBaseOptions {
    action: () => Promise<HSDKActionResult>;
}

export interface HRewardInitOptions {
    storageModuleName?: string;
    defaultCooldownMs?: number;
    debug?: boolean;
}

export interface HRewardRecord {
    rewardScene: string;
    rewardId: string;
    count: number;
    dailyCount: Record<string, number>;
    lastClaimAt: number;
}

export interface HRewardSaveData {
    records: Record<string, HRewardRecord>;
    updatedAt: number;
}

export interface HAdPlatformIds {
    reward?: Record<string, string>;
    interstitial?: Record<string, string>;
    banner?: Record<string, string>;
}

export interface HAdIds {
    wechat?: HAdPlatformIds;
    douyin?: HAdPlatformIds;
    '4399'?: HAdPlatformIds;
    web?: HAdPlatformIds;
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

export interface HAdRewardPolicy {
    intervalMs?: number;
}

export interface HAdInitConfig {
    platform?: HPlatformType;
    ids?: HAdIds;
    debug?: boolean;
    rewardTimeoutMs?: number;
    mock?: HAdMockConfig;
    reward?: HAdRewardPolicy;
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

export interface HAdPreloadResult {
    ok: boolean;
    ready: boolean;
    type: 'reward';
    placement: string;
    platform: HResolvedPlatform;
    reason?: HAdFailReason;
    userMessage?: string;
    errorCode?: string | number;
    errorMessage?: string;
    raw?: unknown;
}

export interface HAdPlacementStats {
    requests: number;
    preloads: number;
    preloadSuccess: number;
    preloadFail: number;
    shows: number;
    rewards: number;
    cancels: number;
    fails: number;
    noFill: number;
    cooldownBlocks: number;
    lastReason?: HAdFailReason;
    lastErrorMessage?: string;
    lastEventAt: number;
}

export interface HAdStats {
    requests: number;
    preloads: number;
    preloadSuccess: number;
    preloadFail: number;
    shows: number;
    rewards: number;
    cancels: number;
    fails: number;
    noFill: number;
    cooldownBlocks: number;
    byPlacement: Record<string, HAdPlacementStats>;
}

export type HAdRewardCallback = (result: HAdRewardResult) => void;
