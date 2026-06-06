/**
 * UI 模块入口
 * 
 * 导出所有 UI 相关的组件和工具
 */

// 动画系统
export { UIAnimation, EaseType, AnimationPresets, EaseFunctions } from './UIAnimation';
export { AnimatedUIBase, EnterAnimationType, ExitAnimationType } from './AnimatedUIBase';
export { CommonDialog } from './CommonDialog';
export { PromptManager } from './PromptManager';

// 弹窗系统
export { Popup } from './Popup';

// 快捷访问
import { Popup } from './Popup';
import { UIAnimation } from './UIAnimation';

/**
 * UI 快捷访问对象
 */
export const UI = {
    /**
     * 显示 Toast 提示
     */
    toast: (message: string, duration?: number) => {
        Popup.toast(message, { duration });
    },
    
    /**
     * 显示成功提示
     */
    success: (message: string) => {
        Popup.success(message);
    },
    
    /**
     * 显示错误提示
     */
    error: (message: string) => {
        Popup.error(message);
    },
    
    /**
     * 显示警告提示
     */
    warning: (message: string) => {
        Popup.warning(message);
    },
    
    /**
     * 显示 Alert 弹窗
     */
    alert: (title: string, message: string, onConfirm?: () => void) => {
        Popup.alert(title, message, onConfirm);
    },
    
    /**
     * 显示 Confirm 弹窗
     */
    confirm: (
        title: string,
        message: string,
        onConfirm?: () => void,
        onCancel?: () => void
    ) => {
        Popup.confirm(title, message, onConfirm, onCancel);
    },
    
    /**
     * 动画工具
     */
    anim: UIAnimation,
};
