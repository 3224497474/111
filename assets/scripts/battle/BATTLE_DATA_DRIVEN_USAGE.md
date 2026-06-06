# 游戏的最外层循环（Meta Game）和核心战斗（Core Game）之间是如何交互的了。
状态机机制：代码里定义了 UnitViewState = 'idle' | 'move' | 'attack' | 'hurt' | 'death'。

# Battle 数据驱动使用说明 

本文档说明当前战斗模块如何基于 Luban 配置表启动战斗，以及常见扩展方式。

## 1. 当前数据流

当前战斗初始化链路已经切换为：

1. `ConfigManager.loadAllConfigs()`
2. `BattleUnitFactory` 从 `ConfigManager.tables` 读取配置
3. `BattleBootstrap` 生成玩家和怪物单位
4. `BattleManager.initializeBattleFromUnits(...)`
5. `BattleSceneController` / `BattleHUDController` 绑定战斗实例

相关文件：

- [`ConfigManager.ts`](/C:/Users/32244/Downloads/NewProjectX4-9/NewProjectX/NewProjectX1/assets/scripts/config/ConfigManager.ts)
- [`BattleUnitFactory.ts`](/C:/Users/32244/Downloads/NewProjectX4-9/NewProjectX/NewProjectX1/assets/scripts/battle/core/BattleUnitFactory.ts)
- [`BattleBootstrap.ts`](/C:/Users/32244/Downloads/NewProjectX4-9/NewProjectX/NewProjectX1/assets/scripts/battle/BattleBootstrap.ts)
- [`BattleManager.ts`](/C:/Users/32244/Downloads/NewProjectX4-9/NewProjectX/NewProjectX1/assets/scripts/battle/BattleManager.ts)

## 2. 配置前提

战斗启动前，需要满足以下条件：

- Luban 导出的 JSON 已放入 `assets/resources/config/`
- `ConfigManager` 能正确读取 `config` 目录
- Luban 生成的 TypeScript `Tables` 已放入 `assets/scripts/schema/`
- 配置表中存在角色、怪物、灵魂对应的数据行

当前默认示例使用：

- 玩家角色 ID：`000001`
- 怪物 ID：`010001`

## 3. 启动战斗

当前 `BattleBootstrap` 会在 `start()` 中自动加载配置并启动战斗：

```ts
public async start(): Promise<void> {
    if (!this.autoStartBattle) {
        return;
    }

    await this.startDataDrivenBattle();
}
```

核心启动逻辑：

```ts
await ConfigManager.loadAllConfigs();

const playerUnits = this.buildPlayerUnits();
const enemyUnits = this.buildEnemyUnits();

const battle = BattleManager.getInstance().initializeBattleFromUnits(
    playerUnits,
    enemyUnits,
);

if (battle) {
    BattleManager.getInstance().startBattle(battle);
    this.sceneController?.bindBattle(battle);
    this.hudController?.bindBattle(battle);
}
```

## 4. 使用 BattleUnitFactory

### 4.1 创建玩家角色

```ts
const player = BattleUnitFactory.createCharacter('000001');
if (player) {
    player.setPosition({ x: -3.6, y: 0 });
}
```

### 4.2 创建怪物

```ts
const monster = BattleUnitFactory.createMonster('010001');
if (monster) {
    monster.setPosition({ x: 3.8, y: 0.4 });
}
```

### 4.3 创建召唤灵魂

```ts
const soul = BattleUnitFactory.createSummonedSoul(masterUnit, '020001');
if (soul) {
    BattleManager.getInstance().addUnitToCurrentBattle(soul);
}
```

`createSummonedSoul(...)` 会自动：

- 继承主人的阵营
- 在主人附近生成
- 挂载 `MinionAIBattleRuntime`

## 5. 当前 BattleBootstrap 示例

玩家只生成 1 个主角：

```ts
private buildPlayerUnits(): BattleUnit[] {
    const summoner = BattleUnitFactory.createCharacter('000001');
    if (!summoner) {
        return [];
    }

    summoner.setPosition({ x: -3.6, y: 0 });
    return [summoner];
}
```

怪物生成 4 只：

```ts
private buildEnemyUnits(): BattleUnit[] {
    const units: BattleUnit[] = [];
    const spawnPositions = [
        { x: 3.2, y: -1.2 },
        { x: 3.8, y: -0.35 },
        { x: 4.2, y: 0.45 },
        { x: 4.8, y: 1.15 },
    ];

    for (let index = 0; index < 4; index++) {
        const monster = BattleUnitFactory.createMonster('010001');
        if (!monster) {
            continue;
        }

        monster.setPosition(spawnPositions[index]);
        units.push(monster);
    }

    return units;
}
```

## 6. 常见扩展方式

### 6.1 切换玩家角色

把：

```ts
BattleUnitFactory.createCharacter('000001')
```

改成：

```ts
BattleUnitFactory.createCharacter('000002')
```

### 6.2 混合怪物编队

```ts
const enemyIds = ['010001', '010001', '010002', '010003'];

const units = enemyIds
    .map((id, index) => {
        const unit = BattleUnitFactory.createMonster(id);
        if (!unit) {
            return null;
        }

        unit.setPosition({ x: 3.4 + index * 0.6, y: -0.9 + index * 0.5 });
        return unit;
    })
    .filter((unit): unit is BattleUnit => unit !== null);
```

### 6.3 手动延迟启动

如果不想在场景加载后自动开战：

```ts
@property
public autoStartBattle = false;
```

然后在按钮或流程节点中调用：

```ts
await this.startDataDrivenBattle();
```

## 7. 容错约定

当前战斗入口的容错策略：

- 配置表加载失败：`console.error` 并中止启动
- 配置表已加载但 `tables` 为空：`console.error` 并中止启动
- 工厂创建单位失败：跳过该单位；如果某一侧没有可用单位，则中止整场战斗

## 8. 后续建议

下一步建议继续收敛两块：

1. 给 `TbCharacter`、`TbMonster`、`TbSoul` 增加 `skillIds`、`attackRange`、`element` 等字段，减少工厂里的默认值
2. 把 `BattleBootstrap` 的玩家/怪物 ID 改为外部关卡配置，而不是写死在类常量里
