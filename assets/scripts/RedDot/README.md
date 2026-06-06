# 红点系统 (RedDot) V2.1

## 简介

增强版红点系统，支持多种红点类型、动画效果、持久化和性能优化。

## 功能特性

### 红点类型
- **布尔型**：显示/隐藏
- **数值型**：显示数量（支持99+）
- **时间型**：限时显示
- **动画型**：呼吸/闪烁/脉冲/弹跳
- **图标型**：自定义图标

### 性能优化
- 批量更新
- 延迟刷新
- 脏标记
- 分帧更新
- 图标缓存
- 增量聚合更新
- 批量持久化

### 持久化
- 本地存储（批量延迟写入）
- 定时重置（每日/每周/每月）
- 离线计算

### 配置管理
- 集中配置注册
- 配置注销机制
- Key枚举管理（避免手写错误）

## 文件结构

```
RedDot/
├── RedPointTypes.ts        # 类型定义
├── RedPointKeys.ts         # Key枚举定义
├── RedPointManagerV2.ts    # 增强版管理器 V2.1
├── RedPointItemV2.ts       # 增强版组件 V2.1
├── RedPointExample.ts      # 使用示例
├── index.ts                # 模块入口
├── CHANGELOG.md            # 更新日志
└── README.md               # 说明文档
```

## 快速开始

### 1. 初始化

在游戏启动时（如 Game.ts 的 onLoad）调用初始化：

```typescript
import { RedPointMgr } from './RedDot';

// 游戏启动时调用一次
RedPointMgr.initialize();
```

### 2. 预制体配置

在需要红点的节点上添加 `RedPointItemV2` 组件，配置以下属性：

| 属性 | 说明 | 示例 |
|------|------|------|
| Key | 红点唯一标识（使用枚举） | `RedPointKey.Task` |
| Parent Key | 父节点key | `RedPointKey.TaskDaily` |
| Display Type | 显示类型 | `Number` |
| Count Label | 数值Label | 拖入Label节点 |
| Max Value | 最大显示值 | `99` |
| Persist Local | 是否持久化 | `true` |
| Reset Rule | 重置规则 | `Daily` |

### 3. 逻辑层控制

```typescript
import { RedPointMgr, RedPointKey } from './RedDot';

// 设置红点值（使用枚举）
RedPointMgr.setValue(RedPointKey.Task, 3);

// 增量修改
RedPointMgr.add(RedPointKey.Mail, 1);

// 获取值
const value = RedPointMgr.getValue(RedPointKey.Task);

// 获取聚合值（包含子节点）
const total = RedPointMgr.getTotal(RedPointKey.Task);
```

## Key枚举使用

所有红点Key使用枚举管理，避免手写错误：

```typescript
import { RedPointKey, RED_POINT_KEY_GROUPS } from './RedDot';

// 常用Key
RedPointKey.Task           // Root/Task
RedPointKey.Mail           // Root/Mail
RedPointKey.Shop           // Root/Shop

// 获取所有Key
const allKeys = Object.values(RedPointKey);

// 获取分组（用于编辑器显示）
const groups = RED_POINT_KEY_GROUPS;
```

## Display Type 选项

| 类型 | 说明 | 效果 |
|------|------|------|
| Simple | 简单红点 | 显示/隐藏 |
| Number | 数值红点 | 显示数量 |
| Breath | 呼吸动画 | 缩放呼吸 |
| Blink | 闪烁动画 | 透明度闪烁 |
| Pulse | 脉冲动画 | 快速缩放 |
| Bounce | 弹跳动画 | 上下弹跳 |
| Icon | 图标红点 | 自定义图标 |

## API 参考

### RedPointMgr

| 方法 | 说明 |
|------|------|
| `initialize()` | 显式初始化（必须调用） |
| `isInitialized()` | 检查是否已初始化 |
| `registerConfig(config)` | 注册红点配置 |
| `registerConfigs(configs)` | 批量注册配置 |
| `unregisterConfig(id)` | 注销指定配置 |
| `unregisterAllConfigs()` | 注销所有配置 |
| `setValue(key, value)` | 设置红点值 |
| `add(key, delta)` | 增量修改 |
| `getValue(key)` | 获取原始值 |
| `getTotal(key)` | 获取聚合值 |
| `getState(key)` | 获取完整状态 |
| `register(key, callback)` | 注册监听器 |
| `unregister(key, callback)` | 取消监听器 |
| `setRefreshStrategy(strategy)` | 设置刷新策略 |
| `forceFlush()` | 强制刷新 |
| `clear()` | 清空所有数据 |
| `saveToLocal()` | 保存到本地 |
| `loadFromLocal()` | 从本地加载 |
| `getAllKeys()` | 获取所有Key |
| `getActiveKeys()` | 获取有红点的Key |

## V2.1 更新日志

### 修复的功能问题
1. **启动时机** - `initialize()` 从构造函数移出，由外部显式调用
2. **离线计算** - `loadFromLocal()` 后正确恢复 `_lastLoginTime`
3. **聚合值重建** - `loadFromLocal()` 后调用 `rebuildAllTotals()`
4. **脏标记** - `getState()` 时处理脏标记，不再提前清除
5. **集中配置** - 添加 `registerConfig/unregisterConfig` 集中管理
6. **配置注销** - 支持 `unregisterConfig` 和 `unregisterAllConfigs`
7. **纯parentId聚合** - 移除前缀树逻辑，只使用 `parentId`
8. **对象池安全** - `getState()` 返回新对象，不再复用
9. **Key枚举** - 新增 `RedPointKeys.ts`，使用枚举替代字符串

### 修复的性能问题
1. **O(n²)聚合** - 改为增量更新，只更新父路径
2. **同步存储** - 改为批量延迟写入队列
3. **线性搜索** - `_pendingUpdates` 从数组改为 Map
4. **图标缓存** - 添加 `Map<string, SpriteFrame>` 缓存
5. **动画重复** - 添加状态检查，避免重复启动
6. **弹跳位置** - 保存 `originalY` 到实例变量
7. **setTimeout** - 改用 Cocos Scheduler

## 注意事项

1. **初始化** - 必须在游戏启动时调用 `RedPointMgr.initialize()`
2. **Key管理** - 建议使用 `RedPointKey` 枚举定义所有Key
3. **性能** - 大量红点时建议使用延迟刷新模式
4. **持久化** - 需要持久化的红点需配置 `persistLocal: true`
5. **动画** - 动画红点会持续消耗性能，不用时及时隐藏

## 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)
