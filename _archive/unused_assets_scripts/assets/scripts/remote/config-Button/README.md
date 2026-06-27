# Remote Config-Button 加载流程

这套目录负责“按钮点击 -> 路由配置 -> 过场加载页 -> 远程资源预加载 -> 切场景”。

## 文件职责

- `SmartTransitionButton.ts`
  - 挂在按钮节点上。
  - 点击后根据 `route` 去 `TransitionRoute.ts` 查配置。
  - 先清理旧 bundle 缓存，再调用 `TransitionManager.gotoScene(...)`。

- `TransitionRoute.ts`
  - 统一维护跳转路由表。
  - 每条路由至少要配置：
    - `sceneName`
    - `bundles`
  - 可选配置：
    - `tips`
    - `unloadBundles`

## 整体流程

### 1. 按钮点击

按钮节点挂 `SmartTransitionButton`，并在 Inspector 里选择一个 `route`。

### 2. 读取路由配置

`SmartTransitionButton.onClickGo()` 会去 `RouteMap[route]` 里取配置：

- 要进入哪个场景
- 要预加载哪些 bundle
- 每个 bundle 里要预加载哪些 prefab
- 进入前要卸载哪些旧 bundle

### 3. 清理旧资源

如果路由里配置了 `unloadBundles`，按钮脚本会先调用：

- `RemotePrefabCache.clearBundle(bundleName)`

这样可以避免旧场景残留缓存继续占内存。

### 4. 打开过场加载页

按钮脚本会调用：

- `TransitionManager.instance.gotoScene(sceneName, bundles, tips)`

这个方法本身不直接切场景，而是会走：

- `UIManager.instance.openPopup(UIPanelId.TransitionScreen, params)`

## TransitionScreen 说明

`TransitionScreen` 是统一过场加载页，固定由下面这个配置加载：

- `bundleName: resources`
- `prefabPath: prefabs/ui/TransitionScreen`
- `rootScript: RemoteSceneLoader`

所以工程里必须有这个预制体：

- `assets/resources/prefabs/ui/TransitionScreen.prefab`

### TransitionScreen 根节点脚本

根节点挂：

- `RemoteSceneLoader`

如果是通过 `SmartTransitionButton -> TransitionManager` 打开，那么下面这两个 Inspector 字段可以留空：

- `targetSceneName`
- `bundleConfigs`

因为运行时会动态传入，不需要手填。

### TransitionScreen 最小节点结构

```text
TransitionScreen
├─ LoadingMask
│  ├─ ProgressBar
│  │  └─ Bar
│  ├─ ProgressLabel
│  └─ TipLabel
```

### RemoteSceneLoader 需要绑定的字段

- `loadingMask` -> `LoadingMask`
- `progressBar` -> `ProgressBar`
- `progressLabel` -> `ProgressLabel`
- `tipLabel` -> `TipLabel`

### 推荐设置

- `allowRepeatedClick = false`
- `enableRuntimePerfOverlay = false`

## RemoteSceneLoader 做了什么

当 `TransitionScreen` 被打开后：

### 1. 接收动态参数

`RemoteSceneLoader.onUIOpen(params)` 会接收：

- `sceneName`
- `bundles`
- `tips`

### 2. 准备加载 UI

它会：

- 初始化遮罩和透明度
- 重置进度条
- 显示提示文案

### 3. 预加载 bundle 和 prefab

按路由配置里的 `bundles` 依次处理：

- `loadBundle(bundleName)`
- `bundle.load(prefabPath, Prefab, ...)`
- 加载成功后放进 `RemotePrefabCache`

### 4. 更新进度和提示

它会持续更新：

- `progressBar.progress`
- `progressLabel.string`
- `tipLabel.string`

### 5. 关闭弹窗并切场景

资源准备完成后：

- `UIManager.instance.notifyPopupClosed(UIPanelId.TransitionScreen)`
- `director.loadScene(sceneName)`

## 新增一条路由的做法

在 `TransitionRoute.ts` 里新增一个枚举值和一条 `RouteMap` 配置。

示例：

```ts
export enum RouteType {
    None = 0,
    HomeToShop = 5,
}

[RouteType.HomeToShop]: {
    sceneName: 'ShopScene',
    unloadBundles: ['home-remote'],
    bundles: [
        {
            bundleName: 'shop-remote',
            prefabPaths: [
                'prefabs/ShopRoot',
                'prefabs/ShopHud',
            ],
        },
    ],
    tips: {
        preparing: 'Preparing shop resources',
        downloading: 'Loading shop resources',
        entering: 'Entering shop',
        failed: 'Failed to load shop resources',
    },
}
```

然后到按钮节点上把 `SmartTransitionButton.route` 选成这个新枚举。

## 使用步骤

### 1. 准备好场景跳转按钮

按钮节点挂：

- `Button`
- `SmartTransitionButton`

### 2. 选择 route

在 Inspector 里给 `SmartTransitionButton.route` 选择对应枚举。

### 3. 准备好 TransitionScreen

确保存在：

- `assets/resources/prefabs/ui/TransitionScreen.prefab`

并且根节点挂了：

- `RemoteSceneLoader`

### 4. 检查 bundleName 和 prefabPaths

`TransitionRoute.ts` 里的 `bundleName` 和 `prefabPaths` 必须和实际资源一致。

## 常见报错

### 1. `Bundle resources doesn't contain prefabs/ui/TransitionScreen`

原因：

- 没有 `assets/resources/prefabs/ui/TransitionScreen.prefab`
- 或 prefab 路径不对

处理：

- 把 `TransitionScreen.prefab` 放到 `assets/resources/prefabs/ui/`

### 2. `Prefab load failed: xxx/yyy`

原因：

- `bundleName` 不对
- `prefabPaths` 不对
- bundle 里没有这个 prefab

处理：

- 核对 `TransitionRoute.ts`
- 核对实际 bundle 资源路径

### 3. 点按钮没反应

原因：

- `route = None`
- 路由没配置
- 场景名为空

处理：

- 检查按钮上 `SmartTransitionButton.route`
- 检查 `TransitionRoute.ts`

## 当前项目排查提醒

当前工程里我看到的远程 bundle 目录有：

- `firstUI-remote`
- `home-remote`

所以你后面要重点确认：

- `TransitionRoute.ts` 里的 `bundleName`
- `UIPanelId.ts` 里的 `bundleName`

是否和你实际构建出来的 bundle 名一致。

如果名字不一致，按钮逻辑本身是对的，也一样会加载失败。
