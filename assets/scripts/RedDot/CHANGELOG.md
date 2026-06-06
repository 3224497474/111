# 红点系统更新日志

## v2.1.0 (2026-03-30)

### 🔧 功能修复

#### 核心功能问题修复
1. **启动时机** - `initialize()` 从构造函数移出，由外部显式调用，解决配置未注册就init的问题
2. **离线计算** - `loadFromLocal()` 后正确恢复 `_lastLoginTime`，离线时长计算生效
3. **聚合值重建** - `loadFromLocal()` 后调用 `rebuildAllTotals()`，持久化恢复后红点立即生效
4. **脏标记** - `getState()` 时读取并清除脏标记，不再提前清除
5. **集中配置** - 添加 `ConfigRegistry` 集中注册机制
6. **配置注销** - 添加 `unregisterConfig(id)` 和 `unregisterAllConfigs()` API
7. **纯parentId聚合** - 移除前缀树逻辑，只使用 `parentId`，简化复杂度
8. **对象池安全** - `getState()` 返回新对象，不再复用池对象，避免数据错乱
9. **Key枚举** - 新增 `RedPointKeys.ts`，使用枚举替代字符串，避免手写错误

#### 性能优化
1. **O(n²)聚合** - 改为增量更新，从O(n²)降为O(h)，h为层级深度
2. **同步存储** - 改为批量延迟写入队列，减少localStorage调用
3. **线性搜索** - `_pendingUpdates` 从数组改为 `Map`，查找从O(n)降为O(1)
4. **图标缓存** - 添加 `Map<string, SpriteFrame>` 缓存，避免重复加载
5. **动画重复** - 添加状态检查，`updateAnimation` 前验证状态，避免重复启动
6. **弹跳位置** - 保存 `originalY` 到实例变量，停止动画时正确恢复
7. **setTimeout** - 改用 Cocos Scheduler (`director.getScheduler()`)，跨平台安全

#### 新增文件
- `RedPointKeys.ts` - Key枚举定义，包含常用红点Key和分组

### 📝 使用变化

**必须初始化：**
```typescript
import { RedPointMgr } from './RedDot';

// 游戏启动时调用一次（必须在所有红点配置注册之前）
RedPointMgr.initialize();
```

**推荐使用Key枚举：**
```typescript
import { RedPointMgr, RedPointKey } from './RedDot';

// 使用枚举替代字符串
RedPointMgr.setValue(RedPointKey.Task, 3);
RedPointMgr.setValue(RedPointKey.Mail, 1);

// 获取聚合值
const total = RedPointMgr.getTotal(RedPointKey.Task);
```

### 编辑器使用

在 Cocos Creator 编辑器中：
1. 选择红点节点
2. 在 RedPointItemV2 组件的 Inspector 面板中
3. **Key** 和 **Parent Key** 属性现在显示为下拉选择框
4. 选择对应的枚举值即可

**枚举优势：**
- 避免手写拼写错误
- 编辑器自动补全
- 重构安全
- 便于查找引用

---

## v2.0.0 (2026-03-27)

### 🎉 重大更新

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
- ✅ Inspector配置自动注册

#### 文件结构
```
RedDot/
├── RedPointTypes.ts        # 类型定义
├── RedPointManagerV2.ts    # 增强版管理器
├── RedPointItemV2.ts       # 增强版组件
├── RedPointExample.ts      # 使用示例
├── index.ts                # 模块入口
├── redPointManager.ts      # 旧版管理器（兼容）
├── RedPointItem.ts         # 旧版组件（兼容）
└── CHANGELOG.md            # 更新日志
```

#### 使用方式

**预制体配置：**
```typescript
// 在 Inspector 中配置 RedPointItemV2 组件：
// - key: Root/Home/Task
// - displayType: Number
// - parentKey: Root/Home
// - countLabel: 拖入Label节点
// - persistLocal: true
// - resetRule: Daily
```

**逻辑层控制：**
```typescript
import { RedPointMgr } from './RedDot';

// 设置红点值
RedPointMgr.setValue('Root/Home/Task', 3);

// 增量修改
RedPointMgr.add('Root/Home/Mail', 1);
```

#### 商业游戏功能对比

| 功能 | 优化前 | 优化后 |
|------|--------|--------|
| 布尔型红点 | ✅ | ✅ |
| 数值型红点 | ❌ | ✅ |
| 动画型红点 | ❌ | ✅ |
| 图标型红点 | ❌ | ✅ |
| 前缀树聚合 | ✅ | ✅ |
| 自定义聚合规则 | ❌ | ✅ |
| 本地持久化 | ❌ | ✅ |
| 定时重置 | ❌ | ✅ |
| 离线计算 | ❌ | ✅ |
| 批量更新 | ❌ | ✅ |
| 延迟刷新 | ❌ | ✅ |
| 脏标记 | ❌ | ✅ |
| 分帧更新 | ❌ | ✅ |
| 对象池 | ❌ | ✅ |

---

## v1.0.0 (2026-03-27)

### 🎉 初始版本

#### 基础红点系统

**redPointManager（红点管理器）**
- ✅ 前缀树聚合
- ✅ 数值型红点（>0显示）
- ✅ 增量操作
- ✅ 监听注册

**RedPointItem（红点组件）**
- ✅ 简单红点（显示/隐藏）
- ✅ 自动注销

#### 文件结构
```
easyFramework/mgr/
├── redPointManager.ts      # 红点管理器
└── RedPointItem.ts         # 红点组件
```
