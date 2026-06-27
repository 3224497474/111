import type { CommonDialogParams as ICommonDialogArgs } from './CommonDialog';
import { ConfigManager } from '../../config/ConfigManager';
import { UIManager, UIPanelId } from './UIManager';

type PromptParamValue = string | number;

/**
 * 系统弹窗管理器。
 * 负责读取 TbSystemPrompt 配置、替换模板参数，并拉起 CommonDialog。
 */
export class PromptManager {
    public static show(
        promptId: string,
        params?: Record<string, PromptParamValue>,
        onConfirm?: () => void,
        onCancel?: () => void,
    ): void {
        if (!promptId) {
            console.error('[PromptManager] promptId 不能为空');
            return;
        }

        if (!ConfigManager.tables) {
            console.error('[PromptManager] ConfigManager.tables 尚未初始化，请先执行 ConfigManager.initConfig()');
            return;
        }

        const config = ConfigManager.tables.TbSystemPrompt.get(promptId);
        if (!config) {
            console.error(`[PromptManager] 缺少 TbSystemPrompt 配置: ${promptId}`);
            return;
        }

        let content = config.content ?? '';
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                const regex = new RegExp(`\\{${key}\\}`, 'g');
                content = content.replace(regex, String(value));
            }
        }

        const dialogArgs: ICommonDialogArgs = {
            title: config.title ?? '',
            message: content,
            confirmText: config.confirmText ?? '确定',
            cancelText: config.cancelText ?? '取消',
            showCancel: config.showCancel ?? false,
            onConfirm,
            onCancel,
        };

        void UIManager.instance.openPopup(UIPanelId.CommonDialog, dialogArgs);
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
 */