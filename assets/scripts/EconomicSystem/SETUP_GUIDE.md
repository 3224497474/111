# 经济系统设置指南

## 场景节点结构

```
EconomyScene (场景根节点)
├── EconomyFullExample (脚本)
├── CurrencyPanel (货币显示面板)
│   ├── GoldLabel (Label) - 金币显示
│   ├── DiamondLabel (Label) - 钻石显示
│   └── StaminaLabel (Label) - 体力显示
├── InventoryPanel (背包面板)
│   ├── Title (Label) - "背包"
│   ├── InventoryScroll (ScrollView)
│   │   └── Content (自动布局)
│   └── Buttons
│       ├── AddItemBtn (Button) - 添加物品
│       ├── RemoveItemBtn (Button) - 移除物品
│       ├── UseItemBtn (Button) - 使用物品
│       ├── SortBtn (Button) - 排序
│       └── CleanupBtn (Button) - 清理过期
├── ShopPanel (商店面板)
│   ├── Title (Label) - "商店"
│   ├── ShopScroll (ScrollView)
│   │   └── Content (自动布局)
│   └── Buttons
│       ├── BuyBtn (Button) - 购买
│       ├── BuyMultipleBtn (Button) - 批量购买
│       ├── BuyDiscountBtn (Button) - 购买折扣商品
│       ├── SellBtn (Button) - 出售
│       └── RefreshBtn (Button) - 刷新商店
├── ActionPanel (操作面板)
│   ├── CurrencyButtons
│   │   ├── AddGoldBtn (Button) - +100金币
│   │   ├── SpendGoldBtn (Button) - -50金币
│   │   ├── AddDiamondBtn (Button) - +50钻石
│   │   └── RecoverStaminaBtn (Button) - +50体力
│   ├── AdvancedButtons
│   │   ├── OpenBoxBtn (Button) - 打开宝箱
│   │   ├── BatchOpBtn (Button) - 批量操作
│   │   ├── ViewHistoryBtn (Button) - 查看历史
│   │   ├── ViewStatsBtn (Button) - 背包统计
│   │   └── ViewShopStatsBtn (Button) - 商店统计
│   └── SaveLoadButtons
│       ├── SaveBtn (Button) - 保存
│       ├── LoadBtn (Button) - 加载
│       ├── ResetBtn (Button) - 重置
│       └── ExportBtn (Button) - 导出存档
└── LogPanel (日志面板)
    ├── Title (Label) - "日志"
    ├── LogContent (Label) - 日志内容
    └── ClearBtn (Button) - 清空日志
```

## 绑定步骤

### 1. 创建场景节点

在Cocos Creator中按照上述结构创建节点。

### 2. 添加脚本

将 `EconomyFullExample.ts` 脚本添加到 `EconomyScene` 节点。

### 3. 绑定属性

在Inspector中绑定以下属性：

| 属性 | 绑定节点 |
|------|----------|
| goldLabel | CurrencyPanel/GoldLabel |
| diamondLabel | CurrencyPanel/DiamondLabel |
| staminaLabel | CurrencyPanel/StaminaLabel |
| inventoryScroll | InventoryPanel/InventoryScroll |
| shopScroll | ShopPanel/ShopScroll |
| logPanel | LogPanel/LogContent |

### 4. 绑定按钮事件

为每个按钮绑定点击事件：

1. 选中按钮节点
2. 在Button组件的Click Events中添加事件
3. 将EconomyScene节点拖入目标
4. 选择EconomyFullExample脚本
5. 选择对应的方法

按钮与方法对应表：

| 按钮 | 方法名 |
|------|--------|
| AddGoldBtn | onClickAddGold |
| SpendGoldBtn | onClickSpendGold |
| AddDiamondBtn | onClickAddDiamond |
| RecoverStaminaBtn | onClickRecoverStamina |
| AddItemBtn | onClickAddItem |
| RemoveItemBtn | onClickRemoveItem |
| UseItemBtn | onClickUseItem |
| SortBtn | onClickSortInventory |
| CleanupBtn | onClickCleanupExpired |
| BuyBtn | onClickBuyItem |
| BuyMultipleBtn | onClickBuyMultiple |
| BuyDiscountBtn | onClickBuyDiscountItem |
| SellBtn | onClickSellItem |
| RefreshBtn | onClickRefreshShop |
| OpenBoxBtn | onClickOpenBox |
| BatchOpBtn | onClickBatchOperation |
| ViewHistoryBtn | onClickViewHistory |
| ViewStatsBtn | onClickViewStats |
| ViewShopStatsBtn | onClickViewShopStats |
| SaveBtn | onClickSave |
| LoadBtn | onClickLoad |
| ResetBtn | onClickReset |
| ExportBtn | onClickExportSave |
| ClearBtn | onClickClearLog |

## 功能说明

### 货币操作
- **+100金币**: 增加100金币
- **-50金币**: 消耗50金币（不足时提示）
- **+50钻石**: 增加50钻石
- **+50体力**: 恢复50体力

### 背包操作
- **添加物品**: 随机添加1-5个随机物品
- **移除物品**: 随机移除背包中的物品
- **使用物品**: 使用第一个消耗品
- **排序**: 按类型、品质、数量排序
- **清理过期**: 移除已过期的物品

### 商店操作
- **购买**: 购买小型生命药水
- **批量购买**: 购买5个小型生命药水
- **折扣商品**: 购买活动商店的折扣商品
- **出售**: 出售背包中的物品
- **刷新**: 刷新活动商店（消耗50钻石）

### 高级功能
- **打开宝箱**: 消耗宝箱获得随机金币
- **批量操作**: 批量检查和消耗货币/物品
- **查看历史**: 显示最近10条货币变动
- **背包统计**: 显示背包物品统计
- **商店统计**: 显示所有商店信息

### 存档功能
- **保存**: 保存到localStorage
- **加载**: 从localStorage加载
- **重置**: 重置所有数据
- **导出**: 在控制台输出完整存档数据

## 扩展指南

### 添加新物品

1. 在 `ITEM_CONFIGS` 中添加新物品配置：
```typescript
'new_item_id': {
    id: 'new_item_id',
    name: '新物品',
    type: ItemType.Consumable,
    rarity: ItemRarity.Rare,
    icon: 'items/new_item',
    description: '这是一个新物品',
    maxStack: 99,
    sellPrice: 50,
    buyPrice: 100,
    isTradable: true,
},
```

### 添加新商店

1. 在 `SHOP_CONFIGS` 中添加新商店配置：
```typescript
{
    id: 'new_shop',
    name: '新商店',
    refreshType: 'daily',
    items: [
        {
            itemId: 'new_item_id',
            price: 100,
            currencyType: CurrencyType.Gold,
            initialStock: 10,
            dailyLimit: 3,
            refreshType: 'daily',
        },
    ],
},
```

### 添加新货币

1. 在 `EconomicTypesV2.ts` 中添加新货币类型：
```typescript
export enum CurrencyType {
    // ... 现有货币
    NewCurrency = 'newCurrency',
}
```

2. 在 `CurrencySystem.ts` 的 `initDefaultConfigs` 中添加配置。

## 注意事项

1. **物品配置**: 实际项目中应从外部JSON/Excel加载，而非硬编码
2. **存档安全**: 生产环境应对存档数据进行加密
3. **服务器验证**: 重要操作（如购买、货币变动）应在服务器验证
4. **性能优化**: 大量物品时应使用对象池和分帧加载
5. **UI优化**: 使用预制体而非动态创建节点
