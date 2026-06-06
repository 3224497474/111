# 独立战斗系统框架 - 功能需求文档

**版本**: 1.0  
**更新日期**: 2026.03.23  
**用途**: 可复用的独立游戏战斗框架，支持多种游戏类型

---

## 一、系统概览

### 1.1 设计原则
- ✅ **完全独立** - 不依赖现有游戏框架，可直接用于其他项目
- ✅ **高度可配置** - 所有游戏参数通过配置表控制，代码通用
- ✅ **模块化设计** - 各功能模块独立，可按需组装
- ✅ **事件驱动** - 通过事件系统解耦，便于监听和扩展
- ✅ **易于测试** - 核心逻辑与UI分离

### 1.2 核心模块结构
```
BattleFramework/
├── Core/                     # 核心战斗逻辑
│   ├── BattleManager         # 战斗全局管理器
│   ├── BattleUnit            # 战斗单位(英雄/敌人)
│   ├── BattleRound           # 回合管理
│   └── BattleState           # 战斗状态机
│
├── System/                   # 战斗系统模块
│   ├── DamageSystem          # 伤害计算系统
│   ├── SkillSystem           # 技能系统
│   ├── StatusSystem          # 状态效果系统
│   ├── ElementSystem         # 属性克制系统
│   ├── PositionSystem        # 位置系统
│   └── RewardSystem          # 奖励系统
│
├── Data/                     # 数据与配置
│   ├── DataManager           # 数据管理器
│   ├── HeroData              # 英雄配置数据
│   ├── SkillData             # 技能配置数据
│   ├── EnemyData             # 敌人配置数据
│   ├── StageData             # 副本配置数据
│   └── ConstantConfig        # 常量配置
│
├── AI/                       # 敌人AI系统
│   ├── AIController          # AI控制器
│   └── AIStrategy            # AI策略库
│
├── UI/                       # UI交互层
│   ├── BattleUIManager       # 战斗UI管理器
│   ├── BattleUIController    # UI控制器
│   └── BattleUIDisplay       # UI显示组件
│
├── Event/                    # 事件系统
│   └── BattleEventBus        # 战斗事件总线
│
└── Utilities/                # 工具类
    ├── Calculator            # 计算工具
    ├── RandomGenerator       # 随机生成工具
    └── Utils                 # 通用工具

```

---

## 二、核心功能点

### 功能一级分类

| 分类 | 功能 | 优先级 | 状态 |
|------|------|--------|------|
| **战斗流程** | 基础回合流程 | P0 | [ ] |
| | 战斗开始/结束 | P0 | [ ] |
| | 胜负判定 | P0 | [ ] |
| **单位系统** | 英雄单位创建 | P0 | [ ] |
| | 敌人单位创建 | P0 | [ ] |
| | 单位属性管理 | P0 | [ ] |
| | 单位状态同步 | P0 | [ ] |
| **伤害系统** | 基础伤害计算 | P0 | [ ] |
| | 暴击系统 | P1 | [ ] |
| | 连击系统 | P1 | [ ] |
| | 属性克制 | P1 | [ ] |
| | 位置克制 | P1 | [ ] |
| **技能系统** | 技能数据结构 | P0 | [ ] |
| | 技能释放逻辑 | P0 | [ ] |
| | 技能冷却管理 | P1 | [ ] |
| | 技能效果应用 | P0 | [ ] |
| **状态系统** | Buff管理 | P1 | [ ] |
| | Debuff管理 | P1 | [ ] |
| | 状态叠加规则 | P1 | [ ] |
| **AI系统** | 敌人AI决策 | P0 | [ ] |
| | 随机技能选择 | P0 | [ ] |
| | 智能AI策略 | P2 | [ ] |
| **队伍系统** | 队伍编组(2-5人) | P0 | [ ] |
| | 队伍排列 | P0 | [ ] |
| | 队伍切换 | P2 | [ ] |
| **副本系统** | 副本配置加载 | P0 | [ ] |
| | 副本规则应用 | P1 | [ ] |
| | BOSS特殊机制 | P2 | [ ] |
| **奖励系统** | 掉落计算 | P1 | [ ] |
| | 奖励发放 | P1 | [ ] |
| **UI系统** | 战斗UI框架 | P0 | [ ] |
| | 实时信息同步 | P0 | [ ] |
| | 交互反馈 | P1 | [ ] |
| **事件系统** | 事件总线 | P0 | [ ] |
| | 事件发布订阅 | P0 | [ ] |

---

## 三、详细功能需求

### 3.1 战斗流程模块 (BattleManager + BattleRound)

#### 3.1.1 战斗初始化
```
功能名称: InitializeBattle
输入:
  - playerTeam: Unit[]      // 玩家队伍(2-5人)
  - enemyTeam: Unit[]       // 敌方队伍(2-5人)
  - stageConfig: StageConfig // 副本配置
  - maxRounds: number       // 最大回合数(默认30)

输出:
  - battle: BattleInstance  // 战斗实例

处理流程:
1. 创建战斗实例
2. 初始化双方队伍单位
3. 加载副本规则到战斗状态
4. 初始化回合管理器
5. 触发 BattleStarted 事件
6. 返回可用的战斗实例

验证:
- 队伍人数 >= 2 且 <= 5
- 所有单位初始HP > 0
- 副本配置有效
```

#### 3.1.2 执行一个回合
```
功能名称: ExecuteRound
输入:
  - battle: BattleInstance
  - allActions: BattleAction[]  // 所有单位的行动表

处理流程:
1. 轮次开始检查(检查是否有人死亡)
2. 如果有人死亡，判断胜负，返回
3. 按速度排序出手顺序
4. 逐个执行单位行动:
   a. 检查单位是否可行动(眩晕/冰冻等)
   b. 如果可行动:
      - 执行行动(攻击/技能/防守)
      - 计算伤害
      - 应用状态效果
      - 触发相关事件
   c. 如果不可行动:
      - 跳过该单位
      - 触发 UnitSkipped 事件
5. 所有单位行动完成后:
   - 更新所有持续性效果(毒、燃烧等)
   - 回合数+1
   - 触发 RoundEnded 事件
6. 检查战斗是否结束

返回:
  - roundResult: {
      actions: ExecutedAction[],    // 执行的所有行动
      deadUnits: Unit[],            // 本回合死亡的单位
      battleEnded: boolean,         // 战斗是否结束
      winner?: 'player' | 'enemy'   // 胜者(如果战斗结束)
    }

验证:
- Actions 列表不为空
- 每个 Action 对应一个活着的单位
```

#### 3.1.3 战斗结束判定
```
功能名称: CheckBattleEnd
输入:
  - battle: BattleInstance

返回:
  - battleResult: {
      ended: boolean,
      winner?: 'player' | 'enemy',
      reason: string  // "all_enemy_dead" | "all_player_dead" | "max_rounds_reached" | "escaped"
    }

条件:
- 敌方全灭 → 玩家赢
- 玩家全灭 → 敌方赢
- 达到最大回合数 → 按血量判定
- 玩家逃跑成功 → 战斗中止
```

#### 3.1.4 战斗数据查询
```
功能名称: GetBattleStatus
输入:
  - battle: BattleInstance

返回:
  {
    currentRound: number,
    maxRounds: number,
    playerTeam: {
      units: UnitStatus[],
      aliveCount: number,
      totalHP: number
    },
    enemyTeam: {
      units: UnitStatus[],
      aliveCount: number,
      totalHP: number
    },
    battleState: 'preparing' | 'ongoing' | 'ended',
    winner?: 'player' | 'enemy',
    stageConfig: StageConfig
  }
```

---

### 3.2 单位系统 (BattleUnit)

#### 3.2.1 单位创建与初始化
```
功能名称: CreateBattleUnit
输入:
  - unitConfig: {
      unitId: string,           // 单位唯一ID
      heroId?: number,          // 英雄ID(玩家单位使用)
      enemyId?: number,         // 敌人配置ID(敌人单位使用)
      isPlayer: boolean,        // 是否是玩家方
      position: 1-5,            // 位置(1=前排, 5=后排)
      level: number,            // 等级
      equipment?: Equipment[],  // 装备列表
      skills: Skill[],          // 技能列表
    }

返回:
  - unit: BattleUnit {
      unitId: string,
      hp: number,
      maxHp: number,
      mp: number,
      maxMp: number,
      attack: number,
      defense: number,
      speed: number,
      position: number,
      element: string,
      skills: Skill[],
      statusEffects: StatusEffect[],
      isDead: boolean,
      isPlayer: boolean,
      ...
    }

处理:
1. 从配置加载基础属性
2. 应用等级加成
3. 应用装备加成
4. 初始化技能列表
5. 初始化技能冷却
6. 触发 UnitCreated 事件
```

#### 3.2.2 属性查询与修改
```
功能名称: GetUnitAttribute / SetUnitAttribute
输入:
  - unit: BattleUnit
  - attributeName: string
  - value?: number

返回:
  - attributeValue: number (Get) / success: boolean (Set)

支持的属性:
- hp, maxHp, mp, maxMp
- attack, defense, speed
- critRate, critDamage
- dodgeRate, hitRate
```

#### 3.2.3 单位伤害处理
```
功能名称: ApplyDamageToUnit
输入:
  - unit: BattleUnit
  - damageData: {
      damageValue: number,
      isCritical: boolean,
      damagetype: 'physical' | 'magical',
      attacker: BattleUnit,
      isHealing: boolean  // 如果为true，则为治疗
    }

处理:
1. 如果是治疗，直接加血:
   - newHp = min(hp + damageValue, maxHp)
2. 如果是伤害:
   a. 检查被动护盾/无敌
   b. 计算实际伤害
   c. 扣血: newHp = max(hp - actualDamage, 0)
3. 触发 UnitDamaged 事件
4. 如果 hp <= 0:
   - isDead = true
   - 触发 UnitDied 事件

返回:
  - {
      finalDamage: number,
      finalHP: number,
      isDead: boolean
    }
```

#### 3.2.4 单位死亡处理
```
功能名称: KillUnit
输入:
  - unit: BattleUnit
  - killer?: BattleUnit

处理:
1. 移除所有可移除的Buff/Debuff
2. 设置 isDead = true
3. 触发 UnitDied 事件
4. 返回死亡确认
```

#### 3.2.5 单位技能管理
```
功能名称: GetAvailableSkills / GetSkillCooldown
输入:
  - unit: BattleUnit

返回:
  - availableSkills: Skill[]  // 可用(冷却完成)的技能列表
  - skillCooldowns: Map<skillId, remainingRounds>

功能名称: UseSkill
输入:
  - unit: BattleUnit
  - skill: Skill
  - targets: BattleUnit[]

处理:
1. 检查技能是否可用(冷却、MP等)
2. 消耗资源(MP/HP等)
3. 设置技能冷却
4. 返回技能使用成功标记
```

---

### 3.3 伤害计算系统 (DamageSystem)

#### 3.3.1 基础伤害计算
```
功能名称: CalculateBaseDamage
输入:
  - attacker: BattleUnit
  - defender: BattleUnit
  - skill: Skill  // null 表示普通攻击

返回:
  - baseDamage: number

公式:
baseDamage = (attacker.attack - defender.defense) * skillRatio + equipmentBonus
baseDamage = max(1, baseDamage)

其中:
- skillRatio: 技能的伤害倍率(普通攻击为1.0)
- equipmentBonus: 装备和BUFF的加成
```

#### 3.3.2 暴击判定与计算
```
功能名称: CalculateCriticalDamage
输入:
  - attacker: BattleUnit
  - defenders: BattleUnit
  - baseDamage: number

返回:
  - {
      isCritical: boolean,
      criticalDamage: number  // 如果isCritical为true
    }

流程:
1. 生成随机数(0-1)
2. 如果随机数 < attacker.critRate:
   - isCritical = true
   - criticalDamage = baseDamage * attacker.critDamage
3. 否则:
   - isCritical = false
```

#### 3.3.3 连击判定与计算
```
功能名称: CalculateCombo
输入:
  - attacker: BattleUnit
  - baseDamage: number
  - currentComboCount: number  // 已有的连击数

返回:
  - {
      triggerCombo: boolean,
      comboCount: number,
      comboDamage: number
    }

流程:
1. 检查是否触发连击(概率判定)
2. 如果触发:
   - comboCount = min(currentCombo + 1, maxComboCount)
   - comboDamage = baseDamage * (1 + comboCount * 0.1)
3. 否则:
   - comboCount = 0
```

#### 3.3.4 属性克制计算
```
功能名称: CalculateElementDamage
输入:
  - attacker: BattleUnit  // 攻击者属性
  - defender: BattleUnit  // 防守者属性
  - baseDamage: number

返回:
  - {
      multiplier: number,   // 0.5, 0.75, 1.0, 1.2, 1.5
      relationship: 'weak' | 'resist' | 'normal'
    }

克制表:
- 火克木，木克水，水克火
- 光克暗，暗克光

倍率:
- 有利克制: 1.5x 伤害
- 被克制: 0.5x 伤害
- 无克制关系: 1.0x 伤害
```

#### 3.3.5 位置克制计算
```
功能名称: CalculatePositionDamage
输入:
  - attackerPosition: number (1-5)
  - defenderPosition: number
  - baseDamage: number

返回:
  - {
      multiplier: number,
      description: string
    }

规则(示例):
- 前排(1-2)攻击后排(4-5): 1.2x
- 后排(4-5)攻击前排(1-2): 0.8x
- 相邻位置: 1.0x
- 其他: 1.0x
```

#### 3.3.6 最终伤害合成
```
功能名称: CalculateFinalDamage
输入:
  - attacker: BattleUnit
  - defender: BattleUnit
  - skill: Skill
  - isHealing: boolean

返回:
  - {
      baseDamage: number,
      criticalMultiplier: number,
      elementMultiplier: number,
      positionMultiplier: number,
      defenseReduction: number,
      finalDamage: number,
      breakdown: string  // 用于日志
    }

计算步骤:
1. baseDamage = CalculateBaseDamage()
2. critMultiplier = CalculateCriticalDamage()
3. elementMultiplier = CalculateElementDamage()
4. positionMultiplier = CalculatePositionDamage()
5. defenseReduction = 1 - min(defender.defense / (defender.defense + 100), 0.9)
6. finalDamage = baseDamage * critMultiplier * elementMultiplier 
                 * positionMultiplier * defenseReduction
7. finalDamage = max(1, finalDamage)  // 最少1点伤害

最终公式:
finalDamage = MAX(
    baseDamage * critMultiplier * elementMultiplier * positionMultiplier * defenseReduction,
    1
)
```

---

### 3.4 技能系统 (SkillSystem)

#### 3.4.1 技能数据结构
```typescript
interface SkillConfig {
  // 基础信息
  skillId: number;
  skillName: string;
  description: string;
  icon: string;
  
  // 分类
  type: 'attack' | 'heal' | 'buff' | 'debuff' | 'control';
  targetType: 'single' | 'multi' | 'all' | 'self';
  
  // 消耗
  costType: 'mp' | 'hp' | 'sp';  // MP/HP/技能点
  costValue: number;
  
  // 伤害/治疗
  damageRatio: number;     // 100 = 100% 攻击力
  healRatio?: number;      // 治疗倍率
  
  // 效果
  effects: {
    statusEffectId: number,
    probability: number,    // 触发概率(0-1)
    duration: number,       // 持续回合数
    stacks?: number         // 可叠加层数
  }[];
  
  // 冷却与等级
  cooldown: number;        // 冷却回合数
  requireLevel?: number;   // 需求等级
  
  // 动画与音效
  animationId?: string;
  soundId?: string;
}
```

#### 3.4.2 技能释放
```
功能名称: ReleaseSkill
输入:
  - attacker: BattleUnit
  - skill: Skill
  - targets: BattleUnit[]

返回:
  - skillResult: {
      success: boolean,
      message: string,
      damages: DamageResult[],
      appliedEffects: StatusEffect[],
      animation: string
    }

处理步骤:
1. 检查技能是否可用:
   a. 技能冷却是否完成
   b. 资源(MP/HP)是否足够
   c. 目标是否有效
   d. 单位是否在特殊状态(眩晕等)
2. 消耗资源
3. 对每个目标计算伤害
4. 应用伤害和效果
5. 设置技能冷却
6. 触发技能相关事件
7. 返回结果
```

#### 3.4.3 技能冷却管理
```
功能名称: TickSkillCooldown / ResetSkillCooldown
输入:
  - unit: BattleUnit
  - skillId?: number  (null表示所有技能)

处理:
- 每回合结束时调用 TickSkillCooldown
- 所有技能冷却值 -1
- 如果冷却值 <= 0，设为可用

功能: ResetSkillCooldown
- 重置指定技能的冷却时间
- 通常在BUFF效果中使用
```

---

### 3.5 状态效果系统 (StatusSystem)

#### 3.5.1 状态效果数据结构
```typescript
interface StatusEffect {
  effectId: number;
  effectName: string;
  type: 'buff' | 'debuff';
  
  // 效果类型
  effectType: 
    | 'damage'        // 每回合伤害(燃烧、中毒)
    | 'heal'          // 每回合治疗
    | 'attribute'     // 属性修改(攻击力+20%)
    | 'control'       // 控制效果(眩晕、冰冻)
    | 'immunity'      // 免疫(无敌、免疫伤害)
    | 'shield'        // 护盾
    | 'revive';       // 复活
  
  // 时间属性
  duration: number;         // 持续回合数 (-1 = 永久)
  currentDuration: number;  // 当前剩余回合数
  isPermanent: boolean;     // 是否permanent(如属性提升)
  
  // 叠加与覆盖
  maxStacks: number;        // 最大层数 (1 = 不可叠加)
  currentStacks: number;    // 当前层数
  canStack: boolean;        // 是否可与同类叠加
  canOverride: boolean;     // 是否可被覆盖
  
  // 数值效果
  valueChange?: {
    attribute: string,      // 'attack', 'defense', 'speed'等
    changeValue: number,    // 绝对值修改
    changePercent: number   // 百分比修改(如 -20 表示-20%)
  };
  
  // 伤害效果
  damagePerRound?: number;  // 每回合伤害/治疗值
  
  // 其他
  description: string;
  icon: string;
  source?: BattleUnit;      // 施加者
}
```

#### 3.5.2 状态应用
```
功能名称: ApplyStatus
输入:
  - target: BattleUnit
  - statusEffect: StatusEffect

返回:
  - success: boolean

处理流程:
1. 检查目标能否应用此状态(免疫等)
2. 检查叠加规则:
   a. 如果已有相同效果且不可叠加 → 替换或忽略
   b. 如果可叠加 → 增加层数
   c. 如果不可叠加 → 刷新持续时间
3. 添加到目标的 statusEffects 列表
4. 如果是属性修改，重新计算单位属性
5. 触发 StatusApplied 事件
```

#### 3.5.3 状态刻度(每回合)
```
功能名称: TickStatusEffects
输入:
  - unit: BattleUnit

处理:
1. 遍历所有 statusEffects:
   a. 如果是每回合伤害类(燃烧、中毒):
      - 造成伤害
      - 触发 StatusDamageApplied 事件
   b. duration -1
   c. 如果 duration <= 0:
      - 移除该状态
      - 触发 StatusExpired 事件
      - 重新计算属性
```

#### 3.5.4 状态移除
```
功能名称: RemoveStatus / RemoveAllStatus
输入:
  - unit: BattleUnit
  - statusId?: number  (null表示移除所有)
  - options?: {
      removeBuffsOnly: boolean,
      removeDebuffsOnly: boolean,
      excludeTypes: string[]
    }

处理:
1. 查找目标状态
2. 检查是否可移除(某些状态不可移除)
3. 移除并重新计算属性
4. 触发 StatusRemoved 事件
```

---

### 3.6 AI系统 (AIController)

#### 3.6.1 AI决策
```
功能名称: MakeDecision
输入:
  - unit: BattleUnit  // AI 单位(敌人)
  - battle: BattleInstance
  - aiDifficulty: 'easy' | 'normal' | 'hard'

返回:
  - action: BattleAction {
      unit: BattleUnit,
      actionType: 'attack' | 'skill' | 'defend' | 'flee',
      targetType: 'single' | 'multi',
      targets: BattleUnit[],
      skill?: Skill
    }

处理(随机AI):
1. 获取可用行动列表:
   a. 普通攻击(始终可用)
   b. 可用的技能(资源足够且冷却完成)
   c. 防守
2. 如果有可用技能，50%概率选择技能，50%概率普通攻击
3. 如果选择技能:
   a. 从可用技能中随机选择
   b. 根据skill的targetType选择目标:
      - single: 随机选择一个对手
      - multi: 随机选择多个对手或全体对手
4. 返回选择的行动
```

#### 3.6.2 AI策略库(可扩展)
```
可实现的AI策略:

1. RandomAI (完全随机)
   - 随机选择技能
   - 随机选择目标
   
2. SmartAI (智能AI)
   - 优先攻击血量最低的单位
   - 根据血量使用治疗
   - 根据形势使用控制技能
   
3. AggressiveAI (激进AI)
   - 优先选择高伤害技能
   - 集中火力攻击一目标
   
4. DefensiveAI (防守AI)
   - 血量低时防守
   - 优先使用治疗和增益技能

实现建议:
- 创建 AIStrategy 抽象类/接口
- 各种AI实现该接口
- AIController 通过策略模式调用

接口示例:
interface IAIStrategy {
  makeDecision(unit, battle): BattleAction;
  calculateActionScore(action, battle): number;
}
```

---

### 3.7 队伍系统 (TeamManager)

#### 3.7.1 队伍编组
```
功能名称: CreateTeam
输入:
  - teamType: 'player' | 'enemy'
  - unitConfigs: UnitConfig[]  // 2-5个单位配置

返回:
  - team: {
      teamId: string,
      teamType: 'player' | 'enemy',
      units: BattleUnit[],
      formationType: 'triangle' | 'line' | 'spread',  // 阵型
      getTotalHP(): number,
      getAliveUnits(): BattleUnit[],
      getDeadUnits(): BattleUnit[],
      isAllDead(): boolean
    }

验证:
- unitConfigs.length >= 2 && <= 5
- 所有位置有效(1-5)
- 位置不重复
```

#### 3.7.2 队伍排列
```
功能名称: FormTeam
输入:
  - team: Team
  - formationType: string  // 阵型类型

处理:
- 根据阵型类型安排单位位置
- 触发 TeamFormed 事件

阵型示例:
- triangle (三角): 1-3-1 或 1-2-2
- line (一字): 1-1-1-1-1
- spread (分散): 1-2-3-4-5
```

---

### 3.8 副本系统 (StageManager)

#### 3.8.1 副本配置加载
```typescript
interface StageConfig {
  // 基础信息
  stageId: number;
  stageName: string;
  description: string;
  difficulty: 'easy' | 'normal' | 'hard' | 'nightmare';
  
  // 关卡设置
  minTeamSize: number;      // 最少出战人数
  maxTeamSize: number;      // 最多出战人数
  recommendedLevel: number; // 推荐等级
  
  // 敌方设置
  enemyTeamConfig: {
    enemyIds: number[];     // 敌人ID列表
    bossId?: number;        // BOSS ID(如果有BOSS)
    aiDifficulty: 'easy' | 'normal' | 'hard'
  };
  
  // 副本规则
  stageRules: {
    maxRounds: number;       // 最大回合数
    specialRules: string[];  // 特殊规则ID列表
    elementalOnly?: string;  // 限制元素(如只能用火属性)
    positionLocked?: boolean; // 位置锁定
    noSkillsAllowed?: boolean; // 禁用技能
  };
  
  // BOSS机制
  bossMechanic?: {
    phaseShifts: number[];    // 血量百分比(如[80, 50, 20])
    phaseBehavior: string[];  // 不同阶段的行为
    enrageTimer?: number;     // 激怒计时(回合数)
  };
  
  // 奖励
  rewards: {
    expirience: number;
    gold: number;
    dropTable: DropItem[];
  };
}
```

#### 3.8.2 副本规则应用
```
功能名称: ApplyStageRules
输入:
  - battle: BattleInstance
  - stageConfig: StageConfig

处理:
1. 解析 specialRules 列表
2. 对每个规则:
   - 从规则库中加载规则定义
   - 应用规则到战斗
   - 注册规则相关的事件监听

规则库示例:
- 'limited_mp'      // MP恢复速度减半
- 'element_weak'    // 所有单位属性抗性降低
- 'healing_reduced' // 治疗效果降低50%
- 'turn_limit'      // 限制回合数(如20回合内必须赢)
- 'protect_target'  // 保护某个敌人(被保护时伤害转移)
```

#### 3.8.3 BOSS特殊机制
```
实现思路:
1. BossUnit 继承 BattleUnit
2. 实现特殊的 OnPhaseShift 方法
3. 每个阶段可以有不同的:
   - 属性倍率
   - 可用技能
   - 特殊行为(如召唤小怪)

示例:
interface BossMachine {
  currentPhase: number;
  
  onHPChange(newHP, maxHP): void {
    const phases = [80, 50, 20];
    for (let phase of phases) {
      if (newHP / maxHP <= phase && currentPhase != phase) {
        this.shiftPhase(phase);
      }
    }
  }
  
  shiftPhase(phase: number): void {
    // 播放变身动画
    // 改变属性和技能
    // 触发 BossPhaseShifted 事件
  }
  
  enrage(battle: BattleInstance): void {
    // 激怒效果(一般是攻击力大幅提升)
  }
}
```

---

### 3.9 奖励系统 (RewardSystem)

#### 3.9.1 掉落计算
```
功能名称: CalculateRewards
输入:
  - stageConfig: StageConfig
  - battleResult: {
      winner: 'player' | 'enemy',
      roundsUsed: number,
      damageDealt: number,
      damageReceived: number,
      unitsKilled: number
    }

返回:
  - rewards: {
      experience: number,
      gold: number,
      items: DropItem[],
      bonusRewards?: DropItem[]  // 额外奖励
    }

处理:
1. 如果赢了:
   a. 基础奖励 = 配置中的奖励值
   b. 回合奖励 = 用时越少，奖励越多
   c. 掉落物品:
      - 遍历 dropTable
      - 对每项生成随机数
      - 随机数 < 概率 → 掉落该物品
2. 如果输了:
   - 奖励 = 0
3. 计算额外奖励(如3星通关额外奖励)
```

#### 3.9.2 掉落表配置
```typescript
interface DropItem {
  itemId: number;
  itemName: string;
  rarity: number;         // 稀有度 1-5
  probability: number;    // 掉落概率 (0-1)
  minCount: number;       // 掉落最少数量
  maxCount: number;       // 掉落最多数量
  weight?: number;        // 权重(用于加权随机)
}

// 掉落表示例:
dropTable: [
  { itemId: 1, itemName: '金币', probability: 1.0, minCount: 100, maxCount: 200 },
  { itemId: 101, itemName: '英雄碎片', probability: 0.3, minCount: 1, maxCount: 3 },
  { itemId: 201, itemName: '装备', probability: 0.1, minCount: 1, maxCount: 1 }
]
```

---

### 3.10 事件系统 (BattleEventBus)

#### 3.10.1 事件订阅与发布
```
功能名称: Subscribe / Unsubscribe / Emit
输入:
  - eventName: string
  - callback: (data) => void
  - context?: any

处理:
- Subscribe: 将回调添加到监听列表
- Unsubscribe: 移除监听
- Emit: 触发事件，调用所有监听回调

示例:
bus.subscribe('BattleRoundEnded', (roundData) => {
  console.log(`第 ${roundData.roundNumber} 回合结束`);
});

bus.emit('BattleRoundEnded', { roundNumber: 3 });
```

#### 3.10.2 核心事件列表

| 事件名 | 触发时机 | 数据 |
|--------|---------|------|
| BattleStarted | 战斗开始 | battle, playerTeam, enemyTeam |
| BattleEnded | 战斗结束 | battle, winner, reason, rewards |
| RoundStarted | 回合开始 | battle, roundNumber |
| RoundEnded | 回合结束 | battle, roundNumber, actions |
| UnitActionPerformed | 单位行动 | unit, action, result |
| UnitDamaged | 单位受伤 | unit, damage, attacker |
| UnitHealed | 单位治疗 | unit, healAmount, healer |
| UnitDied | 单位死亡 | unit, killer |
| SkillUsed | 技能释放 | unit, skill, targets, result |
| StatusApplied | 状态应用 | unit, status, source |
| StatusRemoved | 状态移除 | unit, status |
| StatusExpired | 状态过期 | unit, status |

---

## 四、UI系统架构

### 4.1 UI管理器职责
```
BattleUIManager
├── 信息面板(双方队伍、HP/MP、状态)
├── 行动面板(选择行动的UI)
├── 战斗动画播放(伤害数字、特效)
├── 日志显示(战斗记录)
└── 结果呈现(胜负界面)

职责:
1. 监听战斗事件，更新UI
2. 处理玩家输入(点击技能按钮等)
3. 播放动画与音效
4. 管理UI的显示/隐藏
```

### 4.2 数据驱动的UI更新
```
设计原则:
- UI 不直接修改Battle数据
- Battle 通过事件告知 UI 状态变化
- UI 只负责显示，不负责逻辑

流程:
1. 玩家点击"攻击"按钮
2. UIController 捕获点击，调用 BattleManager.PlayerAction()
3. BattleManager 执行逻辑，通过事件发送结果
4. BattleUIManager 监听事件，更新显示

示例:
UIController.onAttackButtonClicked() {
  const action = {
    unit: selectedUnit,
    actionType: 'attack',
    target: selectedTarget
  };
  battleManager.playerSelectAction(action);
}

battleManager.playerSelectAction(action) {
  // ... 执行战斗逻辑
  this.eventBus.emit('UnitDamaged', { unit, damage, ... });
}

uiManager.onUnitDamaged(data) {
  // 更新目标单位的 HP 显示
  // 播放伤害动画
}
```

---

## 五、数据管理

### 5.1 DataManager 职责
```
DataManager (单例模式)
├── LoadHeroData()         // 从配置加载英雄数据
├── LoadSkillData()        // 加载技能配置
├── LoadEnemyData()        // 加载敌人配置
├── LoadStageData()        // 加载副本配置
├── GetHeroConfig()        // 查询英雄配置
├── GetSkillConfig()       // 查询技能配置
└── ...

特点:
- 集中管理所有游戏配置
- 支持运行时加载/卸载
- 缓存常用数据
```

### 5.2 配置文件格式示例

**hero_data.json:**
```json
[
  {
    "id": 1,
    "name": "火焰剑士",
    "element": "fire",
    "baseHP": 100,
    "baseAttack": 50,
    "baseDefense": 30,
    "baseSpeed": 40,
    "skills": [101, 102, 103],
    "rarity": 3
  }
]
```

**skill_data.json:**
```json
[
  {
    "id": 101,
    "name": "强力斩击",
    "type": "attack",
    "targetType": "single",
    "costType": "mp",
    "costValue": 20,
    "damageRatio": 150,
    "cooldown": 0,
    "effects": []
  }
]
```

---

## 六、集成与使用示例

### 6.1 初始化战斗
```typescript
// 1. 创建战斗管理器
const battleManager = new BattleManager();

// 2. 创建玩家队伍配置
const playerTeamConfig = [
  {
    unitId: 'player_hero_1',
    heroId: 1,  // 从英雄库中选择
    isPlayer: true,
    position: 1,
    level: 10,
    skills: [101, 102, 103]
  },
  // ... 更多英雄
];

// 3. 创建敌方队伍
const enemyTeamConfig = [
  {
    unitId: 'enemy_1',
    enemyId: 201,
    isPlayer: false,
    position: 1,
    level: 10
  },
  // ... 更多敌人
];

// 4. 加载副本配置
const stageConfig = dataManager.getStageConfig(stageId);

// 5. 初始化战斗
const battle = battleManager.initializeBattle(
  playerTeamConfig,
  enemyTeamConfig,
  stageConfig
);

// 6. 启动事件监听
battleManager.eventBus.subscribe('BattleEnded', (data) => {
  console.log('战斗结束，赢家:', data.winner);
  // 显示结果界面
});
```

### 6.2 执行一个回合
```typescript
// 获取所有可行动单位
const actionableUnits = battle.getActionableUnits();

// 玩家为自己的单位选择行动
const playerActions = [];
for (let unit of battle.playerTeam.units) {
  if (unit.isDead) continue;
  
  const action = playerUI.waitForPlayerInput(unit);
  playerActions.push(action);
}

// AI为敌方单位选择行动
const enemyActions = [];
for (let unit of battle.enemyTeam.units) {
  if (unit.isDead) continue;
  
  const action = aiController.makeDecision(unit, battle);
  enemyActions.push(action);
}

// 合并所有行动
const allActions = [...playerActions, ...enemyActions];

// 执行回合
const roundResult = battleManager.executeRound(battle, allActions);

// 检查战斗是否结束
if (roundResult.battleEnded) {
  console.log('战斗结束');
} else {
  // 进行下一回合
  executeNextRound();
}
```

---

## 七、扩展点与插件化设计

### 7.1 可扩展的接口
```typescript
// 1. 自定义伤害计算器
interface IDamageCalculator {
  calculateDamage(attacker, defender, skill): number;
}

// 2. 自定义AI策略
interface IAIStrategy {
  makeDecision(unit, battle): BattleAction;
}

// 3. 自定义副本规则
interface IStageRule {
  onRoundStart(battle): void;
  onRoundEnd(battle): void;
  onUnitAction(action, battle): void;
}

// 4. 自定义状态效果
interface IStatusEffect {
  onApply(unit, battle): void;
  onTick(unit, battle): void;
  onRemove(unit, battle): void;
}
```

### 7.2 插件注册
```typescript
// 注册自定义策略
battleManager.registerAIStrategy('boss_ai', new BossAIStrategy());

// 注册自定义规则
battleManager.registerStageRule('limited_round', new LimitedRoundRule());

// 注册自定义伤害计算器
battleManager.registerDamageCalculator('custom', new CustomCalculator());
```

---

## 八、性能与优化建议

### 8.1 性能考虑
- [ ] 对象池模式:复用 Damage, Action 等临时对象
- [ ] 批量更新:避免逐个更新单位，使用批量接口
- [ ] 事件节流:避免过频繁的事件发送
- [ ] 数据缓存:缓存计算结果如伤害倍率表

### 8.2 内存优化
- [ ] 及时清理事件监听(onDestroy时)
- [ ] 战斗结束后释放临时数据
- [ ] 使用对象池减少内存分配

---

## 九、测试策略

### 9.1 单元测试
- [ ] DamageCalculator 单元测试
- [ ] SkillSystem 单元测试
- [ ] StatusSystem 单元测试
- [ ] AIController 单元测试

### 9.2 集成测试
- [ ] 完整战闘流程测试
- [ ] 不同队伍组合测试
- [ ] 不同副本规则测试

### 9.3 平衡性测试
- [ ] 伤害数值是否合理
- [ ] 技能冷却是否合理

- [ ] 属性克制倍率是否平衡
- [ ] 敌人AI难度是否合理

---

## 十、版本路线图

| 版本 | 功能 | 预期完成 |
|------|------|---------|
| v0.1 | 核心框架、基础战斗流程 | Week 1 |
| v0.2 | 完整伤害计算、技能系统 | Week 2 |
| v0.3 | 状态系统、AI系统 | Week 3 |
| v1.0 | UI、事件、副本系统完整 | Week 4 |
| v1.1 | BOSS机制、特殊规则 | Week 5 |
| v1.2 | 优化、平衡调整、文档 | Week 6 |

---

## 附录：关键代码骨架

### A1. BattleManager 骨架
```typescript
export class BattleManager {
  private battle: BattleInstance;
  public eventBus: BattleEventBus;
  
  constructor() {
    this.eventBus = new BattleEventBus();
  }
  
  initializeBattle(playerTeam, enemyTeam, stageConfig) {
    // TODO: 实现初始化逻辑
  }
  
  executeRound(battle, actions) {
    // TODO: 实现回合执行逻辑
  }
  
  checkBattleEnd(battle) {
    // TODO: 实现胜负判定
  }
}
```

### A2. DamageSystem 骨架
```typescript
export class DamageSystem {
  calculateFinalDamage(attacker, defender, skill) {
    // TODO: 实现伤害计算
  }
  
  calculateCritical(attacker) {
    // TODO: 实现暴击判定
  }
  
  calculateElement(attacker, defender) {
    // TODO: 实现属性克制
  }
}
```

### A3. BattleUnit 骨架
```typescript
export class BattleUnit {
  unitId: string;
  hp: number;
  maxHp: number;
  // ... 其他属性
  
  takeDamage(damage) {
    // TODO: 处理伤害
  }
  
  applyStatus(status) {
    // TODO: 应用状态
  }
  
  die() {
    // TODO: 处理死亡
  }
}
```

---

## 补充说明

1. **独立性**: 本框架不依赖任何游戏引擎特定功能，仅使用基础数据结构和事件机制
2. **复用性**: 所有配置驱动，核心代码与具体数据文件分离
3. **可测试性**: 所有逻辑单元可独立测试，事件系统便于模拟和验证
4. **扩展性**: 通过注册接口和插件机制，支持无限扩展

---

**下一步**: 根据本需求文档的各功能点（按优先级 P0 > P1 > P2）逐个实现代码模块。
