import type {
    HClipboardOptions,
    HSDKActionResult,
    HSDKLoginResult,
    HShareMenuOptions,
    HShareOptions,
} from '../HTypes';
import { HBaseSDK } from './HBaseSDK';

/**
 * 微信小游戏 SDK adapter。
 *
 * 这里保留官方 API 调用形态，方便和微信小游戏文档逐项对照：
 * - wx.login({ success, fail })
 * - wx.showShareMenu({ ... }) + wx.onShareAppMessage(() => shareInfo)
 * - wx.shareAppMessage({ title, imageUrl, query, success, fail })
 * - wx.setClipboardData({ data, success, fail })
 */
export class HWxSDK extends HBaseSDK {
    public readonly platform = 'wechat' as const;

    public getApi(): any {
        return (globalThis as any).wx;
    }

    public login(): Promise<HSDKLoginResult> {
        const wx = this.getApi();
        if (!wx?.login) {
            return Promise.resolve(this.loginFail('platform-unsupported', 'wx.login unsupported'));
        }

        return this.callOfficialCallbackApi<HSDKLoginResult>(
            'login',
            ({ success, fail }) => wx.login({
                success: (res: any) => {
                    if (res?.code) {
                        success(res);
                        return;
                    }
                    fail({
                        ...res,
                        errMsg: res?.errMsg || 'wx.login success but code is empty',
                    });
                },
                fail: (err: any) => fail(err),
            }),
            (raw) => this.loginSuccess(raw),
            (reason, raw, errorMessage) => this.loginFail(reason, errorMessage, raw),
        );
    }

    public restartProgram(): HSDKActionResult {
        const wx = this.getApi();
        try {
            if (wx?.restartMiniProgramSync) {
                wx.restartMiniProgramSync();
                return this.actionSuccess('restart', undefined, true);
            }
            if (wx?.restartMiniProgram) {
                wx.restartMiniProgram();
                return this.actionSuccess('restart', undefined, true);
            }
            return this.unsupported('restart');
        } catch (error: any) {
            return this.actionFail('restart', 'failed', error, error?.errCode || error?.errno, error?.errMsg || error?.message);
        }
    }

    public setShareMenu(options: HShareMenuOptions = {}): HSDKActionResult {
        const wx = this.getApi();
        if (!wx?.showShareMenu && !wx?.onShareAppMessage) {
            return this.unsupported('share');
        }

        const shareInfo = this.buildSharePayload(options);
        try {
            // 官方写法：先打开右上角分享菜单，再注册点击菜单后的分享内容。
            wx.showShareMenu?.({
                withShareTicket: options.withShareTicket,
                menus: options.menus,
                ...(options.extra || {}),
            });
            wx.onShareAppMessage?.(() => shareInfo);
            return this.actionSuccess('share', undefined, true);
        } catch (error: any) {
            return this.actionFail('share', 'failed', error, error?.errCode || error?.errno, error?.errMsg || error?.message);
        }
    }

    public hideShareMenu(): HSDKActionResult {
        const wx = this.getApi();
        if (!wx?.hideShareMenu) {
            return this.unsupported('share');
        }

        try {
            wx.hideShareMenu();
            return this.actionSuccess('share', undefined, true);
        } catch (error: any) {
            return this.actionFail('share', 'failed', error, error?.errCode || error?.errno, error?.errMsg || error?.message);
        }
    }

    public share(options: HShareOptions = {}): Promise<HSDKActionResult> {
        const wx = this.getApi();
        if (!wx?.shareAppMessage) {
            return Promise.resolve(this.unsupported('share'));
        }

        const shareInfo = this.buildSharePayload(options);
        return this.callOfficialCallbackApi<HSDKActionResult>(
            'share',
            ({ success, fail }) => wx.shareAppMessage({
                ...shareInfo,
                success: (res: any) => success(res),
                fail: (err: any) => fail(err),
            }),
            (raw) => this.completedResult('share', raw, true),
            (reason, raw, errorMessage) => this.actionFail('share', reason, raw, (raw as any)?.errCode || (raw as any)?.errno, errorMessage),
        );
    }

    public copyText(text: string, options: HClipboardOptions = {}): Promise<HSDKActionResult> {
        const wx = this.getApi();
        if (!wx?.setClipboardData) {
            return Promise.resolve(this.unsupported('clipboard-copy'));
        }

        return this.callOfficialCallbackApi<HSDKActionResult>(
            'clipboard-copy',
            ({ success, fail }) => wx.setClipboardData({
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
        const wx = this.getApi();
        if (!wx?.triggerGC) {
            return this.unsupported('gc');
        }

        try {
            wx.triggerGC();
            return this.actionSuccess('gc', undefined, true);
        } catch (error: any) {
            return this.actionFail('gc', 'failed', error, error?.errCode || error?.errno, error?.errMsg || error?.message);
        }
    }
}
