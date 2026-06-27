import { CCInteger, Node, tween, Vec3, view, _decorator } from 'cc';
import { UIManager, UIPanelId } from '../../../../ui/UIManager';
import { UtilPub } from '../utils/UtilPub';
import { comm } from './comm';
import { uiManager } from './uiManager';

const { ccclass, property } = _decorator;

@ccclass('BaseView')
export default class BaseView extends comm {
    @property(CCInteger)
    zIndex: number = 100;

    AniNode: Node = null!;
    dialogPath: string = '';
    uiPanelId: string = '';

    /**
     * 兼容旧体系的显示入口。
     * UIManager.onUIOpen 最终也会转发到这里。
     */
    show(args: any) {
        this._layerData = args;
        this.AniNode = this.node.getChildByName('root')!;
        if (this.AniNode != null) {
            this.AniNode.scale = new Vec3(0.5, 0.5, 0.5);
            tween(this.AniNode)
                .to(0.1, { scale: new Vec3(1.05, 1.05, 1.05) })
                .to(0.03, { scale: new Vec3(1, 1, 1) })
                .start();
        }

        const bgNode = this.node.getChildByName('bg');
        if (bgNode != null) {
            bgNode.active = true;
        }

        this._clickEnable = true;
    }

    /**
     * 新体系统一打开生命周期。
     */
    onUIOpen(args: any) {
        this.show(args);
    }

    /**
     * 新体系统一关闭生命周期。
     * 这里只负责动画和关闭完成通知，不直接递归调用 UIManager.closePopup。
     */
    onUIClose() {
        this.playHideAnimation(() => {
            if (this.uiPanelId) {
                UIManager.instance.notifyPopupClosed(this.uiPanelId as UIPanelId);
            }
        });
    }

    /**
     * 兼容旧体系的隐藏入口。
     */
    hide() {
        this.playHideAnimation();
    }

    /**
     * 主动关闭当前面板。
     * 新体系优先走 UIManager，旧体系保留回退逻辑。
     */
    close() {
        if (this.uiPanelId) {
            UIManager.instance.closePopup(this.uiPanelId as UIPanelId);
            return;
        }

        this.playHideAnimation(() => {
            uiManager.instance.hideDialog(this.dialogPath);
        });
        UtilPub.log('close---dialogPath----', this.dialogPath);
    }

    /**
     * 兼容旧的弹窗栈关闭接口。
     */
    popClose() {
        if (this.uiPanelId) {
            UIManager.instance.closePopup(this.uiPanelId as UIPanelId);
            return;
        }

        this.playHideAnimation(() => {
            uiManager.instance.popHideDialog(this.dialogPath);
        });
        UtilPub.log('popClose---dialogPath----', this.dialogPath);
    }

    /**
     * 统一关闭动画。
     */
    private playHideAnimation(onComplete?: () => void) {
        this.AniNode = this.node.getChildByName('root')!;
        const bgNode = this.node.getChildByName('bg');

        if (this.AniNode != null) {
            if (bgNode != null) {
                bgNode.active = false;
            }

            tween(this.AniNode)
                .to(0.1, { scale: new Vec3(0.3, 0.3, 0.3) })
                .call(() => {
                    this.node.active = false;
                    this.AniNode.scale = new Vec3(1, 1, 1);
                    onComplete?.();
                })
                .start();
            return;
        }

        this.node.active = false;
        onComplete?.();
    }

    getScreenScale() {
        const screen1 = view.getVisibleSize();
        const resolute = view.getDesignResolutionSize();
        let scale = 1;
        if (screen1.width / screen1.height <= 720 / 1280) {
            scale = screen1.width / resolute.width;
        } else {
            scale = screen1.height / resolute.height;
        }
        return scale;
    }

    updateInfo() {}

    setBtnGrayScale(target: Node, gray: boolean) {}
}
