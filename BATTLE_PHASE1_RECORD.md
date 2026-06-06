# 战斗系统第一期记录

日期：2026-03-31

## 一期目标

第一期目标按已确认范围执行：

1. 角色移动、自动索敌、普攻、死亡
2. 远程投射物和近战命中特效
3. 自带技能蓝条系统
4. 接入现有 `RuneBattleRuntime`，让属性/供能/技能/终极生效
5. 为后续补充更细的供能触发预留结构

## 一期完成情况

当前可以判定为“逻辑层完成”。

已完成内容：

- 新增最小战斗数据结构：
  - `assets/scripts/battle/Types.ts`
  - `assets/scripts/battle/DataManager.ts`
  - `assets/scripts/battle/BattleEventBus.ts`
- 新增战斗核心逻辑：
  - `assets/scripts/battle/BattleUnit.ts`
  - `assets/scripts/battle/BattleTeam.ts`
  - `assets/scripts/battle/BattleManager.ts`
- 已支持玩家点击地面后设置整队移动目标
- 已支持队伍聚集移动，队伍速度按当前存活成员平均移速计算
- 已支持角色被控制后停止移动
- 已支持自动索敌与自动普攻
- 已支持近战即时命中与远程投射物飞行命中
- 已支持普攻回蓝、蓝满自动释放角色自带技能
- 已支持符纹运行时接入：
  - 属性符纹战斗开始时生效
  - 供能符纹监听伤害事件充能
  - 技能符纹/终极符纹自动施法
- 已把 `Runes` 对战斗层的引用统一切到新的 `assets/scripts/battle/` 路径

## 当前行为定义

### 1. 移动

- 玩家侧通过 `BattleManager.setPlayerMoveTarget()` 设置整队移动目标
- 玩家队伍以锚点方式聚集移动
- 玩家队伍成员移动速度统一按平均值推进
- 敌方单位当前为自动追击最近目标

### 2. 攻击

- 角色自动寻找最近敌人
- 进入攻击范围后自动普攻
- 远程普攻生成投射物
- 近战普攻直接结算伤害，并抛出近战特效事件
- 支持边移动边攻击

### 3. 死亡

- 生命值降到 `0` 时死亡
- 战斗结束时自动清理符纹运行时

### 4. 蓝条与技能

- 每次普攻按 `mpGainPerAttack` 回蓝
- 蓝条达到 `maxMp` 后自动释放角色自带技能
- 技能支持伤害、治疗、控制
- 远程控制技能改为投射物命中后生效

### 5. 符纹

- `RuneBattleRuntime` 已接入 `BattleManager.startBattle()`
- 伤害结算时会抛出 `DamageApplied`
- 供能符纹可继续使用当前“造成伤害 / 受到伤害”两类触发

## 一期未覆盖内容

以下内容不算一期缺失，而是明确留到后续阶段：

- 场景节点和表现层组件接线
- 动画状态机实际播放
- UI 血条、蓝条、战斗 HUD
- Buff / Debuff 独立系统
- 更复杂的技能效果组合
- 更细的符纹供能触发：
  - 暴击充能
  - 击杀充能
  - 定时充能
  - 攻击次数充能
- 关卡规则、波次、Boss 机制
- 自动化测试与数值平衡验证

## 本期关键事件

当前战斗层已预留并使用的核心事件包括：

- `BattleStarted`
- `BattleEnded`
- `SquadMoveTargetChanged`
- `BasicAttackFired`
- `ProjectileSpawned`
- `ProjectileImpact`
- `MeleeHitEffectRequested`
- `SkillEffectRequested`
- `BuiltinSkillTriggered`
- `SkillCast`
- `DamageApplied`
- `HealApplied`
- `ControlApplied`
- `UnitDied`

## 验证情况

- 已完成新增逻辑代码的结构自检
- 已尝试使用 Cocos 自带 TypeScript 编译器做全量检查
- 当前仓库本身存在大量历史 TypeScript 报错与 Cocos 声明冲突，无法用全量 `tsc` 作为本期净验证
- 过滤 `assets/scripts/battle` 与 `assets/scripts/Runes` 相关输出时，未看到本次新增逻辑的直接报错

## 结论

如果以“战斗逻辑层第一期”作为验收口径，当前状态可以记为：

`第一期完成`

但这仍然是“逻辑完成，表现接线未完成”的版本。第二期应重点把场景、动画、技能表现、Buff 系统和更完整的数据驱动补上。
