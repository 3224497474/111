import { _decorator, Button, Label, Node } from 'cc';
import { AnimatedUIBase } from './AnimatedUIBase';

const { ccclass, property } = _decorator;

export interface CommonDialogParams {
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
    closeOnConfirm?: boolean;
    closeOnCancel?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
}

@ccclass('CommonDialog')
export class CommonDialog extends AnimatedUIBase {
    @property(Label)
    public titleLabel: Label | null = null;

    @property(Label)
    public messageLabel: Label | null = null;

    @property(Button)
    public confirmButton: Button | null = null;

    @property(Button)
    public cancelButton: Button | null = null;

    @property(Label)
    public confirmButtonLabel: Label | null = null;

    @property(Label)
    public cancelButtonLabel: Label | null = null;

    private _params: CommonDialogParams = {};
    private _isClosing: boolean = false;

    onDisable() {
        this.unbindButtonEvents();
    }

    /**
     * 在弹窗入场动画前注入业务参数。
     */
    public init(params?: CommonDialogParams): void {
        this._isClosing = false;
        this._params = {
            confirmText: '确定',
            cancelText: '取消',
            showCancel: true,
            closeOnConfirm: true,
            closeOnCancel: true,
            ...params,
        };

        this.refreshView();
        this.bindButtonEvents();
    }

    private refreshView(): void {
        if (this.titleLabel) {
            const title = this._params.title ?? '';
            this.titleLabel.string = title;
            this.titleLabel.node.active = title.length > 0;
        }

        if (this.messageLabel) {
            this.messageLabel.string = this._params.message ?? '';
        }

        const confirmLabel = this.getConfirmButtonLabel();
        if (confirmLabel) {
            confirmLabel.string = this._params.confirmText ?? '确定';
        }

        const cancelVisible = this._params.showCancel !== false;
        if (this.cancelButton) {
            this.cancelButton.node.active = cancelVisible;
        }

        const cancelLabel = this.getCancelButtonLabel();
        if (cancelLabel) {
            cancelLabel.string = this._params.cancelText ?? '取消';
            cancelLabel.node.active = cancelVisible;
        }
    }

    private bindButtonEvents(): void {
        this.unbindButtonEvents();

        if (this.confirmButton) {
            this.confirmButton.node.on(Node.EventType.TOUCH_END, this.onConfirmClicked, this);
        }

        if (this.cancelButton) {
            this.cancelButton.node.on(Node.EventType.TOUCH_END, this.onCancelClicked, this);
        }
    }

    private unbindButtonEvents(): void {
        if (this.confirmButton) {
            this.confirmButton.node.off(Node.EventType.TOUCH_END, this.onConfirmClicked, this);
        }

        if (this.cancelButton) {
            this.cancelButton.node.off(Node.EventType.TOUCH_END, this.onCancelClicked, this);
        }
    }

    private onConfirmClicked(): void {
        if (!this.confirmButton?.interactable || this._isClosing) {
            return;
        }

        this._params.onConfirm?.();

        if (this._params.closeOnConfirm === false) {
            return;
        }

        this.closeSelf();
    }

    private onCancelClicked(): void {
        if (!this.cancelButton?.interactable || this._isClosing) {
            return;
        }

        this._params.onCancel?.();

        if (this._params.closeOnCancel === false) {
            return;
        }

        this.closeSelf();
    }

    private closeSelf(): void {
        if (this._isClosing) {
            return;
        }

        this._isClosing = true;
        this.unbindButtonEvents();

        this.hide(() => {
            this.node.active = false;
        });
    }

    private getConfirmButtonLabel(): Label | null {
        return this.confirmButtonLabel
            ?? this.confirmButton?.node.getComponentInChildren(Label)
            ?? null;
    }

    private getCancelButtonLabel(): Label | null {
        return this.cancelButtonLabel
            ?? this.cancelButton?.node.getComponentInChildren(Label)
            ?? null;
    }
}










/**
 * 
     * 当玩家点击商品上的“购买”按钮时触发
     
    public onClickBuyWeapon() {
        // 假设这是当前商品的数据
        const weaponId = 'sword_001';
        const weaponPrice = 500;
        const weaponName = '无尽之剑';

        // ==========================================
        // 核心：呼叫全局弹窗并注入回调函数
        // ==========================================
        PromptManager.show(
            'ShopBuyConfirm', // 参数1：对应 TbSystemPrompt.xlsx 表里的弹窗ID
            
            { 
                price: weaponPrice, 
                itemName: weaponName 
            }, // 参数2：动态替换表里 {price} 和 {itemName} 的数据
            
            // 参数3：onConfirm 回调函数（玩家点击弹窗的“确定”时执行）
            () => {
                console.log(`[商城] 玩家确认购买，扣除 ${weaponPrice} 金币，发放 ${weaponName}！`);
                // 真实游戏里这里会调用扣钱逻辑：
                // Economy.buy(weaponId);
            },
            
            // 参数4：onCancel 回调函数（玩家点击弹窗的“取消”时执行，可选）
            () => {
                console.log(`[商城] 玩家太穷了，放弃了购买。`);
            }
        );
    }



    呼叫 PromptManager.show('ShopBuyConfirm', ...) 时，PromptManager 会去查表，发现 ShopBuyConfirm 这一行的 showCancel 填的是 TRUE，于是它就自动把 true 塞给了底层弹窗。
 */



