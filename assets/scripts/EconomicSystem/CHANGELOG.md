# 更新日志

## v1.6.0 (2026-03-27)

### 🎉 新增功能

#### 增强版红点系统

**RedPointManagerV2（红点管理器）**
- ✅ 多种红点类型（布尔、数值、时间、动画、图标）
- ✅ 前缀树聚合（支持自定义聚合规则）
- ✅ 本地持久化
- ✅ 离线计算
- ✅ 批量更新
- ✅ 延迟刷新
- ✅ 脏标记
- ✅ 分帧更新
- ✅ 对象池

**RedPointItemV2（红点组件）**
- ✅ 简单红点（显示/隐藏）
- ✅ 数值红点（显示数量，支持99+）
- ✅ 动画红点（呼吸/闪烁/脉冲/弹跳）
- ✅ 图标红点（自定义图标）
- ✅ 显示动画
- ✅ 自动注销

#### 文件结构
```
easyFramework/mgr/
├── RedPointTypes.ts        # 类型定义
├── RedPointManagerV2.ts    # 增强版管理器
├── RedPointItemV2.ts       # 增强版组件
├── RedPointExample.ts      # 使用示例
├── RedPointIndex.ts        # 模块入口
├── redPointManager.ts      # 旧版管理器（兼容）
└── RedPointItem.ts         # 旧版组件（兼容）
```

#### 使用方式
```typescript
import { RedPointMgr, RedPointAnimation } from './RedPointManagerV2';

// 注册配置
RedPointMgr.registerConfig({
    id: 'Root/Home/Task',
    type: RedPointType.Number,
    animation: RedPointAnimation.Breath,
    maxValue: 99,
    persistType: PersistType.Local,
    resetRule: ResetRule.Daily,
});

// 设置红点值
RedPointMgr.setValue('Root/Home/Task', 3);

// 增量修改
RedPointMgr.add('Root/Home/Mail', 1);
```

---

## v1.5.0 (2026-03-27)

### 🎉 新增功能

#### 增强版经济系统

**CurrencySystem（货币系统）**
- ✅ 多货币支持（金币、钻石、体力、经验等）
- ✅ 货币变化事件通知
- ✅ 交易日志记录
- ✅ 每日获取上限
- ✅ 批量操作支持
- ✅ 数据持久化

**InventorySystemV2（背包系统）**
- ✅ 背包容量限制
- ✅ 物品堆叠上限
- ✅ 物品品质/稀有度
- ✅ 物品强化等级
- ✅ 物品过期机制
- ✅ 物品分类/排序
- ✅ 物品变化事件
- ✅ 批量操作支持
- ✅ 数据持久化

**ShopSystemV2（商店系统）**
- ✅ 多货币商品支持
- ✅ 折扣系统（百分比/固定减免）
- ✅ 限购机制（每日/每周）
- ✅ 商店刷新（自动/手动）
- ✅ 动态价格计算
- ✅ VIP折扣支持
- ✅ 数据持久化

#### 文件结构
```
EconomicSystem/
├── EconomicTypes.ts        # 类型定义
├── CurrencySystem.ts       # 货币系统
├── InventorySystem.ts      # 背包系统
├── ShopSystem.ts           # 商店系统
├── index.ts                # 模块入口
├── ShopUI.ts               # 商店UI（已迁移）
├── EconomyExample.ts       # 基础使用示例
├── EconomyFullExample.ts   # 完整使用示例（含UI）
├── SETUP_GUIDE.md          # 场景设置指南
├── CHANGELOG.md            # 更新日志
└── README.md               # 说明文档
```

#### v1.5.1 (2026-03-27) - 代码清理

**已删除的旧文件：**
- ❌ EconomicTypes.ts (旧版)
- ❌ EconomySystem.ts (旧版)
- ❌ InventorySystem.ts (旧版)
- ❌ ItemConfig.ts (旧版)
- ❌ ShopSystem.ts (旧版)

**重命名的文件：**
- EconomicTypesV2.ts → EconomicTypes.ts
- InventorySystemV2.ts → InventorySystem.ts
- ShopSystemV2.ts → ShopSystem.ts

**已更新的文件：**
- ✅ ShopUI.ts - 迁移到新系统

#### 使用方式
```typescript
import { Economy, CurrencyType, ItemType, ItemRarity } from './EconomicSystem';

// 货币操作
Economy.addGold(100, 'reward');
Economy.spendDiamond(50, 'purchase');

// 物品操作
Economy.addItem('item_health_potion', 5);
Economy.getItemCount('item_health_potion');

// 商店操作
Economy.buy('shop_id', 'item_id', 1);
Economy.sell('item_id', 2);

// 存档
const saveData = Economy.save();
Economy.load(saveData);
```

#### 商业游戏功能对比

| 功能 | 优化前 | 优化后 |
|------|--------|--------|
| 多货币系统 | ❌ | ✅ |
| 物品品质 | ❌ | ✅ |
| 物品效果 | ❌ | ✅ |
| 背包容量 | ❌ | ✅ |
| 物品堆叠 | ❌ | ✅ |
| 动态价格 | ❌ | ✅ |
| 折扣系统 | ❌ | ✅ |
| 商店刷新 | ❌ | ✅ |
| 限购机制 | ❌ | ✅ |
| 交易日志 | ❌ | ✅ |
| 数据持久化 | ❌ | ✅ |
| 事件通知 | ❌ | ✅ |

---

## v1.4.0 (2026-03-27)

### 🎉 新增功能

#### UI 动画系统
- **UIAnimation** - 静态动画工具类
- **AnimatedUIBase** - 动画组件基类
- **Popup** - 增强版弹窗管理器

---

## v1.3.0 (2026-03-27)

### 🎉 新增功能

#### 通用弹窗系统 (PopupManager)
- Toast 轻提示
- Alert 弹窗
- Confirm 弹窗

---

## v1.2.0 (2026-03-27)

### 🎉 新增功能

#### 剧情对话系统
- StoryDialogView
- AffectionPanelView
- ChapterSelectView
- EndingDisplayView

---

## v1.1.0 (2026-03-27)

### 🎉 新增功能

#### 多分支剧情系统
- StoryManager
- StoryFlagManager
- AffectionManager
- EndingManager

---

## v1.0.0 (2026-03-27)

### 🎉 新增功能

#### 日期选择器体验优化
- 平滑缩放动画
- 触觉震动反馈
- 实时预览文本

---

## 自改进系统

### 配置完成
- 安装了 self-improving-for-codex 技能
- 配置了记忆文件目录
- 更新了 AGENTS.md 启动协议
