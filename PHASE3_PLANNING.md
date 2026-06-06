# Phase 3 规划文档：UI制作和动画系统

## 概述

Phase 3 将在 Phase 2 完整的战斗系统基础上，建立完整的UI显示和动画效果系统。通过事件驱动的方式，使所有战斗逻辑事件在UI层得到实时可视化。

---

## Phase 3 架构设计

### 核心模块（7个）

#### 1️⃣ **UIManager** - UI管理核心
- 场景初始化
- 视图管理
- 数据绑定
- 事件分发

**关键API**:
```typescript
// 初始化战斗UI
initializeBattle(battleState: IBattleState): void

// 更新单位UI
updateUnitUI(unit: BattleUnit): void

// 显示战斗提示
showBattleMessage(message: string, type: MessageType): void

// 刷新所有UI
refreshAllUI(): void
```

---

#### 2️⃣ **DamageNumberUI** - 伤害数字特效
- 浮动伤害数字
- 暴击闪光
- 治疗绿字
- 数字收集动画

**特效类型**:
- 普通伤害 - 白色
- 暴击伤害 - 红色 + 闪光
- 治疗 - 绿色
- 盾甲吸收 - 蓝色
- 状态伤害 - 紫色

**配置参数**:
```typescript
{
  animationDuration: 1.5,      // 秒
  floatDistance: 150,          // 像素
  fontSize: 32,
  colors: {
    normal: '#FFFFFF',
    crit: '#FF0000',
    heal: '#00FF00',
    shield: '#0088FF',
    status: '#FF00FF'
  }
}
```

---

#### 3️⃣ **ComboIndicatorUI** - 连击指示器
- 连击数计数器
- 里程碑激活动画
- 连击链条显示
- 倒计时提示

**UI元素**:
- 连击数字（大号显示）
- 里程碑里程表（5个位置）
- 连击链条（图标序列）
- 倒计时进度条

---

#### 4️⃣ **EffectAnimationUI** - 效果动画系统
- 技能释放动画
- 元素特效（火/冰/雷等）
- 状态效果可视化
- 暴击闪光

**特效库**:
```typescript
{
  fireAttack: { sprite, duration, scale },
  frostAttack: { sprite, duration, scale },
  healingLight: { sprite, duration, scale },
  criticalHit: { sprite, duration, scale },
  poison: { sprite, duration, loop: true },
  shield: { sprite, duration, loop: true },
  // ... 更多特效
}
```

---

#### 5️⃣ **BossPhaseUI** - Boss阶段UI
- 阶段转换提示
- Boss生命值条（分阶段着色）
- 威胁指示器
- 特殊能力准备提示

**显示信息**:
- 当前阶段（第几/共几）
- HP百分比
- 威胁等级（星级）
- 下阶段倒计时（HP至某个值）

---

#### 6️⃣ **StatusEffectUI** - 状态效果显示
- 单位状态图标
- 状态持续时间
- 多状态堆叠显示
- 状态描述提示

**UI布局**:
```
[单位头像] [状态1图标 持续2] [状态2图标 持续1] [状态3图标]
           ├─ DoT        ├─ 眩晕         └─ 盾甲
```

---

#### 7️⃣ **BattleLogUI** - 战斗日志系统
- 实时战斗事件记录
- 回合摘要
- 滚动日志视图
- 可收缩日志面板

**日志格式**:
```
[第1回合]
- 火焰骑士对木质傀儡造成85点伤害 (暴击!)
- 木质傀儡施加"中毒"于火焰骑士 (持续3回合)
- 冰霜法师对火焰元素体造成120点伤害 (克制!)
...
```

---

## 实现计划

### Stage 1: 核心UI框架（基础UI系统）
- ✅ UIManager - UI管理和初始化
- ✅ 单位头像和信息显示
- ✅ 生命值条 / MP条
- ✅ 基础UI更新逻辑

**预计代码量**: 300-400 行

### Stage 2: 动画和特效
- ✅ DamageNumberUI - 伤害数字动画
- ✅ ComboIndicatorUI - 连击显示
- ✅ EffectAnimationUI - 技能特效库
- ✅ 过渡动画（单位移动、攻击动作等）

**预计代码量**: 600-800 行

### Stage 3: 高级UI
- ✅ BossPhaseUI - Boss阶段转换动画
- ✅ StatusEffectUI - 状态效果可视化
- ✅ BattleLogUI - 战斗日志系统
- ✅ UI响应式布局

**预计代码量**: 400-600 行

### Stage 4: 集成和优化
- ✅ 事件订阅完整集成
- ✅ UI/逻辑解耦验证
- ✅ 性能优化（缓存、对象池）
- ✅ 配置系统

**预计代码量**: 200-300 行

---

## 技术选型

### UI框架
```typescript
// 支持多种UI框架集成

// 选项1: Cocos Creator 原生
import { Node, Label, Sprite, Animation } from 'cc';

// 选项2: 外部库（可选）
// import { Tween } from 'cocos-cc';

// 核心采用 Cocos Creator 内置能力
```

### 动画系统
- **Cocos Tween** 用于平滑动画
- **缓动函数** 库（ease-in, ease-out 等）
- **时间轴系统** 用于复杂动画序列

### 事件驱动
继续使用 Phase 2 的 BattleEventBus：

```typescript
// 战斗逻辑层发送事件
BattleEventBus.emit('DamageDealt', { attacker, defender, damage });

// UI层订阅和响应
BattleEventBus.subscribe('DamageDealt', (data) => {
  DamageNumberUI.show(data.defender.position, data.damage);
});
```

**分离架构**:
```
BattleManager (逻辑)
    ↓ 事件
BattleEventBus (事件总线)
    ↓ 订阅
UIManager (UI层)
    ├─ DamageNumberUI
    ├─ ComboIndicatorUI
    ├─ EffectAnimationUI
    ├─ BossPhaseUI
    ├─ StatusEffectUI
    └─ BattleLogUI
```

---

## 文件结构

```
battle/
├── ui/                                  ✨ NEW (UI层)
│   ├── UIManager.ts                     (UI管理器 300行)
│   ├── DamageNumberUI.ts                (伤害数字 250行)
│   ├── ComboIndicatorUI.ts              (连击显示 200行)
│   ├── EffectAnimationUI.ts             (特效动画 400行)
│   ├── BossPhaseUI.ts                   (Boss UI 150行)
│   ├── StatusEffectUI.ts                (状态显示 200行)
│   ├── BattleLogUI.ts                   (战斗日志 250行)
│   ├── UIConfig.ts                      (配置文件 150行)
│   └── utils/
│       ├── AnimationHelpers.ts          (动画工具 200行)
│       ├── UIConstants.ts               (常量定义 100行)
│       └── EasingFunctions.ts           (缓动函数 150行)
├── ... （其他Phase 2文件保持不变）
```

**预计总代码量**: 1800-2200 行

---

## 关键集成点

### 1. 战斗初始化
```typescript
// BattleManager.startBattle()
UIManager.initializeBattle(battleInstance);
UIManager.renderBattleState(battleInstance);
```

### 2. 伤害事件
```typescript
BattleEventBus.subscribe('DamageDealt', (data) => {
  DamageNumberUI.showDamage(
    data.defender.position,
    data.damage,
    data.isCrit
  );
});
```

### 3. 连击变化
```typescript
BattleEventBus.subscribe('ComboChanged', (data) => {
  ComboIndicatorUI.updateCombo(data.unit, data.comboCount);
  ComboIndicatorUI.animateMilestone(data.milestone);
});
```

### 4. Boss阶段
```typescript
BattleEventBus.subscribe('BossPhaseChanged', (data) => {
  BossPhaseUI.playTransitionAnimation(
    data.bossUnit,
    data.newPhase
  );
});
```

### 5. 状态应用
```typescript
BattleEventBus.subscribe('StatusApplied', (data) => {
  StatusEffectUI.addStatusIcon(data.target, data.statusType);
  EffectAnimationUI.playStatusEffect(data.target, data.statusType);
});
```

---

## 配置示例

### AnimationConfig
```typescript
export const ANIMATION_CONFIG = {
  // 动画时长（秒）
  durations: {
    attackAnimation: 0.6,
    skillCastTime: 1.0,
    damageNumber: 1.5,
    comboTransition: 0.3,
    bossPhaseChange: 2.0,
    statusApply: 0.8
  },

  // 缓动函数
  easings: {
    damageFloat: 'easeOutQuad',
    comboScale: 'easeOutElastic',
    bossPhaseShake: 'easeInOutQuad'
  },

  // 特效参数
  effects: {
    critFlashIntensity: 1.5,
    comboParticleCount: 20,
    bossPhaseShakeAmount: 10
  }
};
```

### UILayoutConfig
```typescript
export const UI_LAYOUT_CONFIG = {
  // 单位位置映射
  unitPositions: {
    player: [
      { position: 1, x: 100, y: 300 },
      { position: 2, x: 100, y: 400 },
      { position: 3, x: 100, y: 500 }
    ],
    enemy: [
      { position: 1, x: 800, y: 300 },
      { position: 2, x: 800, y: 400 },
      { position: 3, x: 800, y: 500 }
    ]
  },

  // 伤害数字浮起起点
  damageNumberOffset: { x: 0, y: -50 },

  // UI面板尺寸
  panels: {
    hpBar: { width: 200, height: 20 },
    statusIcon: { width: 30, height: 30 },
    log: { width: 400, height: 200 }
  }
};
```

---

## 优先级建议

### 🔴 高优先级（必须实现）
1. UIManager - 基础UI管理
2. DamageNumberUI - 伤害反馈
3. ComboIndicatorUI - 连击反馈

### 🟡 中优先级（推荐实现）
4. EffectAnimationUI - 视觉特效
5. StatusEffectUI - 状态显示
6. BossPhaseUI - Boss特殊处理

### 🟢 低优先级（可后续补充）
7. BattleLogUI - 战斗日志
8. 高级动画、粒子效果

---

## 交付清单

### 代码文件
- [ ] UIManager.ts
- [ ] DamageNumberUI.ts
- [ ] ComboIndicatorUI.ts
- [ ] EffectAnimationUI.ts
- [ ] BossPhaseUI.ts
- [ ] StatusEffectUI.ts
- [ ] BattleLogUI.ts
- [ ] UIConfig.ts
- [ ] AnimationHelpers.ts
- [ ] EasingFunctions.ts

### 文档文件
- [ ] PHASE3_IMPLEMENTATION_GUIDE.md
- [ ] UI_COMPONENT_REFERENCE.md
- [ ] ANIMATION_GUIDE.md

### 示例文件
- [ ] UIIntegrationExample.ts

### 测试
- [ ] 完整的事件订阅验证
- [ ] 零新增编译错误

---

## 预期成果

Phase 3 完成后，战斗系统将具备：

✨ **实时UI反馈** - 所有战斗事件即时可视化  
✨ **精美动画** - 伤害、连击、Boss阶段等过渡动画  
✨ **信息清晰** - 状态、数值、日志完整显示  
✨ **沉浸体验** - 完整的游戏战斗美学  
✨ **高效渲染** - 优化的动画和UI性能  

---

**Phase 3 准备就绪！** 按照优先级选择开始实现的模块。

推荐按以下顺序实现：
1. **UIManager** (基础) → 2. **DamageNumberUI** (反馈) → 3. **ComboIndicatorUI** (激励) → 4. 其他高级功能
