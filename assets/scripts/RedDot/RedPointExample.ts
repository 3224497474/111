/**
 * 增强版红点系统使用示例
 * 
 * 说明：
 * - 红点配置通过预制体上的 RedPointItemV2 组件自动注册
 * - 逻辑层只需调用 RedPointMgr.setValue(key, value) 即可控制红点
 * - 推荐使用 RedPointKey 枚举，避免手写错误
 */

import { _decorator, Component } from 'cc';
import { RedPointMgr } from './RedPointManagerV2';
import { RedPointKey } from './RedPointKeys';

const { ccclass } = _decorator;

/**
 * 预制体配置说明：
 * 
 * 假设有一个主页按钮预制体，包含以下节点结构：
 * 
 * HomeButton (Node)
 * ├── Icon (Sprite) - 按钮图标
 * ├── RedDot (Node) - 简单红点
 * │   └── RedPointItemV2
 * │       ├── key: RedPointKey.Home (Root/Home)
 * │       ├── displayType: Simple
 * │       └── parentKey: RedPointKey.Root
 * ├── TaskRedDot (Node) - 任务数量红点
 * │   ├── Background (Sprite)
 * │   ├── CountLabel (Label)
 * │   └── RedPointItemV2
 * │       ├── key: RedPointKey.Task (Root/Task)
 * │       ├── displayType: Number
 * │       ├── countLabel: CountLabel
 * │       ├── maxValue: 99
 * │       ├── parentKey: RedPointKey.Home
 * │       ├── persistLocal: true
 * │       └── resetRule: Daily
 * └── MailRedDot (Node) - 邮件数量红点
 *     ├── Background (Sprite)
 *     ├── CountLabel (Label)
 *     └── RedPointItemV2
 *         ├── key: RedPointKey.Mail (Root/Mail)
 *         ├── displayType: Number
 *         ├── countLabel: CountLabel
 *         └── parentKey: RedPointKey.Root
 * 
 * 商店按钮预制体：
 * 
 * ShopButton (Node)
 * ├── Icon (Sprite)
 * ├── FreeGiftDot (Node) - 免费礼包（呼吸动画）
 * │   └── RedPointItemV2
 * │       ├── key: RedPointKey.ShopFree (自定义)
 * │       ├── displayType: Breath
 * │       ├── animationSpeed: 1.0
 * │       └── parentKey: RedPointKey.Shop
 * └── NewItemDot (Node) - 新物品（闪烁动画）
 *     └── RedPointItemV2
 *         ├── key: RedPointKey.ShopNew (自定义)
 *         ├── displayType: Blink
 *         └── parentKey: RedPointKey.Shop
 */

@ccclass('RedPointUsageExample')
export class RedPointUsageExample extends Component {

    // ==================== 逻辑层使用示例 ====================

    /**
     * 模拟：有3个任务可领取
     * 
     * 调用后：
     * - Root/Task 显示 "3"
     * - Root 聚合显示红点
     */
    onTaskAvailable(): void {
        // 推荐：使用枚举
        RedPointMgr.setValue(RedPointKey.Task, 3);
        
        // 也可以使用字符串（不推荐）
        // RedPointMgr.setValue('Root/Task', 3);
    }

    /**
     * 模拟：完成1个任务
     * 
     * 调用后：任务数量 -1
     */
    onTaskComplete(): void {
        RedPointMgr.add(RedPointKey.Task, -1);
    }

    /**
     * 模拟：收到新邮件
     * 
     * 调用后：邮件数量 +1
     */
    onMailReceived(): void {
        RedPointMgr.add(RedPointKey.Mail, 1);
    }

    /**
     * 模拟：阅读邮件
     * 
     * 调用后：邮件数量 -1
     */
    onMailRead(): void {
        RedPointMgr.add(RedPointKey.Mail, -1);
    }

    /**
     * 查看所有红点状态
     */
    onViewAllStatus(): void {
        console.log('=== 红点状态 ===');
        const keys = RedPointMgr.getAllKeys();
        for (const key of keys) {
            const total = RedPointMgr.getTotal(key);
            if (total > 0) {
                console.log(`${key}: ${total}`);
            }
        }
    }

    /**
     * 获取指定红点值
     */
    onGetValue(): void {
        const taskValue = RedPointMgr.getValue(RedPointKey.Task);
        const taskTotal = RedPointMgr.getTotal(RedPointKey.Task);
        console.log(`任务红点 - 原始值: ${taskValue}, 聚合值: ${taskTotal}`);
    }
}

/**
 * ==================== 预制体设置步骤 ====================
 * 
 * 1. 创建红点节点
 *    - 在需要红点的按钮下创建红点节点（如 RedDot）
 *    - 设置节点大小和位置（通常是小圆点）
 * 
 * 2. 添加 RedPointItemV2 组件
 *    - 将 RedPointItemV2 脚本拖到红点节点上
 * 
 * 3. 配置 Inspector 属性
 *    - Key: 选择枚举（如 RedPointKey.Task）
 *    - Parent Key: 选择父节点枚举（如 RedPointKey.Root）
 *    - Display Type: 显示类型（Simple/Number/Breath/Blink/Pulse/Bounce/Icon）
 * 
 * 4. 数值型红点额外配置
 *    - 添加 CountLabel 子节点（Label组件）
 *    - 将 CountLabel 拖到 RedPointItemV2 的 Count Label 属性
 *    - 设置 Max Value（默认99）
 * 
 * 5. 动画型红点额外配置
 *    - Animation Speed: 动画速度（默认1.0）
 *    - Min Scale / Max Scale: 缩放范围
 * 
 * 6. 图标型红点额外配置
 *    - 添加 IconSprite 子节点（Sprite组件）
 *    - 设置 Icon Path 图标资源路径
 * 
 * 7. 持久化配置（可选）
 *    - Persist Local: 是否持久化到本地
 *    - Reset Rule: 重置规则（Never/Daily/Weekly/Monthly）
 * 
 * 8. 逻辑层控制
 *    - 使用枚举：RedPointMgr.setValue(RedPointKey.Task, 3)
 *    - 或字符串：RedPointMgr.setValue('Root/Task', 3)
 *    - value > 0 显示红点，value = 0 隐藏红点
 */
