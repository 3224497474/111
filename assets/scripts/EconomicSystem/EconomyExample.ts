/**
 * 经济系统使用示例
 * 
 * 展示如何使用增强版经济系统
 */

import { _decorator, Component } from 'cc';
import { CurrencyType, DiscountType, ItemRarity, ItemType } from './EconomicTypes';
import { CurrencySystem, Economy, InventorySystem } from './index';

const { ccclass } = _decorator;

@ccclass('EconomyExample')
export class EconomyExample extends Component {

    onLoad() {
        // 初始化经济系统
        this.initEconomy();
    }

    /**
     * 初始化经济系统
     */
    private initEconomy(): void {
        // 1. 设置物品配置获取函数
        const getItemConfig = (itemId: string) => {
            // 这里应该从配置表获取，示例写死
            const configs: Record<string, any> = {
                'item_health_potion': {
                    id: 'item_health_potion',
                    name: '体力恢复饮料',
                    type: ItemType.Consumable,
                    rarity: ItemRarity.Common,
                    icon: 'icon_potion',
                    description: '恢复少量体力',
                    maxStack: 99,
                    sellPrice: 15,
                    buyPrice: 30,
                    isTradable: true,
                },
                'item_gift_flower': {
                    id: 'item_gift_flower',
                    name: '小花束',
                    type: ItemType.Gift,
                    rarity: ItemRarity.Uncommon,
                    icon: 'icon_flower',
                    description: '提升好感度',
                    maxStack: 50,
                    sellPrice: 20,
                    buyPrice: 40,
                    isTradable: true,
                },
                'item_diamond_box': {
                    id: 'item_diamond_box',
                    name: '钻石宝箱',
                    type: ItemType.Box,
                    rarity: ItemRarity.Epic,
                    icon: 'icon_box',
                    description: '打开获得随机钻石',
                    maxStack: 10,
                    sellPrice: 0,
                    buyPrice: 0,
                    isTradable: false,
                },
            };
            return configs[itemId];
        };

        Economy.inventory.setItemConfigGetter(getItemConfig);
        Economy.shop.setItemConfigGetter(getItemConfig);

        // 2. 设置背包容量
        Economy.inventory.setConfig({ maxSlots: 50 });

        // 3. 给玩家初始货币
        Economy.currency.setBalance(CurrencyType.Gold, 1000, 'init');
        Economy.currency.setBalance(CurrencyType.Diamond, 100, 'init');

        // 4. 注册商店
        Economy.shop.registerShop({
            id: 'general_shop',
            name: '杂货店',
            refreshType: 'daily',
            items: [
                {
                    itemId: 'item_health_potion',
                    price: 30,
                    currencyType: CurrencyType.Gold,
                    initialStock: -1,  // 无限库存
                    dailyLimit: 10,    // 每日限购10个
                    refreshType: 'none',
                },
                {
                    itemId: 'item_gift_flower',
                    price: 40,
                    currencyType: CurrencyType.Gold,
                    initialStock: 20,
                    dailyLimit: 5,
                    refreshType: 'daily',
                    discount: {
                        type: DiscountType.Percentage,
                        value: 20,  // 8折
                        minVIPLevel: 3,
                    },
                },
                {
                    itemId: 'item_diamond_box',
                    price: 50,
                    currencyType: CurrencyType.Diamond,
                    initialStock: 3,
                    dailyLimit: 1,
                    refreshType: 'weekly',
                },
            ],
        });

        console.log('[EconomyExample] Initialized');
    }

    // ==================== 使用示例 ====================

    /**
     * 示例：购买物品
     */
    exampleBuy(): void {
        console.log('--- 购买示例 ---');

        // 检查金币
        console.log('当前金币:', Economy.getGold());

        // 购买体力药水
        const success = Economy.buy('general_shop', 'item_health_potion', 3);
        console.log('购买结果:', success);
        console.log('购买后金币:', Economy.getGold());
        console.log('体力药水数量:', Economy.getItemCount('item_health_potion'));
    }

    /**
     * 示例：使用物品
     */
    exampleUseItem(): void {
        console.log('--- 使用物品示例 ---');

        // 获取背包物品
        const items = Economy.inventory.getItems();
        console.log('背包物品:', items);

        // 使用第一个物品
        if (items.length > 0) {
            const success = Economy.useItem(0);
            console.log('使用结果:', success);
        }
    }

    /**
     * 示例：出售物品
     */
    exampleSell(): void {
        console.log('--- 出售示例 ---');

        const itemCount = Economy.getItemCount('item_health_potion');
        console.log('出售前数量:', itemCount);
        console.log('出售前金币:', Economy.getGold());

        // 出售2个
        const success = Economy.sell('item_health_potion', 2);
        console.log('出售结果:', success);
        console.log('出售后数量:', Economy.getItemCount('item_health_potion'));
        console.log('出售后金币:', Economy.getGold());
    }

    /**
     * 示例：货币变化监听
     */
    exampleCurrencyListener(): void {
        console.log('--- 货币监听示例 ---');

        // 注册监听器
        CurrencySystem.instance.onChange((event) => {
            console.log(`货币变化: ${event.type} ${event.oldValue} -> ${event.newValue} (${event.delta > 0 ? '+' : ''}${event.delta})`);
            console.log(`原因: ${event.reason}`);
        });

        // 触发变化
        Economy.addGold(100, 'test_add');
        Economy.spendGold(50, 'test_spend');
    }

    /**
     * 示例：物品变化监听
     */
    exampleItemListener(): void {
        console.log('--- 物品监听示例 ---');

        // 注册监听器
        InventorySystem.instance.onChange((itemId, oldCount, newCount) => {
            console.log(`物品变化: ${itemId} ${oldCount} -> ${newCount}`);
        });

        // 触发变化
        Economy.addItem('item_health_potion', 5);
        Economy.removeItem('item_health_potion', 2);
    }

    /**
     * 示例：批量操作
     */
    exampleBatchOperation(): void {
        console.log('--- 批量操作示例 ---');

        // 批量检查
        const canAfford = Economy.currency.canAffordMultiple([
            { type: CurrencyType.Gold, amount: 100 },
            { type: CurrencyType.Diamond, amount: 10 },
        ]);
        console.log('是否足够:', canAfford);

        // 批量消耗
        if (canAfford) {
            const success = Economy.currency.spendMultiple([
                { type: CurrencyType.Gold, amount: 100 },
                { type: CurrencyType.Diamond, amount: 10 },
            ], 'batch_spend');
            console.log('批量消耗结果:', success);
        }

        // 批量检查物品
        const hasItems = Economy.inventory.hasItems([
            { itemId: 'item_health_potion', count: 5 },
            { itemId: 'item_gift_flower', count: 2 },
        ]);
        console.log('是否有足够物品:', hasItems);
    }

    /**
     * 示例：存档和读档
     */
    exampleSaveLoad(): void {
        console.log('--- 存档读档示例 ---');

        // 保存数据
        const saveData = Economy.save();
        console.log('存档数据:', JSON.stringify(saveData, null, 2));

        // 修改数据
        Economy.spendGold(999, 'test');

        // 读取数据
        Economy.load(saveData);
        console.log('读档后金币:', Economy.getGold());
    }

    /**
     * 示例：商店刷新
     */
    exampleShopRefresh(): void {
        console.log('--- 商店刷新示例 ---');

        // 获取商品列表
        const items = Economy.shop.listShopItems('general_shop');
        console.log('商品列表:');
        for (const item of items) {
            console.log(`  ${item.itemConfig.name}: ${item.currentPrice} ${item.currencyType} (库存: ${item.stock ?? '无限'})`);
        }

        // 手动刷新商店
        const refreshed = Economy.shop.refreshShop('general_shop');
        console.log('刷新结果:', refreshed);
    }
}
