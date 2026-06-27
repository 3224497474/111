# Remote 模块使用说明

本文档说明 `assets/scripts/remote` 目录下这套远程资源加载方案的职责、接入方式，以及当前统一后的目录约定。

## 目录约定

- `assets/scripts/remote` 是远程加载唯一主干目录。
- `assets/scripts/remote/prefetch` 负责后台预取与按组预热。
- `assets/scripts/remote/preload` 负责首屏预加载与切场景防卡。
- `assets/scripts/remote/components` 负责可直接挂载到节点上的通用远程加载组件。
- `assets/scripts/X/client/scripts` 与 `assets/scripts/X/client/tools` 当前只保留兼容转发，不再继续承载新实现。

## 目录职责

- `RemoteSceneLoader.ts`
  用于远程场景切换前的完整加载流程，支持微信登录前置检查、Bundle 加载、Prefab 预加载、限流并发队列、指数退避重试、分帧让出主线程、进度条更新，以及切场景前旧 Bundle 清理。

- `LoadingController.ts`
  较轻量的 Loading 入口，适合单 Bundle + 一组 prefab 的预加载场景。

- `RemotePrefabCache.ts`
  远程 Prefab 缓存管理器。现在已经带细粒度引用计数，调用方必须遵守：
  - `get()` 后最终要 `release()`
  - `clearBundle()` 会强制释放整个 Bundle

- `AsyncLoadQueue.ts`
  固定并发 worker 队列，避免弱网下的请求风暴。

- `MemoryMonitor.ts`
  全局常驻内存监控器。微信小游戏触发内存告警时会：
  - 打印高危日志
  - 尝试调用 `assetManager.releaseUnusedAssets()`
  - 派发 `Event_Memory_Warning`

- `BundlePrefabConfig.ts`
  Inspector 配置结构，描述“一个 Bundle + 多个 prefab 路径”。

## 启动方式

当前项目里已经接了两条启动路径，都会自动挂载 `MemoryMonitor`：

- `RemoteSceneLoader.onLoad()`
- `LoadingController.start()`

如果以后新增第三种启动入口，也要补一行：

```ts
import { MemoryMonitor } from './MemoryMonitor';

MemoryMonitor.ensureMounted(this.node);
```

## 使用方式

### 1. 用 RemoteSceneLoader 做远程场景加载

适合正式场景切换。

Inspector 里重点配置：

- `targetSceneName`
- `bundleConfigs`
- `loadingMask`
- `progressBar`
- `progressLabel`
- `tipLabel`
- `requireWechatLogin`

示例：

```ts
import { _decorator, Component } from 'cc';
import { RemoteSceneLoader } from './RemoteSceneLoader';

const { ccclass, property } = _decorator;

@ccclass('EnterGameButton')
export class EnterGameButton extends Component {
    @property(RemoteSceneLoader)
    private loader: RemoteSceneLoader | null = null;

    public onClickEnterGame() {
        if (!this.loader) {
            return;
        }

        this.loader.onClickLoadAndGo();
    }
}
```

### 2. 用 LoadingController 做简单预加载

适合只想预先拉一批 prefab，再进入下一个本地场景。

示例：

```ts
import { _decorator, Component } from 'cc';
import { LoadingController } from './LoadingController';

const { ccclass, property } = _decorator;

@ccclass('BootSceneEntry')
export class BootSceneEntry extends Component {
    @property(LoadingController)
    private loadingCtrl: LoadingController | null = null;

    start() {
        this.loadingCtrl?.onClickRetry();
    }
}
```

### 3. 从 RemotePrefabCache 取 prefab 并正确释放引用

`RemotePrefabCache.get()` 现在会自动增加内部引用计数，所以实例化后要配对调用 `release()`。

示例：

```ts
import { instantiate, Node, Prefab } from 'cc';
import { RemotePrefabCache } from './RemotePrefabCache';

export function createRemotePanel(parent: Node): Node | null {
    const bundleName = 'home';
    const path = 'prefab/Home';
    const prefab = RemotePrefabCache.get(bundleName, path) as Prefab | null;

    if (!prefab) {
        return null;
    }

    try {
        const node = instantiate(prefab);
        node.parent = parent;
        return node;
    } finally {
        RemotePrefabCache.release(bundleName, path);
    }
}
```

### 4. 监听内存告警事件

业务层可以在收到 `Event_Memory_Warning` 后做进一步瘦身，例如：

- 关闭弹窗
- 清理对象池
- 回收大图
- 停止非必要特效

示例一，走 `Notifications`：

```ts
import { Component, _decorator } from 'cc';
import { Notifications } from '../../Script/easyFramework/mgr/notifications';
import { EVENT_MEMORY_WARNING } from './MemoryMonitor';

const { ccclass } = _decorator;

@ccclass('MemoryWarningResponder')
export class MemoryWarningResponder extends Component {
    onLoad() {
        Notifications.on(EVENT_MEMORY_WARNING, this.onMemoryWarning, this);
    }

    onDestroy() {
        Notifications.off(EVENT_MEMORY_WARNING, this);
    }

    private onMemoryWarning(payload: { level?: number }) {
        console.warn('[MemoryWarningResponder] 收到内存告警', payload);
    }
}
```

示例二，走 `director.on`：

```ts
import { Component, director, _decorator } from 'cc';
import { EVENT_MEMORY_WARNING } from './MemoryMonitor';

const { ccclass } = _decorator;

@ccclass('MemoryWarningResponder2')
export class MemoryWarningResponder2 extends Component {
    onLoad() {
        director.on(EVENT_MEMORY_WARNING, this.onMemoryWarning, this);
    }

    onDestroy() {
        director.off(EVENT_MEMORY_WARNING, this.onMemoryWarning, this);
    }

    private onMemoryWarning(payload: { level?: number }) {
        console.warn('[MemoryWarningResponder2] 收到内存告警', payload);
    }
}
```

## 当前这套代码的关键约束

### 1. Prefab 缓存不是“白拿”

只要走了：

```ts
RemotePrefabCache.get(bundleName, path)
```

后面就必须有：

```ts
RemotePrefabCache.release(bundleName, path)
```

否则引用计数只增不减，最终还是会内存泄漏。

### 2. clearBundle 是强制卸载

现在的 `clearBundle(bundleName)` 不只是清 Map，还会：

- `bundle.releaseAll()`
- `assetManager.removeBundle(bundle)`

所以调用后，该 Bundle 下资源默认都视为无效，后续再用必须重新加载。

### 3. 队列限流和分帧让出都不要随便删

现在的加载流包含：

- `MAX_CONCURRENT = 4`
- 指数退避重试
- `yieldFrame()` 分帧让出

这三者一起解决的是：

- 弱网请求风暴
- 批量回调阻塞主线程
- 进度条卡死不刷新

少任何一个，加载体验都会明显变差。

## 目录清理建议

### 已经完成的清理

当前已经清掉：

- `RemoteSceneLoader.ts` 中不可达的旧全并发实现
- `LoadingController.ts` 中不可达的旧全并发实现
- 多个文件里的历史乱码注释

### 现在不建议删除的文件

下面这些文件当前都有真实引用：

- `AsyncLoadQueue.ts`
- `BundlePrefabConfig.ts`
- `LoadingController.ts`
- `MemoryMonitor.ts`
- `RemotePrefabCache.ts`
- `RemoteSceneLoader.ts`

### 后续可选整理

如果项目最终只保留一个加载入口，可以在确认调用链后，再决定是否淘汰：

- `LoadingController.ts`
- `RemoteSceneLoader.ts`

不要在两个入口并存时直接删其中一个。  

















也就是在制作预制体的时候，把一个场景下的预制体全部放在一个文件夹下，比如home场景，文件夹名：home—remote，目录下有pic存放图片资源，perfabs存放预制体，这样吗

Gemini 说
**是的，你的理解完全正确！这正是目前商业化小游戏最标准的“按业务模块高内聚”**的 Bundle（分包/远程包）目录组织方式。

在 Cocos Creator 中，一个文件夹就可以被配置为一个 Bundle。将属于同一个场景或系统的资源“全家桶”放在同一个文件夹下，不仅方便开发管理，更完美契合了我们前面讲的**“内存大洗牌（清盘）”**策略。

下面给你展示一个标准的商业级小游戏目录结构规划，以及需要注意的“避坑原则”：

标准的远程包目录结构示例
建议在 assets 目录下建一个专门存放远程包的总目录（例如叫 bundles 或 remote），然后按场景/系统细分：

Plaintext
assets/
├── scripts/                <-- 所有的代码脚本（注意：小游戏代码必须放本地主包）
├── scenes/                 <-- 所有的场景文件（如 LoadingScene, HomeScene）
├── common_ui/              <-- 常驻本地主包的通用底图、摇杆、通用按钮等（不走远程）
└── remote_bundles/         <-- 存放所有远程 Bundle 的大目录
    │
    ├── home-remote/        <-- 【配置为 Bundle: 放在远程服务器】
    │   ├── prefabs/        <-- 存放 HomePanel.prefab, SettingPanel.prefab
    │   ├── textures/       <-- (你说的pic) 存放主界面专属背景图、图标
    │   └── audios/         <-- 存放主界面专属的 BGM 和按钮音效
    │
    ├── battle-remote/      <-- 【配置为 Bundle: 放在远程服务器】
    │   ├── prefabs/        <-- 存放 Player.prefab, Boss.prefab
    │   ├── textures/       <-- 存放战斗专属贴图
    │   └── animations/     <-- 存放骨骼动画、特效
    │
    └── common-remote/      <-- 【极其重要：远程公共包】
        ├── prefabs/        <-- 如通用的“获得物品提示框”、“网络重连弹窗”
        └── textures/       <-- 跨场景都会用到的物品Icon（金币、钻石）
为什么必须这样组织？（带来的好处）
结合我们之前写的代码，这种结构的威力在于内存释放极其干净。
当玩家从 home 场景切换到 battle 场景时，你在代码里只需要调用一句：
RemotePrefabCache.clearBundle('home-remote');
系统不仅会销毁那些 UI 预制体，还会顺藤摸瓜把 home-remote/textures/ 下的几兆的大背景图、立绘全部从手机显存里拔除，瞬间为即将到来的战斗场景腾出大量内存。

⚠️ 制作 Bundle 文件夹的三大“黄金红线”
在实际拖拽资源到这些文件夹时，有三个致命的错误一定要避免：

1. 跨 Bundle 引用陷阱（最容易犯的错）
假设你的 home-remote 和 shop-remote 里的预制体，都用到了一张相同的“金币图标.png”。

错误做法：把金币图片放在 home-remote 下，然后 shop-remote 里的预制体直接引用它。这会导致加载商城时，引擎必须把整个 home-remote 也下下来；或者引擎会在构建时，悄悄把金币图片复制两份，导致包体变大。

正确做法：只要有两个以上的 Bundle 用到了同一个资源，必须把它抽离到 common-remote（公共远程包）或者本地主包中。

2. 代码（Scripts）千万不要放进远程 Bundle
在微信小游戏环境下，由于微信底层的安全限制，远程下载的代码（JS文件）是无法直接 eval 运行的。

规则：所有的 .ts 脚本文件，必须统统放在主包（不要放在任何被标记为 Bundle 的文件夹内）。预制体虽然在远程，但它身上挂载的脚本组件引用依然能完美关联到主包的代码。

3. 与我们配置表的对应关系
按照你规划的 home-remote 文件夹，当你在编辑器里使用我们之前写的 BundlePrefabConfig 脚本时：

bundleName 填入：home-remote

prefabPaths 填入：prefabs/主界面、prefabs/签到面板 （注意：路径是从 Bundle 根目录开始算的，不需要写 .prefab 后缀，也不需要写 home-remote/ 前缀）

按照你的思路继续做下去，你的资源管线会非常健康，不用担心后期重构的问题！
