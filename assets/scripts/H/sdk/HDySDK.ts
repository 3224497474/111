import type {
    HClipboardOptions,
    HFavoriteGuideOptions,
    HRevisitGuideOptions,
    HSDKActionResult,
    HSDKLoginResult,
    HSDKSourceFlags,
    HShareMenuOptions,
    HShareOptions,
    HShortcutOptions,
    HSidebarOptions,
} from '../HTypes';
import { HBaseSDK } from './HBaseSDK';

/**
 * 抖音小游戏 SDK adapter。
 *
 * 这里保留官方 API 调用形态，方便和抖音小游戏文档逐项对照：
 * - tt.login({ success, fail })
 * - tt.checkScene({ scene: 'sidebar', success, fail })
 * - tt.navigateToScene({ scene: 'sidebar', success, fail })
 * - tt.checkShortcut({ success, fail }) / tt.addShortcut({ success, fail })
 * - tt.showFavoriteGuide / tt.showRevisitGuide / tt.shareAppMessage
 */
export class HDySDK extends HBaseSDK {
    public readonly platform = 'douyin' as const;

    public getApi(): any {
        return (globalThis as any).tt;
    }

    public login(): Promise<HSDKLoginResult> {
        const tt = this.getApi();
        if (!tt?.login) {
            return Promise.resolve(this.loginFail('platform-unsupported', 'tt.login unsupported'));
        }

        return this.callOfficialCallbackApi<HSDKLoginResult>(
            'login',
            ({ success, fail }) => tt.login({
                success: (res: any) => {
                    if (res?.code || res?.anonymousCode) {
                        success(res);
                        return;
                    }
                    fail({
                        ...res,
                        errMsg: res?.errMsg || 'tt.login success but code is empty',
                    });
                },
                fail: (err: any) => fail(err),
            }),
            (raw) => this.loginSuccess(raw),
            (reason, raw, errorMessage) => this.loginFail(reason, errorMessage, raw),
        );
    }

    public getSourceFlags(): HSDKSourceFlags {
        const launchOptions = this.getLaunchOptions();
        const enterOptions = this.getEnterOptions();
        const base = this.parseSourceFlags(launchOptions, enterOptions);
        const scene = this.getSceneText(launchOptions, enterOptions);

        return {
            ...base,
            // 抖音侧边栏复访常用场景值：021036；抖音极速版侧边栏：101036。
            fromSidebar: base.fromSidebar || scene === '021036' || scene === '101036',
            // 桌面快捷方式常用场景值：021020 / 101020；头条系也可能出现 011020 / 061020。
            fromDesk: base.fromDesk || scene === '021020' || scene === '101020' || scene === '011020' || scene === '061020',
            rawLaunchOptions: launchOptions,
            rawEnterOptions: enterOptions,
        };
    }

    public restartProgram(): HSDKActionResult {
        const tt = this.getApi();
        try {
            if (tt?.restartMiniProgramSync) {
                tt.restartMiniProgramSync();
                return this.actionSuccess('restart', undefined, true);
            }
            if (tt?.restartMiniProgram) {
                tt.restartMiniProgram();
                return this.actionSuccess('restart', undefined, true);
            }
            return this.unsupported('restart');
        } catch (error: any) {
            return this.actionFail('restart', 'failed', error, error?.errCode || error?.errno, error?.errMsg || error?.message);
        }
    }

    public setShareMenu(options: HShareMenuOptions = {}): HSDKActionResult {
        const tt = this.getApi();
        if (!tt?.showShareMenu && !tt?.onShareAppMessage) {
            return this.unsupported('share');
        }

        const shareInfo = this.buildSharePayload(options);
        try {
            tt.showShareMenu?.({
                withShareTicket: options.withShareTicket,
                menus: options.menus,
                ...(options.extra || {}),
            });
            tt.onShareAppMessage?.(() => shareInfo);
            return this.actionSuccess('share', undefined, true);
        } catch (error: any) {
            return this.actionFail('share', 'failed', error, error?.errCode || error?.errno, error?.errMsg || error?.message);
        }
    }

    public hideShareMenu(): HSDKActionResult {
        const tt = this.getApi();
        if (!tt?.hideShareMenu) {
            return this.unsupported('share');
        }

        try {
            tt.hideShareMenu();
            return this.actionSuccess('share', undefined, true);
        } catch (error: any) {
            return this.actionFail('share', 'failed', error, error?.errCode || error?.errno, error?.errMsg || error?.message);
        }
    }

    public share(options: HShareOptions = {}): Promise<HSDKActionResult> {
        const tt = this.getApi();
        if (!tt?.shareAppMessage) {
            return Promise.resolve(this.unsupported('share'));
        }

        const shareInfo = this.buildSharePayload(options);
        return this.callOfficialCallbackApi<HSDKActionResult>(
            'share',
            ({ success, fail }) => tt.shareAppMessage({
                ...shareInfo,
                success: (res: any) => success(res),
                fail: (err: any) => fail(err),
            }),
            (raw) => this.completedResult('share', raw, true),
            (reason, raw, errorMessage) => this.actionFail('share', reason, raw, (raw as any)?.errCode || (raw as any)?.errno, errorMessage),
        );
    }

    public copyText(text: string, options: HClipboardOptions = {}): Promise<HSDKActionResult> {
        const tt = this.getApi();
        if (!tt?.setClipboardData) {
            return Promise.resolve(this.unsupported('clipboard-copy'));
        }

        return this.callOfficialCallbackApi<HSDKActionResult>(
            'clipboard-copy',
            ({ success, fail }) => tt.setClipboardData({
                data: text,
                ...(options.extra || {}),
                success: (res: any) => success(res),
                fail: (err: any) => fail(err),
            }),
            (raw) => this.completedResult('clipboard-copy', raw, true),
            (reason, raw, errorMessage) => this.actionFail('clipboard-copy', reason, raw, (raw as any)?.errCode || (raw as any)?.errno, errorMessage),
        );
    }

    public triggerGC(): HSDKActionResult {
        const tt = this.getApi();
        if (!tt?.triggerGC) {
            return this.unsupported('gc');
        }

        try {
            tt.triggerGC();
            return this.actionSuccess('gc', undefined, true);
        } catch (error: any) {
            return this.actionFail('gc', 'failed', error, error?.errCode || error?.errno, error?.errMsg || error?.message);
        }
    }

    public showFavoriteGuide(options: HFavoriteGuideOptions = {}): Promise<HSDKActionResult> {
        const tt = this.getApi();
        if (!tt?.showFavoriteGuide) {
            return Promise.resolve(this.unsupported('favorite'));
        }

        return this.callOfficialCallbackApi<HSDKActionResult>(
            'favorite',
            ({ success, fail }) => tt.showFavoriteGuide({
                type: options.type,
                content: options.content,
                position: options.position,
                ...(options.extra || {}),
                success: (res: any) => success(res),
                fail: (err: any) => fail(err),
            }),
            (raw) => this.completedResult('favorite', raw, true),
            (reason, raw, errorMessage) => this.actionFail('favorite', reason, raw, (raw as any)?.errCode || (raw as any)?.errno, errorMessage),
        );
    }

    public showRevisitGuide(options: HRevisitGuideOptions = {}): Promise<HSDKActionResult> {
        const tt = this.getApi();
        if (!tt?.showRevisitGuide) {
            return Promise.resolve(this.unsupported('revisit'));
        }

        return this.callOfficialCallbackApi<HSDKActionResult>(
            'revisit',
            ({ success, fail }) => tt.showRevisitGuide({
                scene: options.scene,
                content: options.content,
                ...(options.extra || {}),
                success: (res: any) => success(res),
                fail: (err: any) => fail(err),
            }),
            (raw) => this.completedResult('revisit', raw, true),
            (reason, raw, errorMessage) => this.actionFail('revisit', reason, raw, (raw as any)?.errCode || (raw as any)?.errno, errorMessage),
        );
    }

    public checkSidebar(options: HSidebarOptions = {}): Promise<HSDKActionResult> {
        const tt = this.getApi();
        if (!tt?.checkScene) {
            return Promise.resolve(this.unsupported('sidebar-check'));
        }

        return this.callOfficialCallbackApi<HSDKActionResult>(
            'sidebar-check',
            ({ success, fail }) => tt.checkScene({
                scene: options.scene || 'sidebar',
                ...(options.extra || {}),
                success: (res: any) => success(res),
                fail: (err: any) => fail(err),
            }),
            (raw) => this.completedResult('sidebar-check', raw, true),
            (reason, raw, errorMessage) => this.actionFail('sidebar-check', reason, raw, (raw as any)?.errCode || (raw as any)?.errno, errorMessage),
        );
    }

    public navigateToSidebar(options: HSidebarOptions = {}): Promise<HSDKActionResult> {
        const tt = this.getApi();
        if (!tt?.navigateToScene) {
            return Promise.resolve(this.unsupported('sidebar-navigate'));
        }

        return this.callOfficialCallbackApi<HSDKActionResult>(
            'sidebar-navigate',
            ({ success, fail }) => tt.navigateToScene({
                scene: options.scene || 'sidebar',
                ...(options.extra || {}),
                success: (res: any) => success(res),
                fail: (err: any) => fail(err),
            }),
            (raw) => this.completedResult('sidebar-navigate', raw, true),
            (reason, raw, errorMessage) => this.actionFail('sidebar-navigate', reason, raw, (raw as any)?.errCode || (raw as any)?.errno, errorMessage),
        );
    }

    public checkShortcut(options: HShortcutOptions = {}): Promise<HSDKActionResult> {
        const tt = this.getApi();
        if (!tt?.checkShortcut) {
            return Promise.resolve(this.unsupported('shortcut-check'));
        }

        return this.callOfficialCallbackApi<HSDKActionResult>(
            'shortcut-check',
            ({ success, fail }) => tt.checkShortcut({
                ...(options.extra || {}),
                success: (res: any) => success(res),
                fail: (err: any) => fail(err),
            }),
            (raw) => this.completedResult('shortcut-check', raw, true),
            (reason, raw, errorMessage) => this.actionFail('shortcut-check', reason, raw, (raw as any)?.errCode || (raw as any)?.errno, errorMessage),
        );
    }

    public addShortcut(options: HShortcutOptions = {}): Promise<HSDKActionResult> {
        const tt = this.getApi();
        if (!tt?.addShortcut) {
            return Promise.resolve(this.unsupported('shortcut-add'));
        }

        return this.callOfficialCallbackApi<HSDKActionResult>(
            'shortcut-add',
            ({ success, fail }) => tt.addShortcut({
                ...(options.extra || {}),
                success: (res: any) => success(res),
                fail: (err: any) => fail(err),
            }),
            (raw) => this.completedResult('shortcut-add', raw, true),
            (reason, raw, errorMessage) => this.actionFail('shortcut-add', reason, raw, (raw as any)?.errCode || (raw as any)?.errno, errorMessage),
        );
    }

    private getSceneText(...sources: unknown[]): string {
        for (const source of sources) {
            const scene = this.extractScene(source);
            if (scene) {
                return scene;
            }
        }
        return '';
    }

    private extractScene(source: unknown): string {
        if (!source || typeof source !== 'object') {
            return '';
        }

        const data = source as Record<string, any>;
        return `${data.scene || data.query?.scene || data.extraData?.scene || ''}`;
    }
}
