import type {
    HClipboardOptions,
    HFavoriteGuideOptions,
    HResolvedPlatform,
    HRevisitGuideOptions,
    HSDKActionResult,
    HSDKFeature,
    HSDKInitOptions,
    HSDKLoginResult,
    HSDKSourceFlags,
    HShareMenuOptions,
    HShareOptions,
    HShortcutOptions,
    HSidebarOptions,
} from '../HTypes';

export type HSDKLifecycleListener = (raw?: unknown) => void;

/**
 * 小游戏平台 SDK 适配接口。
 * 新渠道只要实现这个接口，HSDKFacade 就能通过统一入口调用登录、分享、收藏、侧边栏、添加桌面等能力。
 */
export interface HMiniGameSDKAdapter {
    readonly platform: HResolvedPlatform;
    init(config: HSDKInitOptions): void;
    hasFeature(feature: HSDKFeature): boolean;
    login(): Promise<HSDKLoginResult>;
    restartProgram(): HSDKActionResult;
    getLaunchOptions(): unknown;
    getEnterOptions(): unknown;
    getSourceFlags(): HSDKSourceFlags;
    setShareMenu(options?: HShareMenuOptions): HSDKActionResult;
    hideShareMenu(): HSDKActionResult;
    share(options?: HShareOptions): Promise<HSDKActionResult>;
    copyText(text: string, options?: HClipboardOptions): Promise<HSDKActionResult>;
    triggerGC(): HSDKActionResult;
    showFavoriteGuide(options?: HFavoriteGuideOptions): Promise<HSDKActionResult>;
    showRevisitGuide(options?: HRevisitGuideOptions): Promise<HSDKActionResult>;
    checkSidebar(options?: HSidebarOptions): Promise<HSDKActionResult>;
    navigateToSidebar(options?: HSidebarOptions): Promise<HSDKActionResult>;
    checkShortcut(options?: HShortcutOptions): Promise<HSDKActionResult>;
    addShortcut(options?: HShortcutOptions): Promise<HSDKActionResult>;
    onShow(listener: HSDKLifecycleListener): void;
    offShow(listener: HSDKLifecycleListener): void;
    onHide(listener: HSDKLifecycleListener): void;
    offHide(listener: HSDKLifecycleListener): void;
}
