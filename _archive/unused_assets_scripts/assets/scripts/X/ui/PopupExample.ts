import { _decorator, Component } from 'cc';
import { Popup } from './Popup';

const { ccclass } = _decorator;

@ccclass('PopupExample')
export class PopupExample extends Component {
    /**
     * 显示普通 Toast。
     */
    onShowToast() {
        Popup.toast('操作成功');
    }

    /**
     * 显示带时长的 Toast。
     */
    onShowLongToast() {
        Popup.toast('这是一条较长的提示信息，会显示 3 秒。', { duration: 3 });
    }

    /**
     * 显示 Alert 弹窗。
     */
    onShowAlert() {
        Popup.alert('提示', '您的金币不足，请充值后再试。', () => {
            console.log('用户点击了确认');
        });
    }

    /**
     * 显示 Confirm 弹窗。
     */
    onShowConfirm() {
        Popup.confirm(
            '确认删除',
            '确定要删除这个文件吗？删除后无法恢复。',
            () => {
                console.log('用户确认删除');
                Popup.toast('已删除');
            },
            () => {
                console.log('用户取消删除');
            },
        );
    }

    /**
     * 显示成功提示。
     */
    onShowSuccess() {
        Popup.toast('保存成功');
    }

    /**
     * 显示错误提示。
     */
    onShowError() {
        Popup.toast('网络连接失败');
    }

    /**
     * 连续显示多个 Toast。
     */
    onShowMultipleToast() {
        Popup.toast('第一条消息');
        setTimeout(() => Popup.toast('第二条消息'), 500);
        setTimeout(() => Popup.toast('第三条消息'), 1000);
    }
}
