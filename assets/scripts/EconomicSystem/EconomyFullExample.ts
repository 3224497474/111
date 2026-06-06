/**
 * 经济系统完整示例
 * 
 * 功能演示：
 * 1. 系统初始化与配置
 * 2. 货币操作（金币、钻石、体力）
 * 3. 背包操作（添加、移除、使用、排序）
 * 4. 商店操作（购买、出售、折扣、限购）
 * 5. 事件监听（货币变化、物品变化）
 * 6. 存档与读档
 * 7. UI集成示例
 */

import { _decorator, Component, Node, Label, Sprite, Button, ScrollView, director } from 'cc';
import {
    Economy,
    CurrencySystem,
    InventorySystem,
    ShopSystem,
    CurrencyType,
    ItemType,
    ItemRarity,
    DiscountType,
    RARITY_COLORS,
    IItemConfig,
    IInventoryItem,
} from './index';

const { ccclass, property } = _decorator;

/**
 * 物品配置表（实际项目应从外部JSON/Excel加载）
 */
const ITEM_CONFIGS: Record<string, IItemConfig> = {
    // 消耗品
    'potion_hp_small': {
        id: 'potion_hp_small',
        name: '小型生命药水',
        type: ItemType.Consumable,
        rarity: ItemRarity.Common,
        icon: 'items/potion_hp_small',
        description: '恢复100点生命值',
        maxStack: 99,
        sellPrice: 10,
        buyPrice: 20,
        isTradable: true,
    },
    'potion_hp_large': {
        id: 'potion_hp_large',
        name: '大型生命药水',
        type: ItemType.Consumable,
        rarity: ItemRarity.Uncommon,
        icon: 'items/potion_hp_large',
        description: '恢复500点生命值',
        maxStack: 50,
        sellPrice: 50,
        buyPrice: 100,
        isTradable: true,
    },
    'potion_mp_small': {
        id: 'potion_mp_small',
        name: '小型魔法药水',
        type: ItemType.Consumable,
        rarity: ItemRarity.Common,
        icon: 'items/potion_mp_small',
        description: '恢复50点魔法值',
        maxStack: 99,
        sellPrice: 15,
        buyPrice: 30,
        isTradable: true,
    },
    // 材料
    'material_iron': {
        id: 'material_iron',
        name: '铁矿石',
        type: ItemType.Material,
        rarity: ItemRarity.Common,
        icon: 'items/material_iron',
        description: '用于打造装备的基础材料',
        maxStack: 999,
        sellPrice: 5,
        buyPrice: 0,
        isTradable: true,
    },
    'material_crystal': {
        id: 'material_crystal',
        name: '魔力水晶',
        type: ItemType.Material,
        rarity: ItemRarity.Rare,
        icon: 'items/material_crystal',
        description: '蕴含魔力的稀有水晶',
        maxStack: 100,
        sellPrice: 100,
        buyPrice: 0,
        isTradable: true,
    },
    // 礼物
    'gift_flower': {
        id: 'gift_flower',
        name: '精美花束',
        type: ItemType.Gift,
        rarity: ItemRarity.Uncommon,
        icon: 'items/gift_flower',
        description: '赠送可提升角色好感度',
        maxStack: 50,
        sellPrice: 25,
        buyPrice: 50,
        isTradable: true,
    },
    'gift_ring': {
        id: 'gift_ring',
        name: '精致戒指',
        type: ItemType.Gift,
        rarity: ItemRarity.Epic,
        icon: 'items/gift_ring',
        description: '珍贵的礼物，大幅提升好感度',
        maxStack: 10,
        sellPrice: 500,
        buyPrice: 1000,
        isTradable: false,
    },
    // 宝箱
    'box_gold_small': {
        id: 'box_gold_small',
        name: '小型金币箱',
        type: ItemType.Box,
        rarity: ItemRarity.Common,
        icon: 'items/box_gold_small',
        description: '打开获得100-500金币',
        maxStack: 20,
        sellPrice: 0,
        buyPrice: 0,
        isTradable: false,
    },
    'box_diamond': {
        id: 'box_diamond',
        name: '钻石宝箱',
        type: ItemType.Box,
        rarity: ItemRarity.Legendary,
        icon: 'items/box_diamond',
        description: '打开获得10-50钻石',
        maxStack: 5,
        sellPrice: 0,
        buyPrice: 0,
        isTradable: false,
    },
    // 关键道具
    'key_chest': {
        id: 'key_chest',
        name: '宝箱钥匙',
        type: ItemType.Key,
        rarity: ItemRarity.Rare,
        icon: 'items/key_chest',
        description: '用于开启宝箱',
        maxStack: 99,
        sellPrice: 0,
        buyPrice: 0,
        isTradable: false,
    },
};

/**
 * 商店配置表
 */
const SHOP_CONFIGS = [
    {
        id: 'general_shop',
        name: '杂货店',
        refreshType: 'daily' as const,
        items: [
            {
                itemId: 'potion_hp_small',
                price: 20,
                currencyType: CurrencyType.Gold,
                initialStock: -1,
                dailyLimit: 20,
                refreshType: 'none' as const,
            },
            {
                itemId: 'potion_hp_large',
                price: 100,
                currencyType: CurrencyType.Gold,
                initialStock: 10,
                dailyLimit: 5,
                refreshType: 'daily' as const,
            },
            {
                itemId: 'potion_mp_small',
                price: 30,
                currencyType: CurrencyType.Gold,
                initialStock: -1,
                dailyLimit: 20,
                refreshType: 'none' as const,
            },
            {
                itemId: 'gift_flower',
                price: 50,
                currencyType: CurrencyType.Gold,
                initialStock: 10,
                dailyLimit: 3,
                refreshType: 'daily' as const,
            },
            {
                itemId: 'key_chest',
                price: 100,
                currencyType: CurrencyType.Gold,
                initialStock: 5,
                dailyLimit: 2,
                refreshType: 'daily' as const,
            },
        ],
    },
    {
        id: 'premium_shop',
        name: '钻石商店',
        refreshType: 'weekly' as const,
        items: [
            {
                itemId: 'gift_ring',
                price: 500,
                currencyType: CurrencyType.Diamond,
                initialStock: 1,
                dailyLimit: 1,
                refreshType: 'weekly' as const,
            },
            {
                itemId: 'box_diamond',
                price: 200,
                currencyType: CurrencyType.Diamond,
                initialStock: 3,
                dailyLimit: 1,
                refreshType: 'weekly' as const,
            },
            {
                itemId: 'material_crystal',
                price: 50,
                currencyType: CurrencyType.Diamond,
                initialStock: 20,
                dailyLimit: 5,
                refreshType: 'daily' as const,
            },
        ],
    },
    {
        id: 'event_shop',
        name: '活动商店',
        refreshType: 'none' as const,
        refreshCost: { type: CurrencyType.Diamond, amount: 50 },
        items: [
            {
                itemId: 'potion_hp_large',
                price: 80,
                currencyType: CurrencyType.Gold,
                initialStock: 50,
                dailyLimit: 0,
                refreshType: 'none' as const,
                discount: {
                    type: DiscountType.Percentage,
                    value: 20,  // 8折
                },
            },
            {
                itemId: 'gift_flower',
                price: 40,
                currencyType: CurrencyType.Gold,
                initialStock: 30,
                dailyLimit: 0,
                refreshType: 'none' as const,
                discount: {
                    type: DiscountType.Percentage,
                    value: 20,
                },
            },
        ],
    },
];

@ccclass('EconomyFullExample')
export class EconomyFullExample extends Component {

    // ==================== UI属性绑定 ====================

    @property(Label)
    goldLabel: Label = null!;

    @property(Label)
    diamondLabel: Label = null!;

    @property(Label)
    staminaLabel: Label = null!;

    @property(ScrollView)
    inventoryScroll: ScrollView = null!;

    @property(ScrollView)
    shopScroll: ScrollView = null!;

    @property(Node)
    logPanel: Node = null!;

    // ==================== 私有属性 ====================

    private _logMessages: string[] = [];
    private _maxLogCount: number = 50;

    // ==================== 生命周期 ====================

    onLoad() {
        this.initEconomySystem();
        this.initEventListeners();
        this.refreshUI();
    }

    onDestroy() {
        this.removeEventListeners();
    }

    // ==================== 初始化 ====================

    /**
     * 初始化经济系统
     */
    private initEconomySystem(): void {
        // 1. 设置物品配置获取函数
        Economy.inventory.setItemConfigGetter((itemId: string) => ITEM_CONFIGS[itemId]);
        Economy.shop.setItemConfigGetter((itemId: string) => ITEM_CONFIGS[itemId]);

        // 2. 设置背包容量
        Economy.inventory.setConfig({ maxSlots: 50 });

        // 3. 给玩家初始货币
        Economy.currency.setBalance(CurrencyType.Gold, 10000, 'init');
        Economy.currency.setBalance(CurrencyType.Diamond, 500, 'init');
        Economy.currency.setBalance(CurrencyType.Stamina, 100, 'init');

        // 4. 注册商店
        for (const shopConfig of SHOP_CONFIGS) {
            Economy.shop.registerShop(shopConfig);
        }

        // 5. 给玩家初始物品
        Economy.addItem('potion_hp_small', 10);
        Economy.addItem('potion_mp_small', 5);
        Economy.addItem('material_iron', 50);
        Economy.addItem('key_chest', 3);

        this.log('经济系统初始化完成');
        this.log('初始金币: 10000, 钻石: 500, 体力: 100');
    }

    /**
     * 初始化事件监听
     */
    private initEventListeners(): void {
        // 监听货币变化
        CurrencySystem.instance.onChange((event) => {
            const sign = event.delta > 0 ? '+' : '';
            this.log(`[货币] ${event.type}: ${event.oldValue} -> ${event.newValue} (${sign}${event.delta}) - ${event.reason}`);
            this.refreshCurrencyUI();
        });

        // 监听物品变化
        InventorySystem.instance.onChange((itemId, oldCount, newCount) => {
            const config = ITEM_CONFIGS[itemId];
            const name = config?.name ?? itemId;
            const diff = newCount - oldCount;
            const sign = diff > 0 ? '+' : '';
            this.log(`[物品] ${name}: ${oldCount} -> ${newCount} (${sign}${diff})`);
            this.refreshInventoryUI();
        });
    }

    /**
     * 移除事件监听
     */
    private removeEventListeners(): void {
        // 清理监听器
    }

    // ==================== UI刷新 ====================

    /**
     * 刷新所有UI
     */
    private refreshUI(): void {
        this.refreshCurrencyUI();
        this.refreshInventoryUI();
        this.refreshShopUI();
    }

    /**
     * 刷新货币显示
     */
    private refreshCurrencyUI(): void {
        if (this.goldLabel) {
            this.goldLabel.string = `金币: ${Economy.getGold()}`;
        }
        if (this.diamondLabel) {
            this.diamondLabel.string = `钻石: ${Economy.getDiamond()}`;
        }
        if (this.staminaLabel) {
            this.staminaLabel.string = `体力: ${Economy.getStamina()}`;
        }
    }

    /**
     * 刷新背包显示
     */
    private refreshInventoryUI(): void {
        if (!this.inventoryScroll?.content) return;

        // 清空列表
        this.inventoryScroll.content.removeAllChildren();

        // 获取物品并排序
        Economy.inventory.sortItems();
        const items = Economy.inventory.getItems();

        // 创建物品项（简化示例，实际应使用预制体）
        for (const item of items) {
            const config = ITEM_CONFIGS[item.itemId];
            if (!config) continue;

            const node = new Node('Item');
            const label = node.addComponent(Label);
            const rarityColor = RARITY_COLORS[config.rarity] ?? '#FFFFFF';
            label.string = `${config.name} x${item.count}`;
            label.color.fromHEX(rarityColor);

            this.inventoryScroll.content.addChild(node);
        }
    }

    /**
     * 刷新商店显示
     */
    private refreshShopUI(): void {
        if (!this.shopScroll?.content) return;

        // 清空列表
        this.shopScroll.content.removeAllChildren();

        // 获取默认商店商品
        const shopItems = Economy.shop.listShopItems('general_shop');

        // 创建商品项
        for (const item of shopItems) {
            const node = new Node('ShopItem');
            const label = node.addComponent(Label);

            let text = `${item.itemConfig.name} - ${item.currentPrice} ${item.currencyType}`;
            if (item.discount) {
                text += ` (折扣)`;
            }
            if (item.dailyLimit > 0) {
                text += ` [${item.dailyBought}/${item.dailyLimit}]`;
            }
            if (!item.canBuy) {
                text += ` (${item.buyFailReason})`;
            }

            label.string = text;
            this.shopScroll.content.addChild(node);
        }
    }

    // ==================== 货币操作示例 ====================

    /**
     * 示例：增加金币
     */
    onClickAddGold(): void {
        const amount = 100;
        Economy.addGold(amount, 'reward');
    }

    /**
     * 示例：消耗金币
     */
    onClickSpendGold(): void {
        const amount = 50;
        if (!Economy.spendGold(amount, 'test_spend')) {
            this.log('[警告] 金币不足!');
        }
    }

    /**
     * 示例：增加钻石
     */
    onClickAddDiamond(): void {
        Economy.addDiamond(50, 'reward');
    }

    /**
     * 示例：恢复体力
     */
    onClickRecoverStamina(): void {
        Economy.currency.changeBalance(CurrencyType.Stamina, 50, 'recover');
    }

    // ==================== 背包操作示例 ====================

    /**
     * 示例：添加物品
     */
    onClickAddItem(): void {
        const items = ['potion_hp_small', 'potion_hp_large', 'material_iron', 'gift_flower'];
        const randomItem = items[Math.floor(Math.random() * items.length)];
        const count = Math.floor(Math.random() * 5) + 1;

        const actualAdded = Economy.addItem(randomItem, count);
        const config = ITEM_CONFIGS[randomItem];
        this.log(`添加 ${config?.name ?? randomItem} x${count}，实际添加: ${actualAdded}`);
    }

    /**
     * 示例：移除物品
     */
    onClickRemoveItem(): void {
        const items = Economy.inventory.getItems();
        if (items.length === 0) {
            this.log('[警告] 背包为空!');
            return;
        }

        const randomItem = items[Math.floor(Math.random() * items.length)];
        const config = ITEM_CONFIGS[randomItem.itemId];
        const removeCount = Math.min(randomItem.count, 2);

        if (Economy.removeItem(randomItem.itemId, removeCount)) {
            this.log(`移除 ${config?.name ?? randomItem.itemId} x${removeCount}`);
        }
    }

    /**
     * 示例：使用物品
     */
    onClickUseItem(): void {
        const items = Economy.inventory.getItems();
        if (items.length === 0) {
            this.log('[警告] 背包为空!');
            return;
        }

        // 找到第一个可使用的消耗品
        const consumableIndex = items.findIndex(item => {
            const config = ITEM_CONFIGS[item.itemId];
            return config?.type === ItemType.Consumable;
        });

        if (consumableIndex === -1) {
            this.log('[警告] 没有可使用的消耗品!');
            return;
        }

        const item = items[consumableIndex];
        const config = ITEM_CONFIGS[item.itemId];

        if (Economy.useItem(consumableIndex)) {
            this.log(`使用了 ${config?.name ?? item.itemId}`);
        }
    }

    /**
     * 示例：排序背包
     */
    onClickSortInventory(): void {
        Economy.inventory.sortItems();
        this.log('背包已排序');
        this.refreshInventoryUI();
    }

    /**
     * 示例：清理过期物品
     */
    onClickCleanupExpired(): void {
        const cleaned = Economy.inventory.cleanupExpired();
        this.log(`清理了 ${cleaned} 个过期物品`);
    }

    // ==================== 商店操作示例 ====================

    /**
     * 示例：购买物品
     */
    onClickBuyItem(): void {
        const shopId = 'general_shop';
        const itemId = 'potion_hp_small';
        const count = 1;

        const config = ITEM_CONFIGS[itemId];
        const canBuy = Economy.shop.canBuyItem(shopId, itemId);

        if (!canBuy.success) {
            this.log(`[警告] 无法购买: ${canBuy.reason}`);
            return;
        }

        if (Economy.buy(shopId, itemId, count)) {
            this.log(`购买成功: ${config?.name ?? itemId} x${count}`);
        } else {
            this.log('[警告] 购买失败!');
        }

        this.refreshShopUI();
    }

    /**
     * 示例：批量购买
     */
    onClickBuyMultiple(): void {
        const shopId = 'general_shop';
        const itemId = 'potion_hp_small';
        const count = 5;

        const config = ITEM_CONFIGS[itemId];
        let successCount = 0;

        for (let i = 0; i < count; i++) {
            if (Economy.buy(shopId, itemId, 1)) {
                successCount++;
            } else {
                break;
            }
        }

        this.log(`批量购买: ${config?.name ?? itemId} 成功 ${successCount}/${count}`);
        this.refreshShopUI();
    }

    /**
     * 示例：购买折扣商品
     */
    onClickBuyDiscountItem(): void {
        const shopId = 'event_shop';
        const itemId = 'potion_hp_large';

        const shopItems = Economy.shop.listShopItems(shopId);
        const shopItem = shopItems.find(item => item.itemId === itemId);

        if (!shopItem) {
            this.log('[警告] 商品不存在!');
            return;
        }

        this.log(`原价: ${shopItem.originalPrice}, 折后价: ${shopItem.currentPrice}`);

        if (Economy.buy(shopId, itemId, 1)) {
            this.log(`购买折扣商品成功!`);
        }
    }

    /**
     * 示例：出售物品
     */
    onClickSellItem(): void {
        const items = Economy.inventory.getItems();
        if (items.length === 0) {
            this.log('[警告] 背包为空!');
            return;
        }

        // 找到可出售的物品
        const sellableItem = items.find(item => {
            const config = ITEM_CONFIGS[item.itemId];
            return config?.sellPrice && config.sellPrice > 0;
        });

        if (!sellableItem) {
            this.log('[警告] 没有可出售的物品!');
            return;
        }

        const config = ITEM_CONFIGS[sellableItem.itemId];
        const sellCount = 1;
        const sellPrice = Math.floor((config?.sellPrice ?? 0) * 0.5);

        if (Economy.sell(sellableItem.itemId, sellCount)) {
            this.log(`出售 ${config?.name ?? sellableItem.itemId} x${sellCount}，获得 ${sellPrice} 金币`);
        }
    }

    /**
     * 示例：刷新商店
     */
    onClickRefreshShop(): void {
        const shopId = 'event_shop';
        const shop = Economy.shop.getShop(shopId);

        if (shop?.refreshCost) {
            this.log(`刷新商店需要消耗 ${shop.refreshCost.amount} ${shop.refreshCost.type}`);
        }

        if (Economy.shop.refreshShop(shopId)) {
            this.log('商店刷新成功!');
            this.refreshShopUI();
        } else {
            this.log('[警告] 刷新失败，可能是货币不足!');
        }
    }

    // ==================== 存档示例 ====================

    /**
     * 示例：保存游戏
     */
    onClickSave(): void {
        const saveData = Economy.save();

        // 实际项目中应该保存到本地存储或服务器
        localStorage.setItem('economy_save', JSON.stringify(saveData));

        this.log('游戏数据已保存');
        this.log(`存档大小: ${JSON.stringify(saveData).length} 字节`);
    }

    /**
     * 示例：加载游戏
     */
    onClickLoad(): void {
        const saveDataStr = localStorage.getItem('economy_save');

        if (!saveDataStr) {
            this.log('[警告] 没有找到存档!');
            return;
        }

        try {
            const saveData = JSON.parse(saveDataStr);
            Economy.load(saveData);

            this.log('游戏数据已加载');
            this.refreshUI();
        } catch (e) {
            this.log('[错误] 存档数据损坏!');
        }
    }

    /**
     * 示例：重置游戏
     */
    onClickReset(): void {
        Economy.reset();

        // 重新给初始资源
        Economy.currency.setBalance(CurrencyType.Gold, 10000, 'reset');
        Economy.currency.setBalance(CurrencyType.Diamond, 500, 'reset');
        Economy.currency.setBalance(CurrencyType.Stamina, 100, 'reset');

        this.log('游戏数据已重置');
        this.refreshUI();
    }

    /**
     * 示例：导出存档（调试用）
     */
    onClickExportSave(): void {
        const saveData = Economy.save();
        const jsonStr = JSON.stringify(saveData, null, 2);

        this.log('=== 存档数据 ===');
        this.log(jsonStr.substring(0, 200) + '...');
        console.log('完整存档数据:', saveData);
    }

    // ==================== 高级功能示例 ====================

    /**
     * 示例：打开宝箱
     */
    onClickOpenBox(): void {
        const boxId = 'box_gold_small';

        if (!Economy.inventory.hasItem(boxId, 1)) {
            this.log('[警告] 没有宝箱!');
            return;
        }

        // 移除宝箱
        Economy.removeItem(boxId, 1);

        // 随机奖励
        const goldReward = Math.floor(Math.random() * 400) + 100;
        Economy.addGold(goldReward, 'open_box');

        this.log(`打开宝箱获得 ${goldReward} 金币!`);
    }

    /**
     * 示例：批量操作
     */
    onClickBatchOperation(): void {
        // 批量检查货币
        const canAfford = Economy.currency.canAffordMultiple([
            { type: CurrencyType.Gold, amount: 500 },
            { type: CurrencyType.Diamond, amount: 50 },
        ]);

        this.log(`批量检查货币: ${canAfford ? '足够' : '不足'}`);

        if (canAfford) {
            // 批量消耗
            const success = Economy.currency.spendMultiple([
                { type: CurrencyType.Gold, amount: 500 },
                { type: CurrencyType.Diamond, amount: 50 },
            ], 'batch_test');

            this.log(`批量消耗: ${success ? '成功' : '失败'}`);
        }

        // 批量检查物品
        const hasItems = Economy.inventory.hasItems([
            { itemId: 'potion_hp_small', count: 5 },
            { itemId: 'material_iron', count: 10 },
        ]);

        this.log(`批量检查物品: ${hasItems ? '足够' : '不足'}`);
    }

    /**
     * 示例：查看交易历史
     */
    onClickViewHistory(): void {
        const history = Economy.currency.getHistory({ limit: 10 });

        this.log('=== 最近10条货币变动 ===');
        for (const record of history) {
            const time = new Date(record.timestamp).toLocaleTimeString();
            const sign = record.delta > 0 ? '+' : '';
            this.log(`[${time}] ${record.type}: ${sign}${record.delta} (${record.reason})`);
        }
    }

    /**
     * 示例：查看背包统计
     */
    onClickViewStats(): void {
        const items = Economy.inventory.getItems();
        const totalItems = items.reduce((sum, item) => sum + item.count, 0);
        const usedSlots = Economy.inventory.getUsedSlots();
        const freeSlots = Economy.inventory.getFreeSlots();

        this.log('=== 背包统计 ===');
        this.log(`物品总数: ${totalItems}`);
        this.log(`已用格子: ${usedSlots}`);
        this.log(`空闲格子: ${freeSlots}`);

        // 按类型统计
        const typeCount: Record<string, number> = {};
        for (const item of items) {
            const config = ITEM_CONFIGS[item.itemId];
            if (config) {
                typeCount[config.type] = (typeCount[config.type] || 0) + item.count;
            }
        }

        for (const [type, count] of Object.entries(typeCount)) {
            this.log(`  ${type}: ${count}`);
        }
    }

    /**
     * 示例：查看商店统计
     */
    onClickViewShopStats(): void {
        const shops = Economy.shop.getAllShops();

        this.log('=== 商店统计 ===');
        for (const shop of shops) {
            const items = Economy.shop.listShopItems(shop.id);
            const buyableCount = items.filter(item => item.canBuy).length;

            this.log(`${shop.name}:`);
            this.log(`  商品数: ${items.length}`);
            this.log(`  可购买: ${buyableCount}`);
        }
    }

    // ==================== 工具方法 ====================

    /**
     * 记录日志
     */
    private log(message: string): void {
        const time = new Date().toLocaleTimeString();
        const logMessage = `[${time}] ${message}`;

        this._logMessages.push(logMessage);
        if (this._logMessages.length > this._maxLogCount) {
            this._logMessages.shift();
        }

        // 更新日志面板
        if (this.logPanel) {
            const label = this.logPanel.getComponentInChildren(Label);
            if (label) {
                label.string = this._logMessages.join('\n');
            }
        }

        console.log(logMessage);
    }

    /**
     * 清空日志
     */
    onClickClearLog(): void {
        this._logMessages = [];
        if (this.logPanel) {
            const label = this.logPanel.getComponentInChildren(Label);
            if (label) {
                label.string = '';
            }
        }
    }
}
