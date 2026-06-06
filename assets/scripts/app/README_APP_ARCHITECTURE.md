# App 架构说明

本文档说明 `scripts/app` 目录的职责、核心类关系、数据流，以及当前项目中推荐的接入方式。

## 目录结构

```text
scripts/app/
  GameFacade.ts
  LegacyGameContextBridge.ts
  SaveCoordinator.ts
  facades/
    EconomyFacade.ts
    HomeFacade.ts
    ProgressFacade.ts
  save/
    modules/
      EconomySaveModule.ts
      HomeSaveModule.ts
      ProgressSaveModule.ts
      RuneSaveModule.ts
      SoulSaveModule.ts
      TimeSaveModule.ts
```

## 设计目标

这层的目标不是再造一个新的全局状态中心，而是把以下职责收口：

- 统一运行时入口
- 统一聚合存档入口
- 统一旧 `GameContext` 的兼容桥接
- 把 UI / Scene 和底层业务单例解耦

当前主链已经调整为：

```text
Scene / UI
  -> GameFacade
    -> 子门面（Economy / Home / Progress）
      -> 业务模块
        -> SaveCoordinator
          -> SaveModules
```

## 核心角色

### 1. GameFacade

`GameFacade` 是总控门面，职责只有这些：

- 初始化系统
- 注册存档模块
- 统一加载 / 保存
- 绑定自动保存监听
- 对外暴露子门面

它当前公开的核心入口：

- `GameFacade.instance.hasAnySave()`
- `GameFacade.instance.loadGame()`
- `GameFacade.instance.saveGame()`
- `GameFacade.instance.bootstrapHomeScene()`
- `GameFacade.instance.economy`
- `GameFacade.instance.home`
- `GameFacade.instance.progress`

注意：

- `GameFacade` 不应该承载具体业务规则
- 新业务优先加到子门面，不要继续把逻辑堆回 `GameFacade`

### 2. EconomyFacade

`EconomyFacade` 对应经济域的高层访问入口。

当前职责：

- 导出经济快照
- 导入经济快照
- 提供经济域变更监听

它底层依赖：

- `Economy`
- `CurrencySystem`
- `InventorySystem`
- `ShopSystem`

适用场景：

- 需要统一读取经济状态
- 需要监听整个经济域变化

### 3. HomeFacade

`HomeFacade` 对应 Home 域的高层访问入口。

当前职责：

- 暴露 `HomeStatusModel` 快照
- 暴露 Home 变化监听
- 导出 / 导入 Home 存档
- 导出 / 导入 Soul 存档
- 导出 / 导入 Rune 存档
- 收集角色当前装备的符文 ID

它底层依赖：

- `HomeStatusModel`
- `SoulSystem`
- `RuneSystem`

适用场景：

- 首页 UI 刷新
- Home 域状态同步
- 战前读取角色符文装配

### 4. ProgressFacade

`ProgressFacade` 管理原来散落在 `GameContext` 上、但不属于经济或 Home 域的进度数据。

当前托管的数据：

- `formation`
- `heroBuild`
- `runes`
- `dateSelection`
- `battleContext`

当前核心能力：

- `exportSave()`
- `importSave()`
- `getFormation()`
- `getHeroBuild()`
- `getBattleContext()`
- `getEquippedRuneIds()`
- `hasDateSelection()`
- `getDateSelection()`
- `saveDateSelection()`
- `prepareBattle()`

适用场景：

- 编队进入战斗前准备数据
- 日期选择调试保存
- 战斗场景读取准备好的上下文

## 存档结构

### 1. SaveCoordinator

`SaveCoordinator` 是聚合存档协调器。

职责：

- 注册 `SaveModule`
- 收集所有模块快照
- 统一序列化
- 写入本地存储
- 统一恢复模块状态

它不关心业务细节，只做存档编排。

### 2. SaveModules

每个 `SaveModule` 只处理一个模块边界内的数据：

- `EconomySaveModule`
- `HomeSaveModule`
- `SoulSaveModule`
- `RuneSaveModule`
- `TimeSaveModule`
- `ProgressSaveModule`

规则：

- `capture()` 只负责导出快照
- `restore()` 只负责恢复快照
- 不写跨模块业务逻辑

### 3. LegacyGameContextBridge

`LegacyGameContextBridge` 是旧 `GameContext` 的兼容层。

职责：

- 判断旧本地存档是否存在
- 读取旧 `GameContext` 存档
- 把当前运行时状态同步回旧 `GameContext`

注意：

- `GameContext` 现在的定位是兼容 DTO 和旧存档桥
- 新运行时逻辑不要再直接依赖 `GameContext.instance`

## 当前数据流

### 启动加载

```text
GameLaunch
  -> GameFacade.hasAnySave()
  -> GameFacade.loadGame()
     -> 优先读取 SaveCoordinator 聚合存档
     -> 若无则回退 LegacyGameContextBridge
     -> 恢复 Economy / Home / Soul / Rune / Time / Progress
```

### 运行时自动保存

```text
业务模块变化
  -> GameFacade 监听到变更
  -> 同步一次 LegacyGameContextBridge 内存镜像
  -> SaveCoordinator.requestSave()
  -> 聚合写盘
```

### 战斗准备

```text
UI 点击进入战斗
  -> GameFacade.progress.prepareBattle(...)
  -> GameFacade.saveGame()
  -> BattleBootstrap 从 GameFacade.progress 读取 battleContext
```

### 日期保存

```text
DatePickerDebugSaver
  -> GameFacade.progress.saveDateSelection(...)
  -> GameFacade.saveGame()
```

## 示例

### 1. 启动时加载

```ts
if (GameFacade.instance.hasAnySave()) {
    GameFacade.instance.loadGame();
}
```

### 2. 首页场景启动

```ts
const homeUI = await GameFacade.instance.bootstrapHomeScene();
if (!homeUI) {
    return;
}
```

### 3. 准备战斗数据

```ts
GameFacade.instance.progress.prepareBattle({
    heroId: '000001',
    equippedSoulIds: ['soul_1', 'soul_2'],
    equippedSkillIds: [1002, 1004],
    builtinSkillId: null,
    equippedRuneIds: GameFacade.instance.home.collectEquippedRuneIds('000001'),
    enemyIds: ['010001', '010002'],
});

GameFacade.instance.saveGame();
```

### 4. 保存日期选择

```ts
GameFacade.instance.progress.saveDateSelection({
    text: '测试文本',
    month: 4,
    day: 14,
    dateStr: '4-14',
});

GameFacade.instance.saveGame();
```

### 5. 读取 Home 快照

```ts
const snapshot = GameFacade.instance.home.getHomeSnapshot();
console.log(snapshot.level, snapshot.money);
```

## 新功能接入规范

如果你要新增一个系统，优先按下面顺序接入：

1. 先确定它属于哪个域
   - 经济相关，进 `EconomyFacade`
   - Home / 角色相关，进 `HomeFacade`
   - 进度 / 战斗准备 / 选择记录相关，进 `ProgressFacade`

2. 如果需要持久化
   - 给它新增一个 `SaveModule`
   - 注册到 `GameFacade.registerSaveModules()`

3. 如果需要运行时统一入口
   - 在对应子门面上暴露高层 API
   - 不要让 UI 直接摸底层单例

4. 如果只是旧系统兼容
   - 放到 `LegacyGameContextBridge`
   - 不要把兼容逻辑写回主门面和业务门面

## 当前边界

当前已经实现：

- 运行时主链走 `GameFacade`
- 聚合存档主链走 `SaveCoordinator`
- `GameContext` 降为兼容桥
- 战斗准备和日期保存改走 `ProgressFacade`

当前仍保留的兼容接口：

- `Economy.saveToGameContext() / loadFromGameContext()`
- `HomeStatusModel.saveToGameContext() / loadFromGameContext()`
- `SoulSystem.saveToGameContext() / loadFromGameContext()`
- `RuneSystem.saveToGameContext() / loadFromGameContext()`
- `bindGameContextSync()`

这些接口现在主要用于兼容旧代码，不建议作为新代码入口。

## 不推荐做法

- 不要在新代码里直接使用 `GameContext.instance`
- 不要在 UI 脚本里直接拼业务单例
- 不要跳过 `GameFacade` 直接写本地存储
- 不要把新业务继续堆到 `GameFacade` 本体

## 推荐做法

- UI / Scene 先找 `GameFacade`
- 业务能力优先下沉到子门面
- 存档统一走 `SaveCoordinator`
- 旧系统兼容统一走 `LegacyGameContextBridge`



















 按你当前仓库，dirty-flag 最稳的具体改造清单如下。

  第一步
  改 [SaveModule.ts](F:\BaiduNetdiskDownload\COCOS\cocswechat-main\assets\scripts\X\core\save\modules\SaveModule.ts)。

  新增扩展接口，不直接破坏旧接口：

  export interface IDirtySaveModule<TSnapshot = unknown> extends ISaveModule<TSnapshot> {
    isDirty(): boolean;
    markDirty(reason?: string): void;
    clearDirty(): void;
  }

  再加一个可复用基类，建议放新文件：
  [DirtySaveModule.ts](F:\BaiduNetdiskDownload\COCOS\cocswechat-
  main\assets\scripts\X\core\save\modules\DirtySaveModule.ts)

  职责：

  - 默认 dirty = true
  - 提供 isDirty/markDirty/clearDirty
  - 给具体模块继承

  第二步
  改 [SaveCoordinator.ts](F:\BaiduNetdiskDownload\COCOS\cocswechat-main\assets\scripts\app\SaveCoordinator.ts)。

  新增字段：

  - snapshotCache: Record<string, unknown> = {}
  - modules: Map<string, ISaveModule>

  新增内部方法：

  - isDirtyModule(module): module is IDirtySaveModule
  - getModulesToCapture()
  - captureChangedModules()
  - clearDirtyModules(modules)

  保存逻辑改成：

  1. 找 dirty module
  2. 只 capture dirty module
  3. merge 进 snapshotCache
  4. 用 snapshotCache 组装 envelope
  5. 成功后 clear dirty

  加载逻辑改成：

  1. 取消 pending save
  2. 读盘
  3. snapshotCache = envelope.modules
  4. isRestoring = true
  5. restoreAll(snapshotCache)
  6. isRestoring = false
  7. clear 所有 dirty module

  第三步
  改 [ProgressFacade.ts](F:\BaiduNetdiskDownload\COCOS\cocswechat-main\assets\scripts\app\facades\ProgressFacade.ts)。

  新增：

  - private listeners = new Set<() => void>()
  - onChanged(listener)
  - offChanged(listener)
  - notifyChanged()

  在这些方法里触发：

  - importSave()
  - saveDateSelection()
  - prepareBattle()

  这样 ProgressSaveModule 才能自动标脏。

  第四步
  改 6 个 SaveModule：

  - [EconomySaveModule.ts](F:\BaiduNetdiskDownload\COCOS\cocswechat-
    main\assets\scripts\app\save\modules\EconomySaveModule.ts)
  - [HomeSaveModule.ts](F:\BaiduNetdiskDownload\COCOS\cocswechat-main\assets\scripts\app\save\modules\HomeSaveModule.ts)
  - [SoulSaveModule.ts](F:\BaiduNetdiskDownload\COCOS\cocswechat-main\assets\scripts\app\save\modules\SoulSaveModule.ts)
  - [RuneSaveModule.ts](F:\BaiduNetdiskDownload\COCOS\cocswechat-main\assets\scripts\app\save\modules\RuneSaveModule.ts)
  - [TimeSaveModule.ts](F:\BaiduNetdiskDownload\COCOS\cocswechat-main\assets\scripts\app\save\modules\TimeSaveModule.ts)
  - [ProgressSaveModule.ts](F:\BaiduNetdiskDownload\COCOS\cocswechat-
    main\assets\scripts\app\save\modules\ProgressSaveModule.ts)

  统一改法：

  - 继承 DirtySaveModule
  - 在构造时订阅对应域变化
  - 变化时 markDirty()
  - restore() 结束后不要手动 mark
  - 成功保存后由 SaveCoordinator 统一 clearDirty()

  对应监听源建议是：

  - EconomySaveModule
    监听 GameFacade.instance.economy.onChanged()
  - HomeSaveModule
    监听 HomeStatusModel.onStatusChanged()
  - SoulSaveModule
    监听 SoulSystem.subscribe()
  - RuneSaveModule
    监听 RuneSystem.subscribe()
  - TimeSaveModule
    监听 TimeSystem.onTimeChanged()
  - ProgressSaveModule
    监听 GameFacade.instance.progress.onChanged()

  第五步
  改 [GameFacade.ts](F:\BaiduNetdiskDownload\COCOS\cocswechat-main\assets\scripts\app\GameFacade.ts)。

  这里不需要大改数据流，但建议补两个约束：

  - loadGame() 完成后调用一次 saveCoordinator 的“清洁化”逻辑
  - handleStateChanged() 保持只做：
      - syncLegacyRuntimeState()
      - saveCoordinator.requestSave()

  不要在 GameFacade 再手动维护 dirty 状态，dirty 应该属于 module 层。

  第六步
  兼容阶段先不要动：

  - [LegacyGameContextBridge.ts](F:\BaiduNetdiskDownload\COCOS\cocswechat-
    main\assets\scripts\app\LegacyGameContextBridge.ts)
  - [GameContext.ts](F:\BaiduNetdiskDownload\COCOS\cocswechat-main\assets\scripts\data\GameContext.ts)

  原因：

  - dirty-flag 目标是优化聚合存档主链
  - 兼容桥只负责镜像同步
  - 先别把两件事搅在一起

  1. SaveModule.ts + DirtySaveModule.ts
  2. ProgressFacade.ts
  3. ProgressSaveModule.ts
  4. SaveCoordinator.ts
  5. EconomySaveModule.ts
  6. Home/Soul/Rune/Time 四个模块
  7. 回归验证

  验证重点
  你改完后重点看这几件事：
  - 改金币时，只应脏 economy
  - 改日期时，只应脏 progress
  - 读档后不应立刻再次触发写档
  - 旧 GameContext 镜像仍然能同步

  如果你要，我下一步可以直接进入实现，把这套 dirty-flag 方案按这个清单落代码。


› 确认


• 我按确认的 dirty-flag 清单开始落代码：先补 SaveModule 扩展和 DirtySaveModule 基类，再改 ProgressFacade 与
  SaveCoordinator，最后让各 SaveModule 接上自动标脏。

• Updated Plan
  └ 开始实现 dirty-flag 存档优化：先基础接口与协调器，再接各模块自动标脏。
    □ 扩展 SaveModule 接口并新增 DirtySaveModule 基类
    □ 给 ProgressFacade 增加变更通知
    □ 改造 SaveCoordinator 为 dirty-aware + snapshot cache
    □ 改造各 SaveModule 接入自动标脏
    □ 做静态回归检查
