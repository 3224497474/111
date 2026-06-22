# H UI 框架设计思想与生命周期设计

## 1. 设计目标

`H.ui` 的目标不是简单封装 Cocos Creator 的 `onLoad`、`start`、`onEnable`、`onDisable`、`onDestroy`，而是建立一套面向业务开发的 UI 生命周期。

业务 UI 不应该直接依赖 Cocos 生命周期，也不应该自己管理层级、缓存、打开动画、关闭动画、弹窗栈、事件注销、重复打开、防多开等通用逻辑。

框架目标：

- 业务 UI 只继承框架基类。
- 业务 UI 只实现框架生命周期。
- 所有 UI 打开、刷新、关闭、移除都由 `H.ui` 调度。
- Cocos 生命周期只由框架基类内部使用。
- 页面、弹窗、提示、Loading 分别有自己的基类和默认行为。
- UI 管理器统一处理层级、栈、缓存、动画、互斥、遮罩、返回键和资源释放。
- 业务代码不直接 `instantiate`、`destroy`、`node.active = false`。

核心原则：

```text
Cocos 生命周期只服务框架。
业务生命周期由 H.ui 统一调度。
业务 UI 继承基类，只写 bind / open / enable / refresh / disable / close / remove。
```

## 2. 当前问题

Cocos 原生生命周期适合组件级开发，但不适合作为大型项目 UI 框架的业务生命周期。

常见问题：

- `onLoad` 和 `start` 的调用时机由 Cocos 控制，不适合传业务参数。
- `onEnable` 会因为节点 active 切换反复触发，容易和“打开 UI”混淆。
- 业务开发容易在 `onLoad` 里查找节点、注册事件、请求数据、刷新 UI 混在一起。
- 弹窗关闭时到底是隐藏、缓存还是销毁，没有统一规则。
- 重复打开同一个 UI 时，有的业务想刷新，有的业务想重新打开，缺少统一协议。
- 关闭 UI 时事件监听、定时器、异步请求没有统一清理点。
- 弹窗栈、页面栈、遮罩、返回键通常散落在业务代码里。

所以框架需要把生命周期抽象成业务可理解的流程。

## 3. 总体架构

推荐结构：

```text
assets/scripts/H/ui/
  HUIFacade.ts          // UI 统一管理入口
  HUIViewBase.ts        // 所有 UI 的基础类
  HPageView.ts          // 页面基类
  HDialogView.ts        // 弹窗基类
  HTipView.ts           // 提示基类
  HGuideView.ts         // 引导基类
  HLoadingView.ts       // Loading 基类
  HUIStack.ts           // 页面栈、弹窗栈
  HUIConfig.ts          // UI 配置表
  HUITypes.ts           // UI 类型定义
```

运行关系：

```text
业务层
  -> H.ui.openPage / H.ui.openDialog / H.ui.showTip
    -> HUIFacade
      -> load prefab
      -> instantiate
      -> attach layer
      -> bind context
      -> open lifecycle
      -> stack/cache/layer management
        -> HUIViewBase / HPageView / HDialogView / HTipView / HGuideView / HLoadingView
```

## 4. 生命周期总览

推荐框架生命周期：

```text
load prefab
  -> instantiate
  -> Cocos onLoad
  -> bind
  -> open
  -> enable
  -> refresh
  -> disable
  -> close
  -> remove
  -> Cocos onDestroy
```

详细解释：

| 生命周期 | 调用方 | 次数 | 作用 |
| --- | --- | --- | --- |
| `onLoad` | Cocos | Cocos 控制 | 框架内部初始化，不建议业务重写 |
| `bind` | H.ui | 只调用一次 | 注入 `uiId`、`config`、`manager`、初始参数 |
| `open` | H.ui | 每次打开 | 进入打开流程，处理打开动画前逻辑 |
| `enable` | H.ui | 每次打开 | UI 已显示，可注册临时监听、开启交互 |
| `refresh` | H.ui / 业务 | 可多次 | 刷新界面数据 |
| `disable` | H.ui | 每次隐藏/关闭前 | 禁用交互、停止临时监听 |
| `close` | H.ui | 每次关闭 | 播放关闭动画、保存 UI 状态 |
| `remove` | H.ui | 从管理器移除时 | 彻底移除记录、释放业务引用 |
| `onDestroy` | Cocos | 销毁时 | 框架兜底清理 |

推荐流程：

```text
首次打开：
instantiate -> onLoad -> bind -> open -> enable -> refresh

重复打开已缓存 UI：
open -> enable -> refresh

刷新 UI：
refresh

隐藏 UI：
disable -> close -> node.active = false

移除 UI：
disable -> close -> remove -> destroy/cache
```

## 5. 生命周期命名规范

建议业务基类使用这些方法：

```ts
protected onBind(context: HUIBindContext<TParams>): void;
protected onOpen(params: TParams): void | Promise<void>;
protected onEnableView(): void;
protected onRefresh(params: TParams): void | Promise<void>;
protected onDisableView(): void;
protected onClose(): void | Promise<void>;
protected onRemove(): void | Promise<void>;
```

不建议业务 UI 直接重写：

```ts
onLoad()
start()
onEnable()
onDisable()
onDestroy()
```

如果确实需要框架底层接管，可以由 `HUIViewBase` 使用 `final` 思想约束，即文档约定业务不重写 Cocos 生命周期。

## 6. UI 状态机

推荐 UI 状态：

```ts
export type HUIStatus =
    | 'idle'
    | 'binding'
    | 'closed'
    | 'opening'
    | 'opened'
    | 'refreshing'
    | 'disabling'
    | 'closing'
    | 'removed'
    | 'destroyed';
```

状态流转：

```text
idle
  -> binding
  -> closed
  -> opening
  -> opened
  -> refreshing
  -> opened
  -> disabling
  -> closing
  -> closed
  -> removed
  -> destroyed
```

状态约束：

- `opening` 状态不允许重复打开。
- `closing` 状态不允许重复关闭。
- `removed` 后不允许再次 `open`。
- `destroyed` 后只允许框架清理引用。
- 已 `opened` 的单例 UI 再次打开时走 `refresh`，不重新 `bind`。

## 7. 基类分层设计

### 7.1 HUIViewBase

所有 UI 的根基类，只负责通用生命周期和上下文。

职责：

- 保存 `uiId`、`config`、`params`、`manager`。
- 管理 UI 状态。
- 包装生命周期调用顺序。
- 提供事件自动清理能力。
- 提供异步任务取消标记。
- 提供默认打开/关闭动画入口。
- 自动查找当前 UI 预制体内名为 `bgclose` 的节点，并绑定到 `close()`。

示例：

```ts
export abstract class HUIViewBase<TParams = any> extends Component {
    public uiId = '';
    public uiStatus: HUIStatus = 'idle';

    protected params!: TParams;
    protected manager!: HUIFacade;
    protected config!: HUIConfig;
    protected bound = false;

    public bind(context: HUIBindContext<TParams>): void {
        if (this.bound) {
            return;
        }

        this.uiStatus = 'binding';
        this.uiId = context.id;
        this.manager = context.manager;
        this.config = context.config;
        this.params = context.params;
        this.bound = true;

        this.onBind(context);
        this.uiStatus = 'closed';
    }

    public async open(params?: TParams): Promise<void> {
        if (this.uiStatus === 'opening') {
            return;
        }

        if (params !== undefined) {
            this.params = params;
        }

        this.uiStatus = 'opening';
        this.node.active = true;

        await this.onOpen(this.params);
        await this.playOpenAnimation();

        this.uiStatus = 'opened';
        await this.enable();
        await this.refresh(this.params);
    }

    public async enable(): Promise<void> {
        this.onEnableView();
    }

    public async refresh(params?: TParams): Promise<void> {
        if (params !== undefined) {
            this.params = params;
        }

        if (this.uiStatus === 'removed' || this.uiStatus === 'destroyed') {
            return;
        }

        const previous = this.uiStatus;
        this.uiStatus = 'refreshing';
        await this.onRefresh(this.params);
        this.uiStatus = previous === 'opened' || previous === 'refreshing' ? 'opened' : previous;
    }

    public async disable(): Promise<void> {
        if (this.uiStatus !== 'opened') {
            return;
        }

        this.uiStatus = 'disabling';
        this.onDisableView();
    }

    public async close(reason: HUICloseReason = 'api'): Promise<void> {
        if (this.uiStatus === 'closing' || this.uiStatus === 'closed') {
            return;
        }

        await this.disable();

        this.uiStatus = 'closing';
        await this.onClose();
        await this.playCloseAnimation();

        this.node.active = false;
        this.uiStatus = 'closed';
    }

    public async remove(): Promise<void> {
        if (this.uiStatus === 'removed' || this.uiStatus === 'destroyed') {
            return;
        }

        await this.close();
        await this.onRemove();
        this.uiStatus = 'removed';
    }

    protected onBind(_context: HUIBindContext<TParams>): void {}
    protected onOpen(_params: TParams): void | Promise<void> {}
    protected onEnableView(): void {}
    protected onRefresh(_params: TParams): void | Promise<void> {}
    protected onDisableView(): void {}
    protected onBeforeClose(_reason: HUICloseReason): boolean | Promise<boolean> {
        return true;
    }

    protected onClose(_reason: HUICloseReason): void | Promise<void> {}
    protected onRemove(): void | Promise<void> {}

    protected playOpenAnimation(): Promise<void> {
        return Promise.resolve();
    }

    protected playCloseAnimation(): Promise<void> {
        return Promise.resolve();
    }

    protected onDestroy(): void {
        this.uiStatus = 'destroyed';
    }
}
```

约定：

- 业务只重写 `onBind/onOpen/onEnableView/onRefresh/onDisableView/onClose/onRemove/onBack`。
- 业务不直接重写 `onLoad/start/onEnable/onDisable/onDestroy`。
- 业务通过 `await this.close()` 关闭自己，并等待关闭动画结束。
- 关闭按钮或关闭遮罩节点统一命名为 `bgclose`，框架基类自动绑定点击关闭。

### 7.2 HPageView

页面类，例如大厅、商城、背包、排行榜。

默认行为：

- 默认在 `layer2`。
- 默认进入页面栈。
- 默认和同层页面互斥。
- 可以缓存。
- 返回键默认关闭当前页面或回到上一个页面。

```ts
export abstract class HPageView<TParams = any> extends HUIViewBase<TParams> {
    public readonly uiKind = 'page';

    protected onBack(): boolean {
        return false;
    }
}
```

### 7.3 HDialogView

弹窗类，例如确认框、设置框、奖励框。

默认行为：

- 默认在 `layer3`。
- 默认进入弹窗栈。
- 默认有遮罩。
- 默认可配置点击遮罩关闭。
- 默认支持返回键关闭。
- 可配置是否独占。

```ts
export abstract class HDialogView<TParams = any> extends HUIViewBase<TParams> {
    public readonly uiKind = 'dialog';

    protected closeOnMask = true;
    protected closeOnBack = true;
}
```

### 7.4 HTipView

提示类，例如 toast、飘字、系统提示。

默认行为：

- 默认在 `tip` 层。
- 不进入页面栈和弹窗栈。
- 默认自动移除。
- 不缓存。

```ts
export abstract class HTipView<TParams = any> extends HUIViewBase<TParams> {
    public readonly uiKind = 'tip';
    protected autoRemoveMs = 1500;
}
```

### 7.5 HGuideView

引导类，例如新手引导遮罩、点击限制、手指动画。

默认行为：

- 默认在 `guide` 层。
- 默认阻塞下层点击。
- 不进入页面栈和弹窗栈。
- 可通过 `openGuide` 打开。

```ts
export abstract class HGuideView<TParams = any> extends HUIViewBase<TParams> {
    public readonly uiKind = 'guide';
}
```

### 7.6 HLoadingView

Loading 类，例如全局加载、转场加载。

默认行为：

- 默认在 `transition` 层。
- 可阻塞点击。
- 支持进度更新。
- 支持最短展示时间。

## 8. HUIFacade 管理流程

### 8.1 打开 UI

```text
H.ui.open(id, params)
  -> resolve config
  -> check singleton
  -> if cached and singleton
       -> view.open(params)
       -> view.refresh(params)
       -> return node
  -> load prefab
  -> instantiate
  -> attach layer
  -> find or add HUIViewBase
  -> create record
  -> view.bind(context)
  -> view.open(params)
  -> push stack
  -> return node
```

伪代码：

```ts
public async open(input: HUIOpenInput, params?: any): Promise<Node> {
    const config = this.resolveConfig(input, params);
    const existing = this.getRecord(config.id);

    if (existing && config.singleton !== false) {
        await existing.view.open(params);
        await existing.view.refresh(params);
        return existing.node;
    }

    const node = await this.loadAndCreate(config);
    const view = this.getUIView(node);
    const record = this.createRecord(config, node, view);

    this.attachToLayer(record);
    view.bind({
        id: config.id,
        config,
        params,
        manager: this,
        node,
    });

    await view.open(params);
    this.pushStack(record);

    return node;
}
```

### 8.2 刷新 UI

```text
H.ui.refresh(id, params)
  -> find record
  -> record.view.refresh(params)
```

```ts
public async refresh(id: string, params?: any): Promise<void> {
    const record = this.getRecord(id);
    if (!record) {
        return;
    }
    await record.view.refresh(params);
}
```

### 8.3 关闭 UI

```text
H.ui.close(id)
  -> find record
  -> view.close()
  -> cacheMode = hide: keep node inactive
  -> cacheMode = destroy: remove + destroy
  -> update stack
```

### 8.4 移除 UI

```text
H.ui.remove(id)
  -> find record
  -> view.remove()
  -> remove from stack
  -> remove from records
  -> destroy node
```

`close` 和 `remove` 的区别：

| 方法 | 是否销毁 | 是否从 records 删除 | 适用场景 |
| --- | --- | --- | --- |
| `close` | 看缓存策略 | 不一定 | 普通关闭、可缓存页面 |
| `remove` | 是 | 是 | 强制移除、释放资源、Tip 自动结束 |

## 9. UI 配置设计

UI 路由配置是 UI 框架的入口表。

业务层不应该散落写 `prefabPath`、`layer`、`type`、`cacheMode` 这些底层信息，也不应该到处写字符串 UI 名称。推荐把 UI 名称做成枚举，把每个 UI 的资源路径、层级、类型、缓存策略、遮罩策略都集中到一个配置表里。

推荐路由枚举。

注意：下面是项目侧路由枚举示例，不是 H 框架内置业务页面。H 框架只要求传入稳定的字符串枚举值，具体项目可以定义自己的 `GameUIRoute`、`ProjectUIRoute` 或 `UIRoute`。

```ts
export enum UIRoute {
    HomePage = 'HomePage',
    MainPage = 'MainPage',
    ShopPage = 'ShopPage',
    BagPage = 'BagPage',
    RankPage = 'RankPage',

    ConfirmDialog = 'ConfirmDialog',
    RewardDialog = 'RewardDialog',
    SettingDialog = 'SettingDialog',

    ToastTip = 'ToastTip',
    GuideMask = 'GuideMask',
    GlobalLoading = 'GlobalLoading',
}
```

推荐层级枚举：

```ts
export enum UILayer {
    Layer1 = 'layer1',
    Layer2 = 'layer2',
    Layer3 = 'layer3',
    Layer4 = 'layer4',
    Layer5 = 'layer5',
    Tip = 'tip',
    Guide = 'guide',
    Transition = 'transition',
}
```

推荐路由配置表：

```ts
export const UIRouteConfigs: Record<UIRoute, HUIConfig> = {
    [UIRoute.HomePage]: {
        id: UIRoute.HomePage,
        type: 'page',
        layer: UILayer.Layer1,
        prefabPath: 'ui/page/HomePage',
        singleton: true,
        cacheMode: 'keep',
    },

    [UIRoute.ShopPage]: {
        id: UIRoute.ShopPage,
        type: 'page',
        layer: UILayer.Layer2,
        prefabPath: 'ui/page/ShopPage',
        singleton: true,
        cacheMode: 'keep',
    },

    [UIRoute.ConfirmDialog]: {
        id: UIRoute.ConfirmDialog,
        type: 'dialog',
        layer: UILayer.Layer3,
        prefabPath: 'ui/dialog/ConfirmDialog',
        singleton: true,
        cacheMode: 'destroy',
        blockInput: true,
        closeOnMask: true,
        closeOnBack: true,
    },

    [UIRoute.RewardDialog]: {
        id: UIRoute.RewardDialog,
        type: 'dialog',
        layer: UILayer.Layer4,
        prefabPath: 'ui/dialog/RewardDialog',
        singleton: true,
        cacheMode: 'destroy',
        blockInput: true,
    },

    [UIRoute.ToastTip]: {
        id: UIRoute.ToastTip,
        type: 'tip',
        layer: UILayer.Tip,
        prefabPath: 'ui/tip/ToastTip',
        singleton: false,
        cacheMode: 'destroy',
    },

    [UIRoute.GuideMask]: {
        id: UIRoute.GuideMask,
        type: 'guide',
        layer: UILayer.Guide,
        prefabPath: 'ui/guide/GuideMask',
        singleton: true,
        cacheMode: 'keep',
        blockInput: true,
    },

    [UIRoute.GlobalLoading]: {
        id: UIRoute.GlobalLoading,
        type: 'loading',
        layer: UILayer.Transition,
        prefabPath: 'ui/loading/GlobalLoading',
        singleton: true,
        cacheMode: 'keep',
        blockInput: true,
    },
};
```

业务使用方式：

```ts
await H.ui.openPage(UIRoute.ShopPage, { tab: 'skin' });
await H.ui.openDialog(UIRoute.ConfirmDialog, { title: '提示', content: '是否继续？' });
await H.ui.open(UIRoute.GuideMask, { step: 1 });
H.ui.showTip(UIRoute.ToastTip, { message: '保存成功' });
```

底层执行方式：

```text
业务传入 UIRoute
  -> H.ui 查询 UIRouteConfigs
  -> 根据 type 选择 page/dialog/tip/loading/guide 流程
  -> 根据 layer 挂到对应层级节点
  -> 加载 prefab
  -> bind
  -> open
  -> enable
  -> refresh
```

生命周期必须由框架底层统一执行，业务不能手动调用 `bind`、`enable`、`remove` 等生命周期方法。业务只能通过 `H.ui.open`、`H.ui.refresh`、`H.ui.close`、`H.ui.remove` 进入框架流程。

推荐配置：

```ts
export interface HUIConfig {
    id: string;
    type?: 'page' | 'dialog' | 'tip' | 'loading' | 'guide' | 'custom';
    layer?: UILayer;
    prefabPath?: string;
    bundle?: string;
    scriptName?: string;

    singleton?: boolean;
    cacheMode?: 'destroy' | 'hide' | 'keep';
    exclusive?: boolean;
    mutexGroup?: string;
    group?: string;

    blockInput?: boolean;
    showMask?: boolean;
    closeOnMask?: boolean;
    closeOnBack?: boolean;
    closeOnBgClose?: boolean;
    closeThrottleMs?: number;
    closeStopPropagation?: boolean;
    closeSound?: string;
    maskOpacity?: number;
    maskColor?: { r: number; g: number; b: number; a?: number };
    restorePreviousDialog?: boolean;

    order?: number;
    priority?: number;
    animation?: HUIAnimationType | HUIAnimationConfig;
    openLoading?: boolean | UIOpenLoadingPolicy;
}
```

推荐默认值：

| UI 类型 | 默认层 | singleton | cacheMode | 入栈 | 遮罩 |
| --- | --- | --- | --- | --- | --- |
| page | layer2 | true | keep | pageStack | false |
| dialog | layer3 | true | destroy | dialogStack | true |
| tip | tip | false | destroy | no | false |
| guide | guide | true | keep | no | true |
| loading | transition | true | keep | no | true |

## 10. 层级设计

推荐层级：

```text
layer1       主界面底层：大厅背景、底部导航、常驻主界面
layer2       一级页面层：首页、商城、背包、排行榜
layer3       普通弹窗层：确认框、设置、普通奖励弹窗
layer4       高优先级弹窗层：结算、重要奖励、活动弹窗
layer5       系统弹窗层：公告、强制更新、实名认证、隐私弹窗
guide        引导层：新手引导遮罩、手指动画、点击限制
tip          提示层：Toast、飘字、轻提示
transition   转场/Loading 层：全屏 Loading、场景切换遮罩
```

每层由 `HUIFacade` 自动创建并铺满 root。

业务不直接操作层级节点，只在配置里声明：

```ts
{
    id: UIRoute.ShopPage,
    type: 'page',
    layer: UILayer.Layer2,
    prefabPath: 'ui/page/ShopPage',
}
```

推荐底层层级顺序：

```ts
export const UILayerOrders: Record<UILayer, number> = {
    [UILayer.Layer1]: 100,
    [UILayer.Layer2]: 200,
    [UILayer.Layer3]: 300,
    [UILayer.Layer4]: 400,
    [UILayer.Layer5]: 500,
    [UILayer.Guide]: 600,
    [UILayer.Tip]: 700,
    [UILayer.Transition]: 800,
};
```

层级职责必须固定，项目业务只能新增具体 UI 配置，不应该随意新增层级或改变层级含义。这样底层可以统一处理遮罩、点击穿透、返回键、弹窗栈、引导阻塞和提示层排序。

框架底层管理职责：

```text
HUIFacade
  -> 创建 root
  -> 创建 layer1/layer2/layer3/layer4/layer5/guide/tip/transition
  -> 维护 layerOrder
  -> 根据 UI 配置把节点挂到指定 layer
  -> 统一执行 bind/open/enable/refresh/disable/close/remove
  -> 统一处理缓存、销毁、返回键、遮罩、互斥组
```

### 10.1 同层排序策略

层级只决定大范围顺序，同一个层内还需要稳定排序。

推荐排序依据：

```text
layer
  -> order
  -> priority
  -> openIndex
```

规则：

- `order` 是最高优先级，适合系统强控制。
- `priority` 是业务可配置优先级，适合同层弹窗排序。
- `openIndex` 是框架自增打开顺序，保证后打开的 UI 在同优先级下更靠上。
- 有遮罩的 UI，遮罩节点必须排在当前 UI 节点正下方。
- 业务不直接调用 `setSiblingIndex`，同层排序由 `HUIFacade` 统一处理。

推荐配置：

```ts
[UIRoute.RewardDialog]: {
    id: UIRoute.RewardDialog,
    layer: UILayer.Layer4,
    priority: 20,
}

[UIRoute.SystemNoticeDialog]: {
    id: UIRoute.SystemNoticeDialog,
    layer: UILayer.Layer5,
    priority: 50,
}
```

## 11. 页面栈与弹窗栈

页面栈：

```text
HomePage -> ShopPage -> BagPage
```

弹窗栈：

```text
ConfirmDialog -> RewardDialog -> SettingDialog
```

职责：

- 处理返回键。
- 处理弹窗恢复。
- 处理互斥页面。
- 处理关闭当前最上层 UI。

返回键建议顺序：

```text
1. guide 引导层
2. layer5 系统弹窗层
3. 普通 dialog 弹窗层
4. page 页面层
5. 游戏主逻辑
```

框架实现规则：

- `H.ui.goBack()` 不由业务自己遍历节点。
- 每个候选 UI 先调用 `view.onBack()`。
- 如果 `onBack()` 返回 `true`，表示业务已经消费返回键。
- 如果未消费，并且 `closeOnBack !== false`，框架自动 `H.ui.close(id, false, 'back')`。
- 同优先级下，后打开的 UI 优先处理。

## 12. 事件与资源清理

企业 UI 框架必须统一处理事件注销。

推荐基类提供：

```ts
protected listenEventApi(register: () => HEventId, options?: HUIEventListenOptions): HEventId;
protected listenEvent<TName extends HEventNameLike>(eventName: TName, listener: (payload: HEventPayload<TName>) => void, options?: HUIEventListenOptions): HEventId;
protected emitEvent<TName extends HEventNameLike>(eventName: TName, payload?: HEventPayload<TName>): void;
protected clearEvent(eventId: HEventId): void;
protected listenNode(target: Node, eventName: string, listener: Function, thisArg?: any, options?: HUIEventListenOptions): () => void;
protected setTimer(callback: () => void, intervalMs: number, options?: HUITimerOptions): number;
protected setOnceTimer(callback: () => void, delayMs: number, options?: HUITimerOptions): number;
protected clearTimer(timerId: number): void;
protected clearAllTimers(scope?: 'disable' | 'remove'): void;
```

生命周期约定：

- `onBind`：注册长期节点引用，不启动临时逻辑。
- `onEnableView`：注册临时事件、启动倒计时、订阅临时事件。
- `onDisableView`：业务只写必要的关闭逻辑，框架随后自动注销 `clearOn: 'disable'` 的事件和定时器。
- `onRemove`：释放引用、清理异步回调，框架兜底清理所有剩余事件和定时器。

事件生命周期：

```text
H.event.on / ProjectEvent.onXXX
  -> 创建唯一 eventId
  -> 写入 HEventBus 订阅表
  -> UI 基类记录 eventId 与生命周期清理关系
H.event.emit / ProjectEvent.emitXXX
  -> 按事件名找到订阅列表
  -> 逐个回调，单个回调异常不会中断其他回调
H.event.off(eventId) / this.clearEvent(eventId)
  -> 从事件表和 id 索引中删除
UI disable/remove/destroy
  -> HUIViewBase 自动 off(eventId)
  -> 防止隐藏 UI 继续收到事件造成内存泄漏
```

不要在 `onRefresh` 里重复注册按钮事件。

推荐写法：

```ts
// 项目层事件门面，业务 UI 只使用函数 API。
export enum ProjectEventName {
    BattleCoinChanged = 'battle:coin_changed',
    SystemLanguageChanged = 'system:language_changed',
}

export class ProjectEvent {
    public static onBattleCoinChanged(listener: (coin: number) => void): HEventId {
        return H.event.on(ProjectEventName.BattleCoinChanged, listener);
    }

    public static emitBattleCoinChanged(coin: number): void {
        H.event.emit(ProjectEventName.BattleCoinChanged, coin);
    }

    public static onSystemLanguageChanged(listener: (language: string) => void): HEventId {
        return H.event.on(ProjectEventName.SystemLanguageChanged, listener);
    }
}

export class BattlePage extends HPageView {
    protected onEnableView(): void {
        this.listenEventApi(() => ProjectEvent.onBattleCoinChanged(this.onCoinChanged));
        this.listenNode(this.closeButton, Node.EventType.TOUCH_END, this.onClickClose);
        this.setTimer(() => this.refreshCountdown(), 1000);
    }

    protected onBind(): void {
        this.listenEventApi(() => ProjectEvent.onSystemLanguageChanged(this.onLanguageChanged), { clearOn: 'remove' });
    }

    private onCoinChanged = (coin: number): void => {
        this.refreshCoin();
    };
}
```

跨 UI 触发：

```ts
ProjectEvent.emitBattleCoinChanged(100);
```

框架内置事件也提供函数 API：

```ts
H.event.emitUIRequestClose(UIRoute.ShopPage, 'switch-page');

const eventId = H.event.onUIRequestClose((id, reason) => {
    console.log(id, reason);
});

H.event.off(eventId);
```

规则：

- `clearOn: 'disable'` 是默认值，适合 UI 打开期间有效的事件、按钮监听和倒计时。
- `clearOn: 'remove'` 适合缓存 UI 隐藏后仍然需要保留的长期监听。
- `H.event.on/onXXX` 会返回唯一 `eventId`，手动注销统一使用 `H.event.off(eventId)`。
- `HUIViewBase.listenEvent/listenEventApi` 也返回 `eventId`，同时会把事件绑定到 UI 生命周期，关闭和销毁时自动释放。
- 业务层优先使用函数 API：框架事件用 `H.event.emitUIRequestClose(...)`，项目事件用 `ProjectEvent.emitBattleCoinChanged(...)`。
- 枚举事件名只放在事件门面内部，不在业务 UI 里到处传字符串或裸 payload。
- 业务不要直接散写 `H.event.on/off`、`node.on/off`、`setInterval/clearInterval`，否则容易在 UI 关闭后继续回调。
- 定时器回调异常由基类捕获并打印，不会打断其他 UI 的事件调度。

## 13. 数据刷新策略

`refresh` 只负责根据参数或数据模型刷新显示，不负责打开 UI。

推荐方式：

```ts
await H.ui.openPage(UIRoute.ShopPage, { tab: 'skin' });
await H.ui.refresh(UIRoute.ShopPage, { tab: 'item' });
```

业务 UI：

```ts
export class ShopPage extends HPageView<ShopParams> {
    protected onBind(): void {
        this.bindButtons();
    }

    protected onOpen(params: ShopParams): void {
        this.selectTab(params.tab);
    }

    protected onRefresh(params: ShopParams): void {
        this.selectTab(params.tab);
        this.refreshGoodsList();
    }
}
```

### 13.1 Store + Dirty Refresh 数据驱动刷新

公司级 UI 框架不应该让每个 UI 自己到处读取数据、手动判断是否刷新。

框架新增 `H.store` 作为运行时数据门面，和 `H.data` 的关系如下：

```text
H.store
  -> 负责运行时模型、脏字段合并、UI 通知

H.data
  -> 负责本地存储、延迟落盘、切后台保存
```

推荐数据流：

```text
H.store.setValue('user', 'coin', 100)
  -> 标记 user.coin 为脏
  -> 下一轮 flushDirty 合并通知
  -> 已打开并声明 modelWatches/watchModel 的 UI 收到 onRefreshDirty
  -> UI 只刷新金币显示
```

路由配置声明依赖：

```ts
[UIRoute.HomePage]: {
    id: UIRoute.HomePage,
    type: 'page',
    layer: UILayer.Layer2,
    prefabPath: 'ui/HomePage',
    modelWatches: [
        { module: 'user', paths: ['coin', 'level'] },
        { module: 'task', paths: ['daily'] },
    ],
}
```

UI 类声明依赖：

```ts
export class HomePage extends HPageView {
    protected getModelWatches() {
        return [
            { module: 'user', paths: ['coin', 'level'] },
        ];
    }
}
```

项目模型示例：

```ts
interface UserState {
    coin: number;
    level: number;
    nickName: string;
}

H.store.register<UserState>('user', {
    coin: 0,
    level: 1,
    nickName: '游客',
});

H.store.setValue('user', 'coin', 100);
H.store.patch<UserState>('user', { level: 2 });
```

业务 UI 示例：

```ts
export class HomePage extends HPageView {
    protected onRefresh(): void {
        this.refreshCoin();
        this.refreshLevel();
    }

    protected onStoreChange(change): void {
        if (change.has('coin')) {
            this.refreshCoin();
        }

        if (change.has('level')) {
            this.refreshLevel();
        }
    }

    private refreshCoin(): void {
        this.coinLabel.string = String(this.getModelValue('user', 'coin', 0));
    }

    private refreshLevel(): void {
        this.levelLabel.string = String(this.getModelValue('user', 'level', 1));
    }
}
```

生命周期关系：

```text
bind
open
  -> connect declared modelWatches
  -> enable
  -> refresh 全量刷新
store dirty
  -> onRefreshDirty
  -> onStoreChange 局部刷新
close/remove/destroy
  -> 自动取消 modelWatches/watchModel
```

规则：

- 项目数据模型，例如 `UserModel`、`BagModel`、`TaskModel`，属于项目层，不写进 UI 框架核心。
- 框架只提供 `H.store`、`HModel`、`HStoreModule`、`watchModel`、`onRefreshDirty` 这些通用能力。
- 优先使用 `modelWatches` 或 `getModelWatches()` 声明数据依赖，让框架在 UI 打开/关闭时自动订阅和断开。
- 声明式 `modelWatches` 只在 UI 打开期间订阅；UI 重新打开时默认用 immediate 当前数据补一次脏刷新。
- UI 销毁时基类会自动取消数据订阅，避免隐藏 UI 继续刷新。
- 发奖励、背包变化、任务状态变化等都应该先写 Store，再由 UI 被动刷新。

## 14. 弹窗设计流程

打开弹窗：

```text
H.ui.openDialog(UIRoute.ConfirmDialog, params)
  -> 创建遮罩
  -> 创建弹窗
  -> bind
  -> open animation
  -> enable
  -> refresh
  -> push dialog stack
```

关闭弹窗：

```text
click close / mask / back
  -> disable
  -> close animation
  -> remove or cache
  -> pop dialog stack
  -> restore previous dialog if needed
```

遮罩由框架创建，不由弹窗预制体自己创建。

推荐流程：

```text
H.ui.openDialog(UIRoute.ConfirmDialog)
  -> HUIFacade 创建 mask 节点
  -> mask 挂到同一个 layer
  -> mask 排在 dialog 节点下方
  -> mask 根据 closeOnMask 决定是否点击关闭
  -> dialog close/remove 时同步隐藏或销毁 mask
```

推荐配置：

```ts
[UIRoute.ConfirmDialog]: {
    id: UIRoute.ConfirmDialog,
    type: 'dialog',
    layer: UILayer.Layer3,
    showMask: true,
    closeOnMask: true,
    maskOpacity: 140,
}
```

规则：

- `blockInput` 只负责阻塞点击。
- `showMask` 负责是否创建可见遮罩。
- `closeOnMask` 负责点击遮罩是否关闭当前 UI。
- 遮罩排序由框架处理，业务不手动调整层级。

业务弹窗示例：

```ts
interface ConfirmParams {
    title: string;
    content: string;
    onConfirm?: () => void;
}

export class ConfirmDialog extends HDialogView<ConfirmParams> {
    protected onBind(): void {
        this.confirmButton.node.on(Button.EventType.CLICK, this.onClickConfirm, this);
        this.closeButton.node.on(Button.EventType.CLICK, this.onClickClose, this);
    }

    protected onRefresh(params: ConfirmParams): void {
        this.titleLabel.string = params.title;
        this.contentLabel.string = params.content;
    }

    private onClickConfirm(): void {
        this.params.onConfirm?.();
        this.manager.remove(this.uiId);
    }

    private onClickClose(): void {
        this.manager.close(this.uiId);
    }
}
```

## 15. Tip 设计流程

Tip 不应该进入弹窗栈，也不应该阻塞交互。

```text
H.ui.showTip(message)
  -> open tip
  -> play in animation
  -> wait autoRemoveMs
  -> play out animation
  -> remove
```

示例：

```ts
H.ui.showTip('金币不足');
```

或者：

```ts
H.ui.showTip(UIRoute.ToastTip, {
    message: '保存成功',
    durationMs: 1500,
});
```

## 16. Loading 设计流程

Loading 是特殊 UI，通常需要：

- 阻塞输入。
- 显示进度。
- 控制最短展示时间。
- 接入资源加载。
- 接入 SDK 初始化。
- 接入登录。
- 接入远程配置。

推荐生命周期：

```text
bind
  -> open
  -> refresh progress
  -> sdk init
  -> sdk login
  -> load resource
  -> preload home
  -> close
  -> enter scene
```

Loading UI 不应该写项目奖励逻辑，只处理启动流程。

### 16.1 UI 打开 Loading 策略

UI 打开 Loading 和开局 Loading 不是同一个概念。

开局 Loading 负责登录、SDK 初始化、配置加载和主资源预加载。UI 打开 Loading 负责解决某个 UI 因为 bundle、prefab、远程资源或设备卡顿导致打开慢时，用户不知道是不是卡住的问题。

推荐由框架底层统一处理：

```text
H.ui.open(UIRoute.ShopPage)
  -> 开始加载 UI prefab/bundle
  -> 300ms 内打开完成：不显示 loading
  -> 超过 300ms 未完成：自动显示 loading
  -> UI 打开成功：满足最短展示时间后关闭 loading
  -> UI 打开失败：关闭 loading，并把错误继续抛给调用方
```

推荐类型：

```ts
export interface UIOpenLoadingPolicy {
    enabled?: boolean;
    loadingId?: UIRoute | string;
    delayMs?: number;
    minShowMs?: number;
    message?: string;
    params?: any;
}
```

全局配置：

```ts
H.init({
    uiRoot,
    ui: {
        openLoading: {
            enabled: true,
            loadingId: UIRoute.GlobalLoading,
            delayMs: 300,
            minShowMs: 300,
            message: '加载中',
        },
    },
});
```

单个路由覆盖：

```ts
[UIRoute.ShopPage]: {
    id: UIRoute.ShopPage,
    type: 'page',
    layer: UILayer.Layer2,
    prefabPath: 'ui/page/ShopPage',
    openLoading: {
        enabled: true,
        delayMs: 200,
        minShowMs: 400,
        message: '正在打开商城',
    },
}
```

单次打开覆盖：

```ts
await H.ui.openPage(UIRoute.ShopPage, { tab: 'skin' }, {
    openLoading: {
        enabled: true,
        message: '正在打开商城',
    },
});

await H.ui.openDialog(UIRoute.ConfirmDialog, params, {
    openLoading: false,
});
```

框架底层必须处理：

- 延迟显示，避免快速 UI 打开时 loading 闪烁。
- 最短展示，避免 loading 刚出现就消失。
- 失败关闭，UI 加载失败也必须关闭 loading。
- 重复打开保护，同一个单例 UI 正在加载时复用同一个打开任务。
- 并发引用计数，多个慢 UI 同时打开时，最后一个完成后再关闭 loading。
- `loading` 类型本身不能再次触发 UI 打开 Loading，避免递归打开。

## 17. 动画设计

动画归框架管理，业务 UI 不应该到处写重复 tween。

动画实现放在 `HUIViewBase` 内部，`HUIFacade` 只负责调度生命周期。

```text
HUIFacade.open
  -> view._hOpen
  -> view.onOpen
  -> view.playOpenAnimation
  -> view.onEnableView
  -> view.onRefresh

HUIFacade.close
  -> view._hClose
  -> view.onDisableView
  -> view.onClose
  -> view.playCloseAnimation
  -> HUIFacade 根据 cacheMode 隐藏或销毁
```

推荐配置：

```ts
animation: {
    open: 'fade-scale',
    close: 'fade',
    duration: 0.18,
}
```

框架调用：

```text
open -> playOpenAnimation -> enable
close -> disable -> playCloseAnimation
```

关闭节点约定：

```text
每个 UI 预制体如果需要点击关闭：
  在预制体任意层级放一个节点，节点名固定为 bgclose
  HUIViewBase.bind 时自动递归查找 bgclose
  bgclose touch_end -> this.close('bgclose')
  this.close() -> H.ui.close(this.uiId)
  await this.close() 会等待关闭动画结束
```

业务 UI 不需要每个弹窗都重复写关闭按钮监听。

如果某个 UI 不希望自动绑定 `bgclose`，在路由配置里关闭：

```ts
{
    id: UIRoute.SomePage,
    closeOnBgClose: false,
}
```

关闭点击策略：

```ts
{
    id: UIRoute.ConfirmDialog,
    closeOnBgClose: true,
    closeStopPropagation: true,
    closeThrottleMs: 300,
    closeSound: 'ui_close',
}
```

规则：

- `closeThrottleMs` 防止短时间重复点击关闭按钮。
- `closeStopPropagation` 防止关闭点击向下穿透。
- `closeSound` 只声明声音 key，实际播放由 `H.ui.init({ closeSoundPlayer })` 注入。
- 关闭前二次确认不写在 `bgclose` 里，业务 UI 重写 `onBeforeClose(reason)`。

示例：

```ts
protected async onBeforeClose(reason: HUICloseReason): Promise<boolean> {
    if (reason !== 'bgclose') {
        return true;
    }

    return await this.confirmLeave();
}
```

动画期间：

- 禁止重复点击。
- 禁止重复打开/关闭。
- 弹窗遮罩可提前显示。
- 关闭动画完成后再执行隐藏或销毁。

## 18. 缓存策略

缓存策略：

```ts
export type HUICacheMode = 'destroy' | 'hide' | 'keep';
```

区别：

| 模式 | 行为 | 适合 |
| --- | --- | --- |
| destroy | 关闭后销毁节点 | 低频弹窗、奖励弹窗 |
| hide | 关闭后隐藏节点 | 中频弹窗 |
| keep | 常驻缓存 | 主页面、高频页面 |

生命周期关系：

```text
destroy:
  close -> remove -> destroy

hide:
  close -> node.active = false

keep:
  close -> node.active = false, record 保留
```

### 18.1 资源释放策略

`cacheMode` 只决定 UI 节点关闭后的行为，还需要资源策略来控制 prefab、bundle 和隐藏缓存。

推荐配置：

```ts
H.init({
    uiRoot,
    ui: {
        resource: {
            maxHiddenRecords: 8,
            releasePrefabOnDestroy: true,
            releaseBundleOnUnused: false,
            lowMemoryStrategy: 'destroy-hidden',
        },
    },
});
```

规则：

- prefab 加载后由框架增加引用，record 销毁时释放引用。
- bundle 记录引用计数，所有引用释放后才允许释放 bundle。
- `maxHiddenRecords` 控制隐藏缓存上限，超过后按 `lastUsedAt` 淘汰最老缓存。
- 低内存时按 `lowMemoryStrategy` 清理隐藏缓存。
- 业务不直接 `destroy()` UI 节点，不直接释放 UI prefab。

推荐对外能力：

```ts
await H.ui.clearHiddenCache();
await H.ui.clearHiddenCache(true);
await H.ui.trimHiddenCache(5);
```

## 19. 异步安全

UI 关闭后，异步回调不应该继续刷新已销毁节点。

框架底层还必须处理快速连续操作：

```text
open(A)
close(A)
open(A)
```

推荐规则：

- 每个 UI id 有自己的操作队列。
- 同一个 UI 的 `open/refresh/close/remove` 串行执行。
- 不同 UI 可以并行加载和打开。
- 每个 record 维护 `operationVersion` 和 `lastUsedAt`。
- 打开失败时释放已经加载的 prefab 和半创建节点。
- 关闭过程中再次关闭会被忽略或排队，不会重复播放关闭动画。

推荐基类提供版本号：

```ts
private lifeVersion = 0;

protected nextLifeVersion(): number {
    this.lifeVersion += 1;
    return this.lifeVersion;
}

protected isAlive(version: number): boolean {
    return this.lifeVersion === version && this.uiStatus !== 'removed' && this.uiStatus !== 'destroyed';
}
```

使用：

```ts
protected async onRefresh(): Promise<void> {
    const version = this.nextLifeVersion();
    const data = await this.loadData();

    if (!this.isAlive(version)) {
        return;
    }

    this.render(data);
}
```

## 20. 完全重构原则

这套 UI 框架不兼容旧 UI 生命周期。

旧方法不再作为框架入口：

```text
bindUIContext
openUI
hideUI
closeUI
onUILoad
onUIOpen
onUIShow
onUIHide
onUIClose
onUIRefresh
```

新的唯一生命周期：

```text
bind
open
enable
refresh
disable
close
remove
```

代码落点：

```text
assets/scripts/H/ui/HUITypes.ts
assets/scripts/H/ui/HUIConfig.ts
assets/scripts/H/ui/HUIViewBase.ts
assets/scripts/H/ui/HPageView.ts
assets/scripts/H/ui/HDialogView.ts
assets/scripts/H/ui/HTipView.ts
assets/scripts/H/ui/HGuideView.ts
assets/scripts/H/ui/HLoadingView.ts
assets/scripts/H/ui/HUIStack.ts
assets/scripts/H/ui/HUIFacade.ts
```

`HBaseUI` 只作为新 `HUIViewBase` 的别名入口存在，不再承载旧生命周期兼容逻辑。

## 21. 推荐业务写法

页面：

```ts
interface BagPageParams {
    defaultTab?: string;
}

export class BagPage extends HPageView<BagPageParams> {
    protected onBind(): void {
        this.bindButtons();
    }

    protected onOpen(params: BagPageParams): void {
        this.selectTab(params.defaultTab || 'all');
    }

    protected onRefresh(params: BagPageParams): void {
        this.selectTab(params.defaultTab || 'all');
        this.refreshItems();
    }

    protected onDisableView(): void {
        this.stopScrollInertia();
    }

    private onClickClose(): void {
        this.close();
    }
}
```

弹窗：

```ts
interface RewardDialogParams {
    title: string;
    rewards: Array<{ id: string; count: number }>;
}

export class RewardDialog extends HDialogView<RewardDialogParams> {
    protected onRefresh(params: RewardDialogParams): void {
        this.titleLabel.string = params.title;
        this.renderRewards(params.rewards);
    }
}
```

提示：

```ts
interface ToastParams {
    message: string;
    durationMs?: number;
}

export class ToastTip extends HTipView<ToastParams> {
    protected onRefresh(params: ToastParams): void {
        this.messageLabel.string = params.message;
        this.autoRemoveMs = params.durationMs || 1500;
    }
}
```

## 22. H.ui 对外 API 设计

推荐 API：

```ts
H.ui.registerRoutes(UIRouteConfigs);
H.ui.getConfig(id);

H.ui.open(id, params);
H.ui.openPage(id, params);
H.ui.openDialog(id, params);
H.ui.openGuide(id, params);
H.ui.showTip(message);
H.ui.showTip(id, params);

H.ui.refresh(id, params);
H.ui.close(id);
H.ui.remove(id);
H.ui.closeAllDialogs();
H.ui.closeLayer(layer);

H.ui.get(id);
H.ui.getScript(id);
H.ui.isOpen(id);
H.ui.getOpenIds(layer);

H.ui.goBack();
H.ui.clearHiddenCache();
H.ui.trimHiddenCache(maxCount);
H.ui.on('ui_open_start', listener);
H.ui.off('ui_open_start', listener);
```

行为约定：

- `id` 推荐使用 `UIRoute` 枚举，也兼容字符串。
- `registerRoutes` 只在框架初始化或项目启动阶段调用。
- `open` 优先读取路由配置，根据配置里的 `type` 自动进入对应流程。
- `open` 返回 `Promise<Node>`。
- `refresh` 不创建 UI，只刷新已存在 UI。
- `close` 返回 `Promise<void>`，关闭动画完成后 resolve。
- `remove` 强制移除并释放。
- `showTip` 默认不入栈。
- `openGuide` 默认挂到引导层，并可阻塞下层点击。
- `openDialog` 默认入弹窗栈。
- `openPage` 默认入页面栈。
- `goBack` 按 guide -> layer5 -> dialog -> page 的顺序统一处理。

全局 UI 事件：

```ts
export type HUIEventType =
    | 'ui_open_start'
    | 'ui_open_end'
    | 'ui_open_fail'
    | 'ui_close_start'
    | 'ui_close_end'
    | 'ui_close_cancel'
    | 'ui_cache_trim'
    | 'ui_resource_release';
```

推荐接入：

```ts
H.init({
    uiRoot,
    ui: {
        eventReporter: (event) => {
            H.analytics.track(event.name, {
                id: event.id,
                type: event.type,
                layer: event.layer,
                durationMs: event.durationMs,
                reason: event.reason,
            });
        },
    },
});
```

## 23. 底部 TabBar/TabRouter

底部 Tab 是主界面导航能力，属于 UI 框架底层，不应该每个项目重复写。

框架拆分：

```text
HUITabBar
  -> 管理 1/2/3/4/5 数字 tabId
  -> 继承 HPageView，纳入 HUIViewBase 生命周期
  -> 在 onBind 阶段绑定点击事件
  -> 直接给底部普通 tab 节点注册点击事件
  -> 刷新所有 tab 节点的选中状态
HUITabRouter
  -> 根据 tabId 找到 pageId
  -> 调用 H.ui.close / H.ui.open 完成页面切换
  -> 切换成功后派发 ui:tab_changed
```

项目侧推荐枚举：

```ts
export enum MainTabId {
    Home = 1,
    Task = 2,
    Shop = 3,
    Rank = 4,
    Setting = 5,
}
```

Tab 配置：

```ts
export const MainTabConfigs: HUITabConfig[] = [
    { id: MainTabId.Home, pageId: UIRoute.HomePage, title: '首页', default: true, order: 1 },
    { id: MainTabId.Task, pageId: UIRoute.TaskPage, title: '任务', order: 2 },
    { id: MainTabId.Shop, pageId: UIRoute.ShopPage, title: '商店', order: 3 },
    { id: MainTabId.Rank, pageId: UIRoute.RankPage, title: '排行', order: 4 },
    { id: MainTabId.Setting, pageId: UIRoute.SettingPage, title: '设置', order: 5 },
];
```

主界面接入：

```ts
export class MainPage extends HUITabBar {
    protected getTabConfigs(): HUITabConfig[] {
        return MainTabConfigs;
    }

    protected getTabOptions(): HUITabBarOptions {
        return {
            defaultTabId: MainTabId.Home,
            switchThrottleMs: 300,
            closePrevious: true,
            autoSwitch: true,
        };
    }
}
```

预制体节点结构推荐：

```text
MainPage  挂 MainPage 脚本，MainPage 继承 HUITabBar
  tabBarNode  拖到 HUITabBar.tabRoot
    tabHome
      normal
      selected
      label
      redDot
      disabled
    tabTask
      normal
      selected
      label
      redDot
      disabled
    tabShop
      normal
      selected
      label
```

只需要一个主界面脚本继承 `HUITabBar`。下面的 `tabHome/tabTask/tabShop` 都是普通节点，不需要单独挂脚本。

生命周期关系：

```text
H.ui.openPage(MainPage)
  -> MainPage._hBind
  -> HUITabBar.onBind
  -> 读取 getTabConfigs/getTabOptions
  -> 给 tabHome/tabTask/tabShop 绑定点击事件
  -> 缓存 normal/selected/label/redDot/disabled 节点引用
  -> MainPage._hOpen
  -> onEnableView
  -> autoSwitch 打开默认 tab 页面
close/remove
  -> HUIViewBase 统一清理 HUITabBar 绑定的 tab 节点事件
```

节点绑定规则：

- 默认按 `MainTabConfigs` 的排序绑定 `tabBarNode` 的直接子节点。
- 如果节点顺序不固定，可以在配置里写 `nodeName` 精确绑定。
- `normal` 节点表示未选中态，`selected` 节点表示选中态。
- 切换时 `HUITabBar` 自动控制 `normal/selected` 的显示隐藏。
- 节点查找只在 `onBind/init` 阶段执行一次，后续点击和刷新只使用缓存引用。

切换流程：

```text
点击 tabShop
  -> HUITabBar 拿到 tabId=3
  -> HUITabRouter 查找 pageId=ShopPage
  -> 关闭上一个 page
  -> 打开 ShopPage
  -> HUITabBar.setSelected(3)
  -> tabShop 显示 selected 节点，其他 tab 显示 normal 节点
  -> H.event.emitUITabChanged(3, previousId, pageId, reason)
```

规则：

- `tabId` 使用数字，推荐从 1 开始，和主界面底部顺序一致。
- `pageId` 仍然使用 UI 路由枚举，不直接写 prefab 路径。
- 主界面继承 `HUITabBar` 后，如果重写 `onBind`，必须先 `await super.onBind(context)`。
- 选中态只能由 `HUITabBar` 统一刷新，业务页面不要自己操作底部图标。
- Tab 页面切换必须走 `HUITabRouter`，这样页面生命周期仍然归 `HUIViewBase/HUIFacade` 管理。
- Tab 节点支持 `normal/selected`、文字颜色、红点、禁用态。

## 24. 实施步骤

推荐分阶段改造：

```text
第一阶段：
  新增 HUIViewBase / HPageView / HDialogView / HTipView / HGuideView / HLoadingView
  HBaseUI 只作为 HUIViewBase 别名，不保留旧生命周期

第二阶段：
  HUIFacade 调用新生命周期
  open / refresh / close / remove 全部异步化

第三阶段：
  接入事件自动清理、异步版本号、统一动画

第四阶段：
  迁移业务 UI 到新基类
  旧 onUIOpen/onUIRefresh 不再作为框架入口

第五阶段：
  完善弹窗栈、返回键、遮罩、互斥组、缓存策略
```

## 25. 最终效果

业务打开 UI：

```ts
await H.ui.openPage(UIRoute.ShopPage, { tab: 'skin' });
await H.ui.openDialog(UIRoute.ConfirmDialog, { title: '提示', content: '是否继续？' });
H.ui.showTip('保存成功');
```

业务 UI 内部：

```ts
protected onBind(): void {}
protected onOpen(params): void {}
protected onEnableView(): void {}
protected onRefresh(params): void {}
protected onDisableView(): void {}
protected onBeforeClose(reason): boolean | Promise<boolean> {}
protected onClose(reason): void {}
protected onRemove(): void {}
```

业务不再关心：

```text
prefab 如何加载
节点挂在哪一层
是否重复打开
是否入栈
是否缓存
关闭后是否 destroy
Cocos onLoad/start/onEnable 顺序
弹窗遮罩和返回键
动画播放时机
事件清理
```

这就是企业级 UI 框架应该提供的核心价值。

## 26. 数据驱动 UI / MVVM 绑定层

数据驱动 UI 的核心不是把 UI 生命周期写得更复杂，而是让 UI 不再主动到处拉数据。
框架底层应该统一监听数据变化，再把变化推送到当前打开的 UI。

推荐职责拆分：

```text
H.store
  -> 保存模块数据
  -> 合并脏字段
  -> 派发模块变化

HUIBindingWatcher
  -> UI 打开时订阅 H.store
  -> Store 字段变化时刷新命中的绑定
  -> UI 关闭/移除时统一取消监听

HUIBindingAdapter
  -> 把字段值写入 Label / RichText / Node.active / ProgressBar / Toggle / EditBox 等组件

HUIViewBase
  -> 统一收集路由绑定、代码绑定、预制体组件绑定
  -> 在 bind/open/close/remove/destroy 生命周期里管理绑定
```

落点目录：

```text
assets/scripts/H/ui/binding/
  HUIBindingTypes.ts       // 数据绑定类型定义
  HUIBindingPath.ts        // Store 点路径和节点路径工具
  HUIBindingAdapter.ts     // 组件写入适配器
  HUIBindingWatcher.ts     // Store 监听和刷新调度
  HUIBindingComponent.ts   // 可挂在预制体上的声明式绑定组件
  index.ts
```

生命周期关系：

```text
H.ui.open(Page)
  -> HUIViewBase._hBind
  -> onBind
  -> setupDataBindings
     -> 收集 config.dataBindings
     -> 收集 getDataBindings()
     -> 收集 addDataBinding()
     -> 收集预制体里的 HUIBindingComponent
  -> HUIViewBase._hOpen
  -> startDataBindings
     -> H.store.watch(module, paths)
     -> immediate 刷新一次
  -> Store 变化
     -> HUIBindingWatcher.refreshByChange
     -> HUIBindingAdapter.apply
  -> close/remove/destroy
     -> stopDataBindings
     -> 取消 Store 监听和 UI 回写事件
```

### 26.1 路由配置里声明绑定

适合简单、固定的 UI 字段绑定。

```ts
{
    id: UIRoute.HomePage,
    type: 'page',
    layer: UILayer.Layer2,
    prefabPath: 'ui/page/HomePage',
    dataBindings: [
        {
            module: 'user',
            path: 'coin',
            nodeName: 'coinLabel',
            target: 'label',
            template: '金币：{value}',
            defaultValue: 0,
        },
        {
            module: 'task',
            path: 'hasReward',
            nodeName: 'taskRedDot',
            target: 'active',
            defaultValue: false,
        },
    ],
}
```

### 26.2 UI 脚本里声明绑定

适合需要 formatter、节点引用或自定义写入的界面。

```ts
export class HomePage extends HPageView {
    protected getDataBindings(): HUIBindingConfig[] {
        return [
            {
                module: 'user',
                path: 'coin',
                nodeName: 'coinLabel',
                target: 'label',
                formatter: (value) => `金币：${value || 0}`,
            },
            {
                module: 'user',
                path: 'levelExpRate',
                nodeName: 'expProgress',
                target: 'progress',
                defaultValue: 0,
            },
        ];
    }
}
```

业务改数据时只写 Store：

```ts
H.store.setValue('user', 'coin', 100, { immediate: true });
```

框架会自动刷新所有打开并绑定了 `user.coin` 的 UI。

### 26.3 预制体节点挂绑定组件

适合策划或 UI 预制体层快速配置。

```text
HomePage
  top
    coinLabel  挂 HUIBindingComponent
      moduleName = user
      path = coin
      target = label
      template = 金币：{value}
```

注意：
- `HUIBindingComponent` 只声明绑定，不自己监听 Store。
- 监听、刷新、注销全部由 `HUIViewBase` 统一管理。
- 这样不会出现节点已经销毁但组件还在监听 Store 的泄漏问题。

### 26.4 双向绑定

双向绑定只建议用于明确输入控件，例如 `Toggle` 和 `EditBox`。

```ts
{
    module: 'setting',
    path: 'soundEnabled',
    nodeName: 'soundToggle',
    target: 'toggle',
    mode: 'two-way',
    defaultValue: true,
}
```

流程：

```text
Store -> Toggle.isChecked
玩家点击 Toggle
  -> HUIBindingWatcher 读取 Toggle.isChecked
  -> H.store.setValue('setting', 'soundEnabled', value)
  -> H.store 派发变化
  -> 其他绑定 setting.soundEnabled 的 UI 同步刷新
```

### 26.5 与 onRefreshDirty 的关系

`dataBindings` 解决的是字段到控件的常规显示。
`onRefreshDirty(changes)` 仍然保留，适合复杂列表、动画刷新、需要比较 previous/current 的场景。

推荐规则：
- 金币、昵称、红点、进度条、开关状态：优先用 `dataBindings`。
- 背包列表、任务列表、排行榜、多状态复杂卡片：用 `onRefreshDirty` 或项目自己的列表渲染器。
- UI 不应该在 `onRefresh` 里反复 `getModelValue` 拉一堆字段后手动赋值，除非这个界面确实是一次性复杂渲染。

### 26.6 企业框架约束

绑定层必须遵守这些规则：
- UI 打开时才监听 Store，关闭时停止监听。
- 绑定刷新只处理命中的 module/path，不全量刷新整个界面。
- 节点查找只在绑定初始化或节点丢失时进行，不在每次 Store 变化时反复查找。
- Store 是唯一数据源，UI 不直接保存业务状态副本。
- 双向绑定只用于输入控件，避免业务流程被 UI 状态反向污染。
- 复杂业务逻辑不写在 `formatter` 里，`formatter` 只做轻量显示格式化。

## 27. 第三方 VM 仓库 Vendor 与 H.vm 适配

已经把 `cocos_creator_mvvm_tools` 整包放到项目根目录：

```text
third_party/cocos_creator_mvvm_tools/
  LICENSE
  README.md
  docs/
  assets/Script/modelView/
    JsonOb.ts
    ViewModel.ts
    VMBase.ts
    VMLabel.ts
    VMProgress.ts
    VMCustom.ts
    VMParent.ts
```

这个仓库的原始代码是 Cocos Creator 2.x 风格，里面大量使用 `cc.Component`、`cc.director.emit`、`cc._decorator`。
当前项目是 Cocos Creator 3.8.6，如果直接把原始脚本放进 `assets/scripts` 编译区，很容易出现 API 不兼容。

所以框架处理方式是：

```text
third_party/cocos_creator_mvvm_tools
  -> 保存第三方原始仓库
  -> 作为协议、设计和迁移参考

assets/scripts/H/vm
  -> 提供 H.vm 门面
  -> 模仿 VM.add / VM.getValue / VM.setValue / VM.bindPath 使用体验
  -> 底层复用 H.store
  -> 与 H.ui 数据绑定生命周期统一
```

`H.vm` 推荐用法：

```ts
export enum ProjectVMTag {
    User = 'user',
    Bag = 'bag',
    Task = 'task',
}

export enum UserVMPath {
    Coin = 'coin',
    NickName = 'profile.nickName',
}

H.vm.add({
    coin: 0,
    profile: {
        nickName: '游客',
    },
}, ProjectVMTag.User);

H.vm.write(ProjectVMTag.User, UserVMPath.Coin, 100, { immediate: true });
H.vm.addNumber(ProjectVMTag.User, UserVMPath.Coin, 10);

const watchId = H.vm.watch(ProjectVMTag.User, UserVMPath.Coin, (value, oldValue) => {
    console.log(value, oldValue);
});

H.vm.unwatch(watchId);
```

和第三方 VM 的对应关系：

| 第三方 VM | H 框架适配 |
| --- | --- |
| `VM.add(data, tag)` | `H.vm.add(data, tag)` |
| `VM.get(tag)` | `H.vm.get(tag)` |
| `VM.getValue('user.coin')` | `H.vm.getValue('user.coin')` |
| `VM.setValue('user.coin', 100)` | `H.vm.setValue('user.coin', 100)` |
| `VM.addValue('user.coin', 10)` | `H.vm.addValue('user.coin', 10)` |
| `VM.bindPath(path, cb, target)` | `H.vm.bindPath(path, cb, target)` |
| `VM.unbindPath(path, cb, target)` | `H.vm.unbindPath(path, cb, target)` |

项目推荐写法：

| 需求 | 推荐 API |
| --- | --- |
| 注册模型 | `H.vm.add(data, ProjectVMTag.User)` |
| 安全读取，会深拷贝 | `H.vm.getValue('user.coin')` |
| 轻量读取，不深拷贝 | `H.vm.read(ProjectVMTag.User, UserVMPath.Coin)` |
| 写入字段 | `H.vm.write(ProjectVMTag.User, UserVMPath.Coin, 100)` |
| 增加数值 | `H.vm.addNumber(ProjectVMTag.User, UserVMPath.Coin, 10)` |
| 监听字段 | `H.vm.watch(ProjectVMTag.User, UserVMPath.Coin, cb)` |
| 取消监听 | `H.vm.unwatch(watchId)` |

### 27.1 VM 生命周期

`H.vm` 当前生命周期：

```text
created
  -> active
  -> inactive
  -> active
  -> removed
```

API：

```ts
H.vm.add(data, ProjectVMTag.User, { active: false }); // created
H.vm.active(ProjectVMTag.User);                       // 恢复 watcher 派发
H.vm.inactive(ProjectVMTag.User);                     // 暂停 watcher 派发，数据仍可读写
H.vm.remove(ProjectVMTag.User);                       // 清理该 VM 下的 watcher

const status = H.vm.getStatus(ProjectVMTag.User);
const info = H.vm.getLifecycle(ProjectVMTag.User);
```

生命周期约束：
- `inactive` 不会阻止 `read/write`，只暂停 watcher 派发。
- `remove` 会清理该 tag 下所有 `watch/watchPath/bindPath` 监听。
- `remove` 不直接清空本地存档；存档由 `H.store/H.data` 负责。

### 27.2 VM 性能策略

`H.vm` 不使用第三方原始 VM 的 `Object.defineProperty` 深度劫持，也不使用 `cc.director.emit` 做字符串事件广播。

当前性能策略：

```text
H.vm.watch(ProjectVMTag.User, UserVMPath.Coin)
  -> 按 tag 建立一个 H.store.watch('user', '*')
  -> 多个 user.* 监听复用同一个 Store watcher
  -> Store flush 时按脏 path 派发给命中的 VM watcher
```

优势：
- watcher 数量从“每个 path 一个 Store watcher”降低为“每个 tag 一个 Store watcher”。
- `H.vm.read / H.store.readValue` 不做 JSON 深拷贝，适合高频只读字段。
- `H.vm.getValue / H.store.getValue` 仍保留深拷贝版本，适合安全读取对象数据。

约束：
- `read/readValue` 如果读到对象或数组，必须当作只读引用使用。
- 战斗坐标、怪物状态、子弹数据、每帧血条不建议走 VM。
- VM 适合金币、昵称、红点、任务状态、设置开关、背包摘要这类 UI 数据。

注意：
- 第三方原始代码保留在 `third_party`，不直接进入 Cocos 编译。
- 项目业务统一使用 `H.vm`，不要同时混用第三方 `VM` 和 `H.store` 两套数据源。
- `H.vm` 的监听返回唯一 id，建议优先用 id 取消监听。
- UI 层优先用 `dataBindings` 或 `HUIBindingComponent`，不要在每个界面手写大量 `bindPath`。

## 28. VM 预制体绑定组件

除了 `dataBindings`，框架也提供可挂在预制体节点上的 VM 组件。
这些组件适合策划或 UI 同学直接配置，也适合项目封装成带枚举的业务组件。

落点目录：

```text
assets/scripts/H/vm/components/
  HVMBase.ts
  HVMLabel.ts
  HVMState.ts
  HVMProgress.ts
  HVMList.ts
  HVMListItem.ts
```

生命周期：

```text
onEnable
  -> H.vm.watch(tag, path, cb, { immediate: true })
  -> 立即刷新一次 UI

VM 数据变化
  -> H.vm 按 tag 分组 watcher 派发
  -> 组件 refreshValue

onDisable/onDestroy
  -> H.vm.unwatch(watchId)
```

### 28.1 HVMLabel

用途：把 VM 字段显示到 `Label.string`。

```text
coinLabel 节点挂 HVMLabel
  tag = user
  path = coin
  template = 金币：{value}
  defaultText = 0
```

对应数据变化：

```ts
H.vm.write(ProjectVMTag.User, UserVMPath.Coin, 100);
```

`coinLabel` 会自动显示：

```text
金币：100
```

### 28.2 HVMState

用途：根据 VM 字段控制节点显示隐藏。

```text
taskRedDot 节点挂 HVMState
  tag = task
  path = hasReward
  condition = Truthy
  activeWhenTrue = true
```

条件支持：

```text
Truthy
Falsy
Equal
NotEqual
Greater
GreaterEqual
Less
LessEqual
In
NotIn
Empty
NotEmpty
```

示例：

```text
unlockMask 节点挂 HVMState
  tag = user
  path = level
  condition = Less
  compareValue = 10
  activeWhenTrue = true
```

表示玩家等级小于 10 时显示遮罩。

### 28.3 HVMProgress

用途：把 VM 数值字段显示到 `ProgressBar.progress`。

```text
expProgress 节点挂 HVMProgress
  tag = user
  path = exp
  maxValue = 100
```

如果 `user.exp = 45`，进度会显示为 `0.45`。

### 28.4 枚举化写法

框架组件为了通用性，Inspector 暴露的是字符串 `tag/path`。
如果项目希望完全枚举化，不在 Inspector 填字符串，可以继承组件：

```ts
@ccclass('UserCoinVMLabel')
export class UserCoinVMLabel extends HVMLabel {
    protected getVMTag(): HVMTagLike {
        return ProjectVMTag.User;
    }

    protected getVMPath(): HVMPathLike {
        return UserVMPath.Coin;
    }
}
```

这样预制体只挂 `UserCoinVMLabel`，不需要手填 `user/coin`。

推荐规则：
- 框架层组件只提供通用 `tag/path` 能力。
- 项目层定义 `ProjectVMTag`、`UserVMPath` 等枚举。
- 高频、固定字段可以封装成项目组件，例如 `UserCoinVMLabel`、`TaskRewardRedDotVMState`。
- 通用临时字段可以直接使用 `HVMLabel/HVMState/HVMProgress` 填字符串。

### 28.5 HVMList

列表是 MVVM 里单独的一类组件，不能用普通 Label/State 绑定硬套。
`HVMList` 用于把 VM 中的数组字段渲染成节点列表。

适合：
- 背包格子
- 任务列表
- 排行榜
- 商城商品列表
- 邮件列表

基本节点结构：

```text
TaskPanel
  ScrollView
    view
      content  挂 HVMList
        taskItemTemplate  挂 TaskItemView，作为 templateNode，默认隐藏
```

Inspector 配置：

```text
HVMList
  tag = task
  path = taskList
  content = ScrollView/view/content
  templateNode = taskItemTemplate
  maxRenderCount = 0
  hideContentWhenEmpty = false
  recycleInactiveItems = true
```

属性说明：
- `content`：列表内容容器，通常是 `ScrollView/view/content`，不填时使用当前节点。
- `itemPrefab`：列表项预制体，适合跨界面复用的 item。
- `templateNode`：当前预制体里的模板节点，适合同一个界面内部复用。
- `maxRenderCount`：最大渲染数量，`0` 表示不限制。
- `hideContentWhenEmpty`：数据为空时是否隐藏 `content`，框架不会隐藏挂着 `HVMList` 的自身节点，避免监听被 `onDisable` 停掉。
- `recycleInactiveItems`：多余 item 是否放回节点池；关闭时会销毁多余节点。

数据写入：

```ts
H.vm.write(ProjectVMTag.Task, TaskVMPath.TaskList, [
    { id: 1, title: '每日登录', finished: true },
    { id: 2, title: '观看广告', finished: false },
]);
```

item 脚本实现：

```ts
@ccclass('TaskItemView')
export class TaskItemView extends HVMListItem<TaskData> {
    @property(Label)
    public titleLabel: Label | null = null;

    @property(Node)
    public finishedNode: Node | null = null;

    protected refreshItem(data: TaskData, index: number): void {
        if (this.titleLabel) {
            this.titleLabel.string = `${index + 1}. ${data.title}`;
        }
        if (this.finishedNode) {
            this.finishedNode.active = data.finished;
        }
    }
}
```

项目枚举化子类：

```ts
@ccclass('TaskVMList')
export class TaskVMList extends HVMList<TaskData> {
    protected getVMTag(): HVMTagLike {
        return ProjectVMTag.Task;
    }

    protected getVMPath(): HVMPathLike {
        return TaskVMPath.TaskList;
    }
}
```

运行机制：

```text
HVMList.onEnable
  -> H.vm.watch(ProjectVMTag.Task, TaskVMPath.TaskList, immediate)
  -> 读取数组
  -> 根据数组长度补齐 item 节点
  -> 多余 item 放回节点池
  -> 查找并缓存 item 渲染脚本
  -> 调用 item.onVMListItemRefresh(data, index, list)

数据变化
  -> 复用已有 item
  -> 只补齐或回收数量差
  -> 不整表 destroy
```

列表查询接口：

```ts
const itemNode = taskList.getItemNode(0);
const itemData = taskList.getItemData(0);
const dataList = taskList.getDataList();
```

这些接口只负责查看当前列表状态，不负责修改 VM。修改数据仍然统一走：

```ts
H.vm.write(ProjectVMTag.Task, TaskVMPath.TaskList, nextTaskList);
```

当前版本说明：
- 这是普通节点池列表，不是虚拟滚动列表。
- 适合几十到几百个节点以内的常规 UI。
- item 渲染脚本会缓存，避免每次刷新都遍历组件。
- 上千条排行榜或聊天记录，应扩展 `HVMVirtualList`，只渲染可视区域。

后续可继续扩展：

```text
HVMToggle      // Toggle 双向绑定
HVMEditBox     // EditBox 双向绑定
HVMRedDot      // 红点显示和数量
HVMColor       // 根据状态切颜色
HVMOpacity     // 控制透明度
HVMInteract    // 控制按钮可点击
HVMNumberRoll  // 数字滚动动画
HVMVirtualList // 超长数组虚拟滚动列表
HVMAnimState   // 值变化播放动画
```
