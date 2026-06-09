# H 框架 V1 接入文档

## 1. 定位

`H` 是一套通用 Cocos Creator 小游戏应用框架，不绑定任何具体项目。

V1 包含：

- `H.resource`：首屏必要资源、预加载预制体、后台资源下载。
- `H.transition`：大型 UI、场景跳转、资源加载时的过渡界面和加载动画。
- `H.ui`：UI 层级、互斥、缓存、提示层。
- `H.redDot`：红点树、红点显示、红点脏刷新、红点存储。
- `H.data`：模块数据、本地存储、脏数据批量落盘。
- `H.platform`：微信、抖音、Mock 平台识别和授权接口。
- `H.user`：头像、昵称、地区、位置信息统一 API。
- `H.ad`：微信、抖音、Mock 广告统一 API。
- `H.event`：通用事件总线。

## 2. 目录

```text
assets/scripts/H/
├── H.ts
├── HTypes.ts
├── index.ts
├── SDK.md
├── core/
├── data/
├── ui/
├── redDot/
├── resource/
├── transition/
├── platform/
├── user/
└── ad/
```

业务层导入：

```ts
import { H } from '../H';
```

如果业务文件层级更深，按实际目录调整：

```ts
import { H } from '../../H';
```

## 3. 初始化

建议在游戏启动阶段调用一次：

```ts
import { Prefab, SpriteFrame } from 'cc';
import { H } from '../H';

H.init({
    uiRoot: this.node,
    data: {
        namespace: 'my-game',
        flushDelayMs: 1000,
        debug: true,
    },
    platform: {
        platform: 'auto',
        debug: true,
    },
    resource: {
        debug: true,
        backgroundConcurrency: 1,
        critical: [
            { path: 'ui/HomeView', type: Prefab, cache: true },
            { path: 'textures/logo', type: SpriteFrame, cache: true },
        ],
        preload: [
            { path: 'ui/ShopView', type: Prefab, preloadOnly: true },
            { path: 'ui/TaskView', type: Prefab, preloadOnly: true },
        ],
        background: [
            { path: 'ui/RankView', type: Prefab, preloadOnly: true },
            { path: 'textures/rank_bg', type: SpriteFrame, preloadOnly: true },
        ],
    },
    ad: {
        platform: 'auto',
        rewardTimeoutMs: 15000,
        ids: {
            wechat: {
                reward: {
                    revive: '微信激励视频广告位ID',
                },
            },
            douyin: {
                reward: {
                    revive: '抖音激励视频广告位ID',
                },
            },
        },
    },
});
```

没有 UI 根节点时，也可以先初始化非 UI 模块：

```ts
H.init({
    platform: {
        platform: 'auto',
    },
});
```

之后再初始化 UI 和过渡层：

```ts
H.ui.init(uiRootNode);
H.transition.init(H.ui);
```

## 4. 资源加载分层

资源不要一上来全加载。V1 推荐分三层：

| 分层 | 说明 | 调用时机 |
| --- | --- | --- |
| 首屏必要资源 `critical` | 首页、登录页、首个场景必须显示的资源 | 启动阶段，必须等待完成 |
| 预加载预制体 `preload` | 商店、任务、背包等高概率打开 UI | 进首页后立刻加载，可显示过渡或静默 |
| 后台资源 `background` | 排行榜、活动页、低频弹窗、大图 | 进入主界面后低并发下载 |

### 4.1 推荐把资源暴露成 Profile

不建议长期把资源清单写死在 `HResourceFacade.ts`。

推荐放到：

```text
assets/scripts/H/resource/HResourceProfile.ts
```

示例：

```ts
import { HDefaultResourceProfile } from '../H/resource/HResourceProfile';

H.init({
    uiRoot: this.node,
    resource: {
        profile: HDefaultResourceProfile,
    },
});
```

Profile 结构：

```ts
export const HDefaultResourceProfile = {
    name: 'default',
    debug: true,
    backgroundConcurrency: 1,
    critical: [
        {
            enabled: true,
            key: 'home_view',
            bundle: 'resources',
            path: 'ui/HomeView',
            assetType: 'Prefab',
            cache: true,
            preloadOnly: false,
            note: '首屏首页 UI',
        },
    ],
    preload: [
        {
            enabled: true,
            key: 'shop_view',
            bundle: 'resources',
            path: 'ui/ShopView',
            assetType: 'Prefab',
            preloadOnly: true,
            note: '常用商店页面',
        },
    ],
    background: [
        {
            enabled: true,
            key: 'rank_view',
            bundle: 'resources',
            path: 'ui/RankView',
            assetType: 'Prefab',
            preloadOnly: true,
            note: '低频排行榜页面，后台加载',
        },
    ],
};
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `enabled` | 是否启用，方便面板里临时关闭资源 |
| `key` | 资源缓存和面板显示用的稳定 key |
| `bundle` | Bundle 名，默认 `resources` |
| `path` | Bundle 内资源路径，不带扩展名 |
| `assetType` | 资源类型，例如 `Prefab`、`SpriteFrame`、`Texture2D`、`AudioClip`、`JsonAsset` |
| `cache` | 是否加载后缓存 Asset |
| `preloadOnly` | 是否只预加载，不立即取 Asset |
| `note` | 面板备注 |

这份 Profile 就是后续编辑器面板的数据源。面板可以做成表格：

```text
启用 | 阶段 | Bundle | 路径 | 类型 | 缓存 | 仅预加载 | 备注
```

`HResourceFacade` 已经提供读取当前登记队列的接口：

```ts
const criticalTasks = H.resource.getRegisteredTasks('critical');
const preloadTasks = H.resource.getRegisteredTasks('preload');
const backgroundTasks = H.resource.getRegisteredTasks('background');
```

所以后续面板只需要负责编辑 Profile，运行时仍然交给 `H.resource` 执行。

### 4.2 加载首屏必要资源

```ts
await H.transition.run({
    title: '正在启动',
    message: '加载首屏资源',
    animation: 'dots-bar',
    minShowMs: 500,
}, async (setProgress) => {
    await H.resource.loadCritical(undefined, (finished, total) => {
        setProgress(finished / total, '加载首屏资源');
    });
});
```

首屏资源只放必须资源。不要把排行榜、活动页、皮肤大图放进去。

### 4.3 预加载常用预制体

```ts
await H.resource.preloadPrefabs([
    'ui/ShopView',
    'ui/TaskView',
    'ui/BagView',
], (finished, total) => {
    console.log(`预加载 UI ${finished}/${total}`);
});
```

预加载后，后续 `H.ui.open({ prefabPath })` 会更快。

### 4.4 加载已登记的 preload 队列

```ts
await H.resource.preloadRegistered((finished, total) => {
    console.log(`预加载 ${finished}/${total}`);
});
```

### 4.5 后台下载不重要资源

```ts
H.resource.startBackground();
```

动态加入后台队列：

```ts
H.resource.enqueueBackground([
    { path: 'ui/RankView', preloadOnly: true },
    { path: 'textures/rank_bg', preloadOnly: true },
]);
```

暂停后台下载：

```ts
H.resource.pauseBackground();
```

查看后台状态：

```ts
const status = H.resource.getBackgroundStatus();
console.log(status.pending, status.active);
```

建议：

- 后台并发默认 `1`，避免影响首屏、广告和玩家点击。
- 玩家进入战斗或强操作阶段时，可以 `pauseBackground()`。
- 玩家回到首页或停留在轻操作界面时，再 `startBackground()`。

### 4.6 直接加载并缓存资源

```ts
const prefab = await H.resource.loadAsset({
    path: 'ui/ShopView',
    type: Prefab,
    cache: true,
});
```

读取缓存：

```ts
const cached = H.resource.getCached<Prefab>('resources:ui/ShopView');
```

释放缓存：

```ts
H.resource.releaseCached('resources:ui/ShopView');
```

Bundle 资源：

```ts
await H.resource.loadAsset({
    bundle: 'home-remote',
    path: 'prefabs/HomePanel',
    type: Prefab,
    cache: true,
});
```

## 5. 过渡界面

`H.transition` 用于大型 UI、场景跳转、资源下载。

它默认放在 `transition` 层，层级高于 `layer4`，低于 `tip`。

动画模式：

| animation | 说明 |
| --- | --- |
| `none` | 无动画 |
| `dots` | 文案后面循环点点点 |
| `bar` | 只显示进度条 |
| `dots-bar` | 文案动画 + 进度条 |

显示过渡界面：

```ts
await H.transition.show({
    title: '正在加载',
    message: '准备资源',
    animation: 'dots-bar',
    progress: 0,
    minShowMs: 500,
});
```

更新进度：

```ts
H.transition.updateProgress(0.5, '加载预制体');
```

隐藏：

```ts
await H.transition.hide();
```

推荐用 `run` 包住异步流程：

```ts
await H.transition.run({
    title: '正在打开',
    message: '加载商店',
    animation: 'dots-bar',
}, async (setProgress) => {
    await H.resource.preloadPrefabs(['ui/ShopView'], (finished, total) => {
        setProgress(finished / total, '加载商店资源');
    });

    setProgress(0.9, '创建界面');
    await H.ui.open({
        id: 'ShopView',
        layer: 'layer2',
        prefabPath: 'ui/ShopView',
        mutexGroup: 'main-page',
        cacheMode: 'hide',
    });
});
```

大型 UI 快捷打开：

```ts
await H.transition.openLargeUI({
    id: 'RankView',
    layer: 'layer2',
    prefabPath: 'ui/RankView',
    mutexGroup: 'main-page',
    cacheMode: 'hide',
}, {
    title: '正在打开排行',
    message: '加载排行榜界面',
});
```

场景跳转：

```ts
await H.transition.loadScene('Battle', {
    title: '进入战斗',
    message: '正在加载战斗场景',
    animation: 'dots-bar',
    minShowMs: 800,
});
```

## 6. UI 管理层

H UI 管理层参考商业项目常见结构增强，但不绑定任何业务常量。它负责层级、配置表、生命周期、返回栈、互斥、缓存、全局 Loading 和 Tip。

固定六层：

| 层级 | 名称 | 用途 |
| --- | --- | --- |
| `layer1` | 主界面层 | 首页、战斗 HUD、主玩法 UI |
| `layer2` | 一级页面层 | 背包、商店、任务、排行榜 |
| `layer3` | 弹窗层 | 奖励弹窗、确认弹窗、详情弹窗 |
| `layer4` | 强制层 | 授权弹窗、新手引导、重要公告 |
| `transition` | 过渡层 | 大 UI、切场景、资源加载遮罩 |
| `tip` | 提示层 | Toast、飘字、加载失败提示 |

### 6.1 H 框架内置 UI 配置表

UI 配置表已经放在 H 框架内部：

```text
assets/scripts/H/ui/HUIConfig.ts
```

在这个文件里填写 UI 预制体配置：

```ts
export const HUIConfigs = [
    {
        id: 'HomeView',
        type: 'page',
        layer: 'layer1',
        bundle: 'resources',
        prefabPath: 'ui/HomeView',
        cacheMode: 'keep',
        blockBack: true,
    },
    {
        id: 'ShopView',
        type: 'page',
        layer: 'layer2',
        bundle: 'resources',
        prefabPath: 'ui/ShopView',
        cacheMode: 'hide',
        group: 'main-page',
        exclusive: true,
    },
    {
        id: 'RewardDialog',
        type: 'dialog',
        layer: 'layer3',
        bundle: 'resources',
        prefabPath: 'ui/RewardDialog',
        cacheMode: 'destroy',
    },
];
```

Loading 阶段调用 `H.init({ uiRoot })` 后，`H.ui` 会自动注册 `HUIConfig.ts` 里的配置。

登记后，业务层可以只用 id 打开：

```ts
await H.ui.open('ShopView', { defaultTab: 'diamond' });
H.ui.close('ShopView');
```

也可以继续直接打开，不强制登记：

```ts
await H.ui.open({
    id: 'ShopView',
    layer: 'layer2',
    bundle: 'resources',
    prefabPath: 'ui/ShopView',
    group: 'main-page',
    cacheMode: 'hide',
});
```

Bundle 写法：

```ts
await H.ui.open({
    id: 'HomeView',
    bundle: 'home',
    prefabPath: 'prefabs/Home',
    layer: 'layer1',
    cacheMode: 'keep',
});
```

快捷写法也支持 `bundle|path`：

```ts
await H.ui.open('home|prefabs/Home');
```

### 6.2 页面、弹窗和互斥

| 字段 | 说明 |
| --- | --- |
| `type: 'page'` | 页面，会进入页面返回栈，默认互斥 |
| `type: 'dialog'` | 弹窗，会进入弹窗返回栈，默认不互斥 |
| `group` | UI 分组，常用于主页面、二级页面、弹窗分类 |
| `mutexGroup` | 更明确的互斥组，同组打开会自动关闭其它 UI |
| `exclusive` | 是否关闭同层同类型 UI，页面默认 true |
| `blockBack` | 是否阻止返回键关闭，主界面默认 true |

同一组页面互斥：

```ts
await H.ui.open({
    id: 'BagView',
    type: 'page',
    layer: 'layer2',
    prefabPath: 'ui/BagView',
    group: 'main-page',
    exclusive: true,
});
```

关闭一层或一组：

```ts
H.ui.closeLayer('layer3');
H.ui.closeGroup('main-page');
```

### 6.3 打开关闭动画

H.ui 默认带基础打开和关闭动画：

| UI 类型 | 默认动画 |
| --- | --- |
| `page` | `fade` |
| `dialog` | `fade-scale` |
| `loading` | `fade` |
| `tip` | `fade` |

支持的动画类型：

```ts
'none' | 'fade' | 'scale' | 'fade-scale'
| 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right'
```

登记配置时指定：

```ts
H.ui.registerConfig({
    id: 'RewardDialog',
    type: 'dialog',
    layer: 'layer3',
    prefabPath: 'ui/RewardDialog',
    cacheMode: 'destroy',
    animation: 'fade-scale',
});
```

打开时临时指定：

```ts
await H.ui.open({
    id: 'ShopView',
    type: 'page',
    layer: 'layer2',
    prefabPath: 'ui/ShopView',
    animation: 'slide-left',
});
```

高级配置：

```ts
H.ui.registerConfig({
    id: 'BagView',
    type: 'page',
    layer: 'layer2',
    prefabPath: 'ui/BagView',
    animation: {
        open: 'slide-up',
        close: 'slide-down',
        openDuration: 0.18,
        closeDuration: 0.12,
        distance: 120,
    },
});
```

关闭时不用额外调用动画，`H.ui.close(id)` 会自动播放关闭动画，结束后再根据 `cacheMode` 隐藏或销毁节点。

### 6.4 生命周期脚本

业务 UI 可以继承 `HBaseUI`：

```ts
import { HBaseUI } from '../H';

export class ShopView extends HBaseUI {
    public onUILoad(params?: any): void {
        // 只在第一次打开时执行，适合绑定按钮和缓存节点引用。
    }

    public onUIOpen(params?: any): void {
        // 每次打开时执行，适合刷新页签和数据。
    }

    public onUIHide(): void {
        // 被隐藏时执行，适合暂停动画和注销临时监听。
    }

    public onUIBack(): boolean {
        // 返回 true 表示自己处理返回键，H.ui 不自动关闭。
        return false;
    }
}
```

如果不继承 `HBaseUI`，普通 Component 只要实现 `onUIOpen`、`hide`、`show`、`openUI` 等方法，H.ui 也会自动识别。

### 6.5 返回栈

弹窗优先返回，其次返回页面：

```ts
const handled = H.ui.goBack();
```

常用关闭：

```ts
H.ui.closeTopDialog();
H.ui.destroy('RewardDialog');
H.ui.clearHiddenCache();
```

### 6.6 全局 Loading

`showLoading/hideLoading` 使用引用计数，多个异步流程同时显示 Loading 时，不会被某一个流程提前关闭。

```ts
H.ui.showLoading('正在请求服务器');

try {
    await requestServer();
} finally {
    H.ui.hideLoading();
}
```

推荐写法：

```ts
await H.ui.withLoading(async () => {
    await H.resource.preloadPrefabs(['ui/ShopView']);
}, '正在加载商店');
```

如果项目有自己的 Loading 预制体，可以登记默认 Loading：

```ts
H.ui.registerConfig({
    id: 'h:global_loading',
    type: 'loading',
    layer: 'transition',
    prefabPath: 'ui/GlobalLoading',
    cacheMode: 'keep',
});
```

### 6.7 Tip

```ts
H.ui.showTip('奖励已领取');
```

当前 Tip 是代码生成的轻量 Label，正式项目可以继续替换成自己的 Toast 预制体和对象池。

缓存模式：

| cacheMode | 说明 |
| --- | --- |
| `destroy` | 关闭时销毁节点，适合低频弹窗 |
| `hide` | 关闭时隐藏节点，适合常用页面 |
| `keep` | 长期保留，适合主界面或高频 UI |

## 7. 红点

红点路径推荐使用斜杠树：

```text
Root/shop/item
Root/task/daily
Root/mail/unread
```

旧写法 `task.daily` 也兼容，会自动转成 `task/daily`。

### 7.1 Loading 阶段统一读取本地红点

红点数据依赖 `H.data`，推荐在 Loading 脚本里统一初始化：

```ts
H.init({
    data: {
        namespace: 'my-game-user-001',
        storageMode: 'both',
        autoLoadLocal: true,
        modules: [
            {
                name: 'redDot',
                defaultValue: {},
            },
        ],
    },
    redDot: {
        storageModuleName: 'redDot',
        autoLoadLocal: true,
        persistByDefault: false,
    },
});
```

如果你需要手动读取：

```ts
H.redDot.loadLocalData();
```

手动保存：

```ts
H.redDot.saveLocal(true);
```

导出和导入：

```ts
const redDotData = H.redDot.exportData();
H.redDot.importData(redDotData, true);
```

如果使用 `HLoadingScene`，也可以直接在 Loading 脚本属性面板填写：

| 属性 | 说明 |
| --- | --- |
| `dataNamespace` | H.data 本地存储命名空间 |
| `redDotStorageModuleName` | 红点存储模块名，默认 `redDot` |
| `autoLoadRedDotLocal` | 是否在 Loading 阶段读取本地红点 |
| `persistRedDotByDefault` | 是否让红点默认持久化，一般关闭 |

### 7.2 图标节点挂载脚本

在红点图标节点上挂 `HRedDotIcon`：

```text
ShopButton
└── RedDotIcon  <- 挂 HRedDotIcon
```

属性面板填写：

| 属性 | 填写 |
| --- | --- |
| `redDotPath` | `Root/shop/item` |
| `autoDefine` | 通常勾选 |
| `persist` | 需要本地保存时勾选 |
| `targetNode` | 为空时控制当前节点，也可以拖具体红点图标 |
| `countLabel` | 数字红点文本，可选 |
| `showCount` | 是否显示数量 |
| `maxDisplayCount` | 最大显示值，超过显示为 `99+` |

运行时会自动监听 `Root/shop/item` 的红点变化，红点为 true 时显示图标，为 false 时隐藏图标。

### 7.3 代码定义和设置

```ts
H.redDot.define('Root/task/daily', {
    persist: true,
});
```

设置红点：

```ts
H.redDot.setValue('Root/task/daily', true, true);
```

计数红点：

```ts
// 设置为 0，红点隐藏。
H.redDot.setCount('Root/shop/item', 0, true);

// 增加 11 个，Root/shop/item 显示，父节点 Root/shop 和 Root 会自动汇总为 11。
H.redDot.addCount('Root/shop/item', 11, true);

// 消耗或查看 1 个，不会减到 0 以下。
H.redDot.reduceCount('Root/shop/item', 1, true);

// 读取汇总数量。
const shopCount = H.redDot.getCount('Root/shop');
```

计数规则：

```text
Root/shop/item = 11
Root/shop = 11
Root = 11

Root/shop/item = 0
Root/shop = 0
Root = 0
```

监听红点：

```ts
private offRedDot: (() => void) | null = null;

protected onLoad(): void {
    this.offRedDot = H.redDot.watch('Root/task/daily', (visible, key, count) => {
        this.redDotNode.active = visible;
        this.countLabel.string = `${count}`;
    });
}

protected onDestroy(): void {
    this.offRedDot?.();
}
```

绑定节点：

```ts
const off = H.redDot.bindNode('Root/mail/unread', this.mailRedDotNode);
```

红点会自动向父级汇总：

```text
Root/task/daily = 1
Root/task = 1
Root = 1
```

红点变更不会立刻全量刷新，而是先标记 dirty，再在下一帧批量刷新。

## 8. 数据存储

H.data 现在分成两层：

1. `H.data` 是统一存储门面，负责本地读取、脏数据、批量保存、导入导出。
2. `H.data.module('xxx')` 是业务模块门面，负责某个模块的数据读写。

### 8.1 进入游戏时配置本地读取

```ts
H.init({
    data: {
        namespace: 'my-game-user-001',
        version: 1,
        flushDelayMs: 1000,
        storageMode: 'both',
        snapshotKey: '__save__',
        autoLoadLocal: true,
        modules: [
            {
                name: 'player',
                defaultValue: {
                    level: 1,
                    coin: 0,
                    diamond: 0,
                },
            },
            {
                name: 'setting',
                defaultValue: {
                    audio: {
                        music: true,
                        effect: true,
                    },
                },
            },
            {
                name: 'task',
                defaultValue: {
                    claimedIds: [],
                },
            },
        ],
    },
});
```

`autoLoadLocal: true` 时，H 初始化会把已注册模块从本地读取到缓存。业务进入 Home 后直接读取即可，不需要每个 UI 自己读 localStorage。

`storageMode` 说明：

| storageMode | 说明 |
| --- | --- |
| `module` | 默认模式，每个模块单独保存，key 是 `namespace.moduleName` |
| `snapshot` | 只保存完整快照，key 是 `namespace.snapshotKey` |
| `both` | 模块单独保存，同时保存完整快照，最适合学习、调试和后续云存档 |

### 8.2 模块门面模式

推荐在业务 Facade 或 Model 中持有模块门面：

```ts
const playerData = H.data.module('player', {
    level: 1,
    coin: 0,
    diamond: 0,
});
```

读取完整模块：

```ts
const player = playerData.get();
```

合并更新：

```ts
playerData.patch({
    coin: player.coin + 100,
});
```

点路径读写：

```ts
const musicEnabled = H.data
    .module('setting')
    .getValue('audio.music', true);

H.data
    .module('setting')
    .setValue('audio.music', false);
```

重要数据立即保存：

```ts
playerData.setValue('diamond', 10, {
    immediate: true,
});
```

普通数据会先标记 dirty，默认 1000ms 后批量落盘。切后台时会自动 `flush`。

### 8.3 旧接口仍然可用

```ts
const task = H.data.getModule('task', {
    claimedIds: [],
});

H.data.setModule('task', {
    claimedIds: ['task_001'],
});

H.data.setValue('setting', 'audio.music', true);

const musicEnabled = H.data.getValue('setting', 'audio.music', true);
```

### 8.4 最终本地存档快照

导出完整快照：

```ts
const snapshot = H.data.exportSnapshot();
console.log(JSON.stringify(snapshot));
```

快照结构：

```ts
{
    version: 1,
    namespace: 'my-game-user-001',
    updatedAt: 1710000000000,
    modules: {
        player: { level: 1, coin: 100, diamond: 10 },
        setting: { audio: { music: true, effect: true } },
        task: { claimedIds: ['task_001'] },
    },
}
```

导入快照：

```ts
H.data.importSnapshot(snapshot, {
    immediate: true,
});
```

手动强制保存所有脏模块：

```ts
H.flush();
```

清理数据：

```ts
H.data.clearModule('task');
H.data.clearAll();
```

## 9. 平台识别

自动识别：

```ts
const platform = H.platform.getPlatform();
```

返回值：

```ts
'wechat' | 'douyin' | 'mock' | 'unknown'
```

登录：

```ts
const login = await H.platform.login();
if (login.ok) {
    console.log(login.code);
}
```

授权状态：

```ts
const setting = await H.platform.getSetting();
console.log(setting.authSetting);
```

主动授权：

```ts
const ok = await H.platform.authorize('scope.userLocation');
```

打开授权设置：

```ts
await H.platform.openSetting();
```

## 10. 用户头像、昵称、位置

请求头像昵称：

```ts
const profile = await H.user.requestProfileByUserTap('用于展示排行榜头像昵称');
if (profile.authorized) {
    this.nickLabel.string = profile.nickName;
}
```

注意：微信和抖音通常要求这类接口由玩家点击行为触发，不建议在游戏启动时自动调用。

读取缓存头像：

```ts
const nickName = H.user.getNickName();
const avatarUrl = H.user.getAvatarUrl();
```

请求位置：

```ts
const location = await H.user.requestLocation();
if (location.authorized) {
    console.log(location.latitude, location.longitude);
}
```

读取 UI 展示信息：

```ts
const info = H.user.getDisplayInfo();
this.nameLabel.string = info.nickName;
```

## 11. 广告

Mock 学习模式：

```ts
H.init({
    ad: {
        platform: 'mock',
        mock: {
            rewardResult: 'success',
            delayMs: 500,
        },
    },
});
```

真实广告 ID：

```ts
H.init({
    ad: {
        platform: 'auto',
        ids: {
            wechat: {
                reward: {
                    revive: '微信激励视频广告位ID',
                    double_coin: '微信激励视频广告位ID',
                },
            },
            douyin: {
                reward: {
                    revive: '抖音激励视频广告位ID',
                    double_coin: '抖音激励视频广告位ID',
                },
            },
        },
    },
});
```

激励视频：

```ts
const ret = await H.ad.showReward('revive');

if (ret.rewarded) {
    this.revivePlayer();
} else {
    H.ui.showTip(ret.userMessage || '广告暂不可用，请稍后再试');
}
```

插屏：

```ts
await H.ad.showInterstitial('level_end');
```

Banner：

```ts
await H.ad.showBanner('home_bottom', {
    position: 'bottom-center',
    widthRatio: 0.8,
});

H.ad.hideBanner();
H.ad.destroyBanner();
```

广告发奖只看：

```ts
ret.rewarded
```

不要用 `ok`、`shown`、Promise 成功判断发奖。

## 12. 外部业务推荐写法

启动流程：

```ts
protected async onLoad(): Promise<void> {
    H.init({
        uiRoot: this.node,
        resource: {
            critical: [
                { path: 'ui/HomeView', type: Prefab, cache: true },
            ],
            preload: [
                { path: 'ui/ShopView', type: Prefab, preloadOnly: true },
            ],
            background: [
                { path: 'ui/RankView', type: Prefab, preloadOnly: true },
            ],
        },
    });

    await H.transition.run({
        title: '正在启动',
        message: '加载首屏资源',
    }, async (setProgress) => {
        await H.resource.loadCritical(undefined, (finished, total) => {
            setProgress(finished / total, '加载首屏资源');
        });
    });

    await H.ui.open({
        id: 'HomeView',
        layer: 'layer1',
        prefabPath: 'ui/HomeView',
        cacheMode: 'keep',
    });

    void H.resource.preloadRegistered();
    H.resource.startBackground();
}
```

复活按钮：

```ts
public onClickRevive(): void {
    void this.watchAdForRevive();
}

private async watchAdForRevive(): Promise<void> {
    const ret = await H.ad.showReward('revive');

    if (!ret.rewarded) {
        H.ui.showTip(ret.userMessage || '广告暂不可用，请稍后再试');
        return;
    }

    this.revivePlayer();
}
```

领取任务奖励：

```ts
public claimTask(taskId: string): void {
    H.data.setValue('task', `claimed.${taskId}`, true);
    H.redDot.setValue('task.daily', false, true);
}
```

## 13. V1 不足点

V1 先解决通用骨架，不做重型商业化系统。

当前不足：

- UI 已有配置表、生命周期、返回栈、互斥、缓存和全局 Loading，但还没有可视化 UI 配置编辑器。
- Tip 是代码生成的简易 Label，正式项目建议换成预制体对象池和统一动效。
- 过渡界面是代码生成的通用样式，正式项目可以替换成美术预制体。
- 资源后台队列支持低并发下载，但暂不支持真正取消正在加载中的单个资源。
- 资源缓存只提供手动缓存和释放，暂不做 LRU 自动淘汰。
- 红点有树和 dirty 刷新，但没有可视化调试面板。
- 数据存储是本地存储，重要货币和付费奖励仍然需要服务端校验。
- 平台用户资料接口只能封装流程，不能绕过微信/抖音的授权限制。
- 定位授权失败后，仍然需要业务 UI 引导玩家打开设置。
- 广告 V1 没有瀑布流、eCPM、A/B 测试和收益埋点。
- 平台 Adapter 只覆盖微信、抖音、Mock，其他平台需要新增适配器。

## 14. 推荐下一步

V1 先接入：

1. 启动时 `H.init`。
2. 首屏资源接 `H.resource.loadCritical`。
3. 大加载流程接 `H.transition.run`。
4. 首页根节点接 `H.ui.open`。
5. 常用 UI 接 `H.resource.preloadPrefabs` 或 `preloadRegistered`。
6. 后台资源接 `H.resource.startBackground`。
7. 一个真实业务按钮接 `H.ad.showReward`。
8. 一个红点接 `H.redDot.watch`。
9. 一个玩家信息 UI 接 `H.user.requestProfileByUserTap`。

这些跑通后，再继续扩展 UI 动画、对象池、红点调试面板、资源 LRU 和广告埋点。
