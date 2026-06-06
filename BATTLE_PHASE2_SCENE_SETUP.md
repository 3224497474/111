# 第二期场景接入说明
日期：2026-03-31

## 目标

把第二期当前已完成的脚本挂到 battle 场景中，形成一套可直接跑起来的最小接线：

- 点击地面后驱动玩家队伍移动
- 逻辑层单位位置同步到场景节点
- 普攻、技能、死亡、投射物事件驱动表现层
- 头顶血条和蓝条 HUD 跟随单位刷新
- 用一个 bootstrap 脚本把初始化、战斗启动、场景绑定串起来

## 当前已接入脚本

- `assets/scripts/battle/BattleBootstrap.ts`
- `assets/scripts/battle/BattleInputController.ts`
- `assets/scripts/battle/BattleSceneController.ts`
- `assets/scripts/battle/BattleUnitView.ts`
- `assets/scripts/battle/BattleProjectileView.ts`
- `assets/scripts/battle/BattleHUDController.ts`
- `assets/scripts/battle/BattleUnitHudView.ts`

## 推荐节点结构

```text
BattleSceneRoot
├─ BattleBootstrapNode              挂 BattleBootstrap
├─ BattleController                 挂 BattleSceneController
├─ BattleInput                      挂 BattleInputController
├─ BattleHudController              挂 BattleHUDController
├─ PlayerUnits
│  ├─ PlayerUnit1                   挂 BattleUnitView
│  ├─ PlayerUnit2                   挂 BattleUnitView
│  └─ ...
├─ EnemyUnits
│  ├─ EnemyUnit1                    挂 BattleUnitView
│  ├─ EnemyUnit2                    挂 BattleUnitView
│  └─ ...
├─ ProjectileRoot
└─ HudRoot
   ├─ UnitHud_1                     运行时实例化
   ├─ UnitHud_2
   └─ ...
```

## BattleBootstrap 绑定

建议单独放在 `BattleBootstrapNode` 上。

字段说明：

- `sceneController`
  - 绑定 `BattleController`
- `hudController`
  - 绑定 `BattleHudController`
- `autoStartBattle`
  - 默认勾选，进入场景自动启动样例战斗
- `useSampleRuneData`
  - 默认勾选，自动注册 `RuneUsageExample` 的示例符纹数据

当前行为：

1. 注册样例技能配置
2. 可选注册 Rune 示例数据和穿戴
3. 构建 player / enemy 队伍
4. `BattleManager.initializeBattle(...)`
5. `BattleManager.startBattle(...)`
6. 调用 `sceneController.bindBattle(battle)`
7. 调用 `hudController.bindBattle(battle)`
8. 每帧驱动 `BattleManager.update(deltaTime)`

说明：

- 这是第二期当前推荐入口，方便先把场景跑通
- 后面如果接真实关卡数据，可以保留该结构，只替换样例配置来源

## BattleSceneController 绑定

挂到 `BattleController` 节点后，配置：

- `playerUnitNodes`
  - 按顺序绑定玩家角色节点
- `enemyUnitNodes`
  - 按顺序绑定敌方角色节点
- `projectileRoot`
  - 绑定投射物父节点
- `projectilePrefab`
  - 绑定投射物预制体
- `autoBindCurrentBattle`
  - 如果 battle 已先初始化，可勾选
  - 当前接法更推荐由 `BattleBootstrap` 主动调用 `bindBattle`
- `useXZPlane`
  - 3D 场景勾选
- `planeY`
  - 一般填 `0`

当前负责：

- 角色逻辑坐标同步到场景节点
- 基础朝向更新
- `idle / move / attack / death` 基础动作切换
- 监听投射物生成和命中事件，生成与销毁投射物表现节点

## BattleInputController 绑定

挂到 `BattleInput` 节点后，配置：

- `battleCamera`
  - 绑定战斗相机
- `sceneController`
  - 绑定 `BattleController`
- `groundPlaneY`
  - 一般填 `0`
- `enabledInput`
  - 默认勾选

当前行为：

- 监听点击抬起
- 将屏幕点击投影到 `Y = groundPlaneY` 的地面平面
- 把世界坐标映射为逻辑层使用的 `(x, z)` 平面点
- 调用 `sceneController.requestMoveTarget(...)`

## BattleUnitView 绑定

每个角色节点上建议直接预挂 `BattleUnitView`，也可以由 `BattleSceneController` 自动补挂。

推荐配置：

- `visualRoot`
  - 模型不在根节点时绑定模型根
- `animationController`
  - 绑定角色 `Animation`
- `idleAnimation = idle_01`
- `moveAnimation = move_01`
- `attackAnimation = attack_01`
- `hurtAnimation = hurt_01`
- `deathAnimation = death_01`
- `useXZPlane = true`
- `planeY = 0`

当前负责：

- 节点位置同步
- 简单朝向
- 基础动作状态切换
- 监听受击后进入 `hurt_01`

当前还未覆盖：

- 技能专属动作
- 更细的命中特效节点管理

## BattleProjectileView 绑定

投射物预制体上建议挂 `BattleProjectileView`。

推荐配置：

- `useXZPlane = true`
- `planeY = 0`

当前行为：

- `BattleSceneController` 收到 `ProjectileSpawned` 时实例化预制体
- 每帧同步飞行位置
- 收到 `ProjectileImpact` 时销毁对应投射物节点

## BattleHUDController 绑定

挂到 `BattleHudController` 节点后，配置：

- `battleCamera`
  - 绑定战斗相机
- `hudRoot`
  - 绑定 UI 层 HUD 父节点
- `unitHudPrefab`
  - 绑定单个单位 HUD 预制体
- `sceneController`
  - 绑定 `BattleController`
- `autoBindCurrentBattle`
  - 当前更推荐关闭，由 `BattleBootstrap` 统一绑定

当前负责：

- 为双方单位实例化 HUD
- 监听伤害、治疗、蓝量技能释放、控制、死亡事件
- 刷新头顶血条和蓝条
- 每帧把 HUD 跟随到对应世界单位头顶

## BattleUnitHudView 预制体要求

`unitHudPrefab` 上需要有 `BattleUnitHudView` 组件，推荐结构如下：

```text
UnitHudRoot
├─ NameLabel                        Label
├─ HpBar                            ProgressBar
├─ MpBar                            ProgressBar
├─ HpLabel                          Label
└─ MpLabel                          Label
```

字段绑定：

- `nameLabel`
  - 角色名
- `hpBar`
  - 血条进度
- `mpBar`
  - 蓝条进度
- `hpLabel`
  - 文本血量
- `mpLabel`
  - 文本蓝量
- `followHeight`
  - HUD 跟随头顶的高度偏移

说明：

- 当前是最小可用 HUD
- 后续可以继续扩展暴击飘字、施法提示、控制状态图标

## 当前最小启动步骤

如果按当前脚本结构接入，建议顺序如下：

1. 在场景中放好玩家、敌人、投射物、HUD 根节点
2. 挂好 `BattleSceneController`
3. 挂好 `BattleInputController`
4. 挂好 `BattleHUDController`
5. 配置 `BattleBootstrap`
6. 进入场景后由 `BattleBootstrap` 自动启动样例战斗

## 当前限制

- 还没有真实关卡数据源和队伍编成入口
- 还没有技能专属动画时间轴
- 还没有受击表现、飘字、调试面板
- HUD 目前只做了基础血蓝显示

## 下一步建议

优先进入第二期下一阶段：

1. 技能表现细化：技能特效、命中时序、受击后的更细状态
2. HUD 增强：飘字、施法提示、控制状态
3. 更细的符纹供能触发：暴击、击杀、定时充能
4. 把样例配置切到真实战斗配置表
