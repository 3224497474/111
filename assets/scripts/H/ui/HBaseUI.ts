import { _decorator, Component } from 'cc';
import type { HUIConfig, HUIStatus } from '../HTypes';

const { ccclass } = _decorator;

@ccclass('HBaseUI')
export class HBaseUI extends Component {
    public uiId = '';
    public uiPanelId = '';
    public dialogPath = '';
    public uiConfig: HUIConfig | null = null;
    public uiParams: any = null;
    public uiStatus: HUIStatus = 'idle';

    private loaded = false;

    /**
     * 由 H.ui 自动注入 UI 上下文，业务脚本一般不需要手动调用。
     */
    public bindUIContext(id: string, config: HUIConfig): void {
        this.uiId = id;
        this.uiPanelId = id;
        this.dialogPath = id;
        this.uiConfig = config;
    }

    /**
     * 打开 UI。第一次打开会触发 onUILoad，重复打开会触发 onUIRefresh。
     */
    public openUI(params?: any): void {
        if (this.uiStatus === 'opening') {
            return;
        }

        this.uiParams = params ?? null;
        if (!this.loaded) {
            this.loaded = true;
            this.onUILoad(this.uiParams);
        }

        if (this.uiStatus === 'opened') {
            this.onUIRefresh(this.uiParams);
            return;
        }

        this.uiStatus = 'opening';
        this.onUIOpen(this.uiParams);
        this.node.active = true;
        this.uiStatus = 'opened';
        this.onUIShow();
    }

    /**
     * 隐藏 UI。节点会保留，适合常用页面和缓存弹窗。
     */
    public hideUI(): void {
        if (this.uiStatus !== 'opened') {
            this.node.active = false;
            this.uiStatus = 'closed';
            return;
        }

        this.uiStatus = 'hiding';
        this.onUIHide();
        this.node.active = false;
        this.uiStatus = 'closed';
    }

    /**
     * 关闭 UI。真正销毁由 H.ui 根据 cacheMode 决定。
     */
    public closeUI(): void {
        if (this.uiStatus === 'destroyed') {
            return;
        }

        this.onUIClose();
        this.node.active = false;
        this.uiStatus = 'closed';
    }

    public onUILoad(_params?: any): void {}

    public onUIOpen(_params?: any): void {}

    public onUIShow(): void {}

    public onUIHide(): void {}

    public onUIClose(): void {}

    public onUIRefresh(_params?: any): void {}

    /**
     * 返回键处理。返回 true 表示业务已消费，不再让 H.ui 自动关闭。
     */
    public onUIBack(): boolean {
        return false;
    }

    public show(params?: any): void {
        this.openUI(params);
    }

    public hide(): void {
        this.hideUI();
    }

    public updateInfo(): void {}

    protected onDestroy(): void {
        this.uiStatus = 'destroyed';
    }
}
