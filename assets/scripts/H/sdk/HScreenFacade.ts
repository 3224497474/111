import { view } from 'cc';
import type { HPlatformFacade } from './platform/HPlatformFacade';
import type {
    HResolvedPlatform,
    HSafeAreaInfo,
    HSafeAreaInsets,
    HScreenAdaptOptions,
    HScreenAdaptResult,
    HScreenFitMode,
    HScreenInfo,
    HScreenInitOptions,
    HSystemInfo,
} from '../HTypes';

/**
 * HScreenFacade 负责屏幕尺寸、安全区和设计分辨率适配。
 *
 * 排查 UI 适配问题时建议看：
 * 1. refresh/buildInfo：当前平台返回的 screen/window/safeArea 是否正确。
 * 2. getAdaptResult：设计分辨率、fitMode 和 uiScale 的计算结果。
 * 3. applyDesignResolution：是否真正写入 Cocos view.setDesignResolutionSize。
 */
const DEFAULT_SCREEN_OPTIONS: Required<Pick<HScreenInitOptions, 'designWidth' | 'designHeight' | 'fitMode'>> = {
    designWidth: 720,
    designHeight: 1280,
    fitMode: 'auto',
};

const RESOLUTION_POLICY = {
    exactFit: 0,
    noBorder: 1,
    showAll: 2,
    fixedHeight: 3,
    fixedWidth: 4,
};

export class HScreenFacade {
    private options: HScreenInitOptions = { ...DEFAULT_SCREEN_OPTIONS };
    private platformFacade: HPlatformFacade | null = null;
    private info: HScreenInfo | null = null;
    private initialized = false;

    // 初始化时先用 Cocos view 构造一份信息，再异步刷新平台 systemInfo。
    public init(options: HScreenInitOptions = {}, platformFacade?: HPlatformFacade): void {
        this.options = {
            ...DEFAULT_SCREEN_OPTIONS,
            ...options,
            designWidth: this.normalizePositive(options.designWidth, DEFAULT_SCREEN_OPTIONS.designWidth),
            designHeight: this.normalizePositive(options.designHeight, DEFAULT_SCREEN_OPTIONS.designHeight),
            fitMode: options.fitMode || DEFAULT_SCREEN_OPTIONS.fitMode,
        };
        this.platformFacade = platformFacade || null;
        this.initialized = true;
        this.info = this.buildInfo();

        if (options.applyDesignResolution) {
            this.applyDesignResolution(options);
        }
        if (options.autoRefresh !== false) {
            void this.refresh();
        }
    }

    public async refresh(): Promise<HScreenInfo> {
        this.ensureInit();
        let systemInfo: HSystemInfo | undefined;
        try {
            systemInfo = await this.platformFacade?.getSystemInfo();
        } catch {
            systemInfo = undefined;
        }

        this.info = this.buildInfo(systemInfo);
        return this.clone(this.info);
    }

    // 返回当前屏幕快照的拷贝，避免外部直接修改框架内部状态。
    public getInfo(): HScreenInfo {
        this.ensureInit();
        if (!this.info) {
            this.info = this.buildInfo();
        }
        return this.clone(this.info);
    }

    // 只计算适配结果，不修改 Cocos 设计分辨率，适合 UI 根据 scale/safeArea 做布局。
    public getAdaptResult(options: HScreenAdaptOptions = {}): HScreenAdaptResult {
        const info = this.getInfo();
        const designWidth = this.normalizePositive(options.designWidth, this.options.designWidth || DEFAULT_SCREEN_OPTIONS.designWidth);
        const designHeight = this.normalizePositive(options.designHeight, this.options.designHeight || DEFAULT_SCREEN_OPTIONS.designHeight);
        const fitMode = options.fitMode || this.options.fitMode || DEFAULT_SCREEN_OPTIONS.fitMode;
        const scaleX = info.visibleWidth / designWidth;
        const scaleY = info.visibleHeight / designHeight;
        const uiScale = this.clampScale(this.resolveScale(fitMode, scaleX, scaleY, info.visibleAspect, designWidth / designHeight), options);
        const contentWidth = info.visibleWidth / uiScale;
        const contentHeight = info.visibleHeight / uiScale;

        return {
            ...info,
            designWidth,
            designHeight,
            fitMode,
            scaleX,
            scaleY,
            uiScale,
            contentWidth,
            contentHeight,
            extraWidth: Math.max(0, contentWidth - designWidth),
            extraHeight: Math.max(0, contentHeight - designHeight),
        };
    }

    // 写入 Cocos 设计分辨率，并返回写入后的最新适配结果。
    public applyDesignResolution(options: HScreenAdaptOptions = {}): HScreenAdaptResult {
        const result = this.getAdaptResult(options);
        const policy = this.getResolutionPolicy(result.fitMode, result.visibleAspect, result.designWidth / result.designHeight);
        (view as any).setDesignResolutionSize?.(result.designWidth, result.designHeight, policy);
        this.info = this.buildInfo(this.info?.rawSystemInfo);
        return this.getAdaptResult({
            designWidth: result.designWidth,
            designHeight: result.designHeight,
            fitMode: result.fitMode,
            minScale: options.minScale,
            maxScale: options.maxScale,
        });
    }

    // 汇总 Cocos 可视尺寸、平台系统信息和安全区，形成统一 HScreenInfo。
    private buildInfo(systemInfo?: HSystemInfo): HScreenInfo {
        const visibleSize = view.getVisibleSize();
        const designSize = view.getDesignResolutionSize();
        const frameSize = (view as any).getFrameSize?.() || visibleSize;
        const platform = systemInfo?.platform || this.platformFacade?.getPlatform() || 'mock';
        const screenWidth = this.normalizePositive(systemInfo?.screenWidth, frameSize.width || visibleSize.width);
        const screenHeight = this.normalizePositive(systemInfo?.screenHeight, frameSize.height || visibleSize.height);
        const windowWidth = this.normalizePositive(systemInfo?.windowWidth, screenWidth);
        const windowHeight = this.normalizePositive(systemInfo?.windowHeight, screenHeight);
        const safeArea = this.normalizeSafeArea(systemInfo?.safeArea, windowWidth, windowHeight);
        const safeAreaInsets = this.getSafeAreaInsets(safeArea, windowWidth, windowHeight);
        const safeAreaInsetsVisible = this.convertInsetsToVisible(safeAreaInsets, windowWidth, windowHeight, visibleSize.width, visibleSize.height);
        const statusBarHeight = this.normalizeNumber(systemInfo?.statusBarHeight, safeAreaInsets.top);

        return {
            platform,
            screenWidth,
            screenHeight,
            windowWidth,
            windowHeight,
            visibleWidth: visibleSize.width,
            visibleHeight: visibleSize.height,
            designWidth: designSize.width,
            designHeight: designSize.height,
            frameWidth: frameSize.width || visibleSize.width,
            frameHeight: frameSize.height || visibleSize.height,
            pixelRatio: this.normalizePositive(systemInfo?.pixelRatio, 1),
            statusBarHeight,
            safeArea,
            safeAreaInsets,
            safeAreaInsetsVisible,
            screenAspect: screenWidth / screenHeight,
            windowAspect: windowWidth / windowHeight,
            visibleAspect: visibleSize.width / visibleSize.height,
            isPortrait: windowHeight >= windowWidth,
            isLandscape: windowWidth > windowHeight,
            hasNotch: safeAreaInsets.top > statusBarHeight || safeAreaInsets.bottom > 0 || safeAreaInsets.left > 0 || safeAreaInsets.right > 0,
            rawSystemInfo: systemInfo,
        };
    }

    // 没有 safeArea 时默认整块 window 都是安全区域。
    private normalizeSafeArea(safeArea: HSafeAreaInfo | undefined, windowWidth: number, windowHeight: number): HSafeAreaInfo {
        if (!safeArea) {
            return {
                left: 0,
                right: windowWidth,
                top: 0,
                bottom: windowHeight,
                width: windowWidth,
                height: windowHeight,
            };
        }

        const left = this.normalizeNumber(safeArea.left, 0);
        const top = this.normalizeNumber(safeArea.top, 0);
        const width = this.normalizePositive(safeArea.width, windowWidth - left);
        const height = this.normalizePositive(safeArea.height, windowHeight - top);
        return {
            left,
            top,
            width,
            height,
            right: this.normalizePositive(safeArea.right, left + width),
            bottom: this.normalizePositive(safeArea.bottom, top + height),
        };
    }

    private getSafeAreaInsets(safeArea: HSafeAreaInfo, windowWidth: number, windowHeight: number): HSafeAreaInsets {
        return {
            left: Math.max(0, safeArea.left),
            right: Math.max(0, windowWidth - safeArea.right),
            top: Math.max(0, safeArea.top),
            bottom: Math.max(0, windowHeight - safeArea.bottom),
        };
    }

    private convertInsetsToVisible(
        insets: HSafeAreaInsets,
        windowWidth: number,
        windowHeight: number,
        visibleWidth: number,
        visibleHeight: number,
    ): HSafeAreaInsets {
        const scaleX = visibleWidth / Math.max(1, windowWidth);
        const scaleY = visibleHeight / Math.max(1, windowHeight);
        return {
            left: insets.left * scaleX,
            right: insets.right * scaleX,
            top: insets.top * scaleY,
            bottom: insets.bottom * scaleY,
        };
    }

    // fitMode 决定 uiScale：fit-width/fit-height/cover/show-all/auto。
    private resolveScale(
        fitMode: HScreenFitMode,
        scaleX: number,
        scaleY: number,
        visibleAspect: number,
        designAspect: number,
    ): number {
        if (fitMode === 'fit-width') {
            return scaleX;
        }
        if (fitMode === 'fit-height') {
            return scaleY;
        }
        if (fitMode === 'cover') {
            return Math.max(scaleX, scaleY);
        }
        if (fitMode === 'show-all') {
            return Math.min(scaleX, scaleY);
        }
        return visibleAspect <= designAspect ? scaleX : scaleY;
    }

    private getResolutionPolicy(fitMode: HScreenFitMode, visibleAspect: number, designAspect: number): number {
        if (fitMode === 'fit-width') {
            return RESOLUTION_POLICY.fixedWidth;
        }
        if (fitMode === 'fit-height') {
            return RESOLUTION_POLICY.fixedHeight;
        }
        if (fitMode === 'cover') {
            return RESOLUTION_POLICY.noBorder;
        }
        if (fitMode === 'show-all') {
            return RESOLUTION_POLICY.showAll;
        }
        return visibleAspect <= designAspect ? RESOLUTION_POLICY.fixedWidth : RESOLUTION_POLICY.fixedHeight;
    }

    private clampScale(scale: number, options: HScreenAdaptOptions): number {
        const minScale = typeof options.minScale === 'number' ? options.minScale : 0;
        const maxScale = typeof options.maxScale === 'number' && options.maxScale > 0 ? options.maxScale : Number.POSITIVE_INFINITY;
        return Math.max(minScale, Math.min(maxScale, Math.max(0.0001, scale)));
    }

    private normalizePositive(value: unknown, fallback: number): number {
        const numeric = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
    }

    private normalizeNumber(value: unknown, fallback: number): number {
        const numeric = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(numeric) ? numeric : fallback;
    }

    private clone<T>(value: T): T {
        return JSON.parse(JSON.stringify(value)) as T;
    }

    private ensureInit(): void {
        if (!this.initialized) {
            this.init();
        }
    }
}
