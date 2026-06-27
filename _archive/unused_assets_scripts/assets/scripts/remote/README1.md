# Remote 使用示例

本文档只放可直接参考的代码示例，重点说明 `TransitionManager`、`RemoteSceneLoader` 和 `TransitionScreen.prefab` 的接入方式。

## 1. 通过 TransitionManager 发起场景跳转

适合从 `Home`、`Story`、`Battle` 等任意业务界面发起统一过渡。

```ts
import { _decorator, Component } from 'cc';
import { TransitionManager } from './TransitionManager';

const { ccclass } = _decorator;

@ccclass('EnterBattleButton')
export class EnterBattleButton extends Component {
    public async onClickEnterBattle() {
        await TransitionManager.instance.gotoScene('BattleScene', [
            {
                bundleName: 'battle-remote',
                prefabPaths: [
                    'prefabs/BattleRoot',
                    'prefabs/BattleHUD',
                    'prefabs/BattlePausePanel',
                ],
            },
        ]);
    }
}
```

说明：
- 现在即使不额外传提示文案，`BattleScene` 也会自动显示为“正在准备战斗资源 / 正在加载战斗资源 / 正在进入战斗”。
- 这是 `RemoteSceneLoader` 根据场景名自动推断出来的默认文案。

## 2. 显式指定过渡提示文案

如果你希望文案更业务化，直接传第三个参数 `tips`。

```ts
import { _decorator, Component } from 'cc';
import { TransitionManager } from './TransitionManager';

const { ccclass } = _decorator;

@ccclass('EnterBattleButton')
export class EnterBattleButton extends Component {
    public async onClickEnterBattle() {
        await TransitionManager.instance.gotoScene(
            'BattleScene',
            [
                {
                    bundleName: 'battle-remote',
                    prefabPaths: [
                        'prefabs/BattleRoot',
                        'prefabs/BattleHUD',
                        'prefabs/BattlePausePanel',
                    ],
                },
            ],
            {
                preparing: '正在集结战斗资源',
                downloading: '正在加载战斗资源',
                entering: '正在进入战斗',
                failed: '战斗资源加载失败，请稍后重试',
            },
        );
    }
}
```

适合：
- 不同玩法想显示不同语气的提示文本
- 同一个场景名，但不同入口想展示不同提示
- 活动服、剧情服、教学关卡等特殊跳转

## 3. 直接通过 UIManager 打开 TransitionScreen

如果你不想再包一层业务管理器，也可以直接调用统一弹窗入口。

```ts
import { _decorator, Component } from 'cc';
import { UIManager, UIPanelId } from '../UIManager';

const { ccclass } = _decorator;

@ccclass('GoToStoryButton')
export class GoToStoryButton extends Component {
    public async onClickGoToStory() {
        await UIManager.instance.openPopup(UIPanelId.TransitionScreen, {
            sceneName: 'StoryScene',
            bundles: [
                {
                    bundleName: 'story-remote',
                    prefabPaths: [
                        'prefabs/StoryRoot',
                        'prefabs/StoryDialogPanel',
                    ],
                },
            ],
            tips: {
                preparing: '正在准备剧情资源',
                downloading: '正在加载剧情资源',
                entering: '正在进入剧情',
                failed: '剧情资源加载失败，请稍后重试',
            },
        });
    }
}
```

## 4. 手动给 RemoteSceneLoader 注入动态任务

如果 `RemoteSceneLoader` 挂在某个固定节点上，也可以直接手动初始化任务。

```ts
import { _decorator, Component } from 'cc';
import { RemoteSceneLoader } from './RemoteSceneLoader';

const { ccclass, property } = _decorator;

@ccclass('ManualTransitionEntry')
export class ManualTransitionEntry extends Component {
    @property(RemoteSceneLoader)
    public loader: RemoteSceneLoader | null = null;

    public async startBattle() {
        if (!this.loader) {
            return;
        }

        this.loader.initDynamicTask(
            'BattleScene',
            [
                {
                    bundleName: 'battle-remote',
                    prefabPaths: [
                        'prefabs/BattleRoot',
                        'prefabs/BattleHUD',
                    ],
                },
            ],
            {
                preparing: '正在准备战斗资源',
                downloading: '正在加载战斗资源',
                entering: '正在进入战斗',
            },
        );

        await this.loader.onClickLoadAndGo();
    }
}
```

## 5. 保留 Inspector 固定配置的旧模式

如果你已经在编辑器里把 `targetSceneName` 和 `bundleConfigs` 配好了，也可以继续保留旧模式。

```ts
import { _decorator, Component } from 'cc';
import { RemoteSceneLoader } from './RemoteSceneLoader';

const { ccclass, property } = _decorator;

@ccclass('StaticLoaderEntry')
export class StaticLoaderEntry extends Component {
    @property(RemoteSceneLoader)
    public loader: RemoteSceneLoader | null = null;

    public onClickLoad() {
        this.loader?.onClickLoadAndGo();
    }
}
```

说明：
- 旧模式下如果没有动态 `tips`，默认仍会根据 `targetSceneName` 推断提示文本。
- 推断规则内置支持 `BattleScene`、`StoryScene`、`HomeScene`、`LoginScene` 这类常见命名。

## 6. 使用 Persist Root Node 作为全局常驻遮罩

如果你不走 `UIManager`，可以把遮罩节点设为常驻根节点，确保 `director.loadScene()` 期间遮罩不会消失。

```ts
import {
    _decorator,
    Component,
    director,
    game,
    instantiate,
    Node,
    Prefab,
    ProgressBar,
    Label,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('PersistTransitionOverlay')
export class PersistTransitionOverlay extends Component {
    @property(Prefab)
    public overlayPrefab: Prefab | null = null;

    private _overlayNode: Node | null = null;
    private _progressBar: ProgressBar | null = null;
    private _progressLabel: Label | null = null;

    public ensureOverlay(): Node | null {
        if (this._overlayNode) {
            return this._overlayNode;
        }
        if (!this.overlayPrefab) {
            return null;
        }

        const node = instantiate(this.overlayPrefab);
        node.name = 'PersistTransitionOverlay';
        game.addPersistRootNode(node);

        this._overlayNode = node;
        this._progressBar = node.getComponentInChildren(ProgressBar);
        this._progressLabel = node.getComponentInChildren(Label);

        return node;
    }

    public show() {
        const node = this.ensureOverlay();
        if (!node) {
            return;
        }
        node.active = true;
        this.setProgress(0);
    }

    public setProgress(value: number) {
        const ratio = Math.max(0, Math.min(1, value));
        if (this._progressBar) {
            this._progressBar.progress = ratio;
        }
        if (this._progressLabel) {
            this._progressLabel.string = `${Math.floor(ratio * 100)}%`;
        }
    }

    public gotoScene(sceneName: string) {
        this.show();
        director.loadScene(sceneName, () => {
            if (this._overlayNode) {
                this._overlayNode.active = false;
            }
        });
    }
}
```

## 7. Home 进入 Battle 的推荐写法

这个例子对应当前项目最典型的链路，也最能体现 `cleanupBeforeLoad()` 的作用。

```ts
import { _decorator, Component } from 'cc';
import { TransitionManager } from './TransitionManager';

const { ccclass } = _decorator;

@ccclass('HomeEnterBattleFlow')
export class HomeEnterBattleFlow extends Component {
    public async enterBattle() {
        await TransitionManager.instance.gotoScene(
            'BattleScene',
            [
                {
                    bundleName: 'battle-remote',
                    prefabPaths: [
                        'prefabs/BattleRoot',
                        'prefabs/BattleHUD',
                        'prefabs/BattlePausePanel',
                    ],
                },
            ],
            {
                preparing: '正在准备战斗资源',
                downloading: '正在加载战斗资源',
                entering: '正在进入战斗',
                failed: '战斗资源加载失败，请稍后重试',
            },
        );
    }
}



比如进入战斗是一个按钮，这个按钮就直接挂载这个事件就行了吗
对，就是这个用法。

  但不要在编辑器里把这段长调用“直接当事件文本挂上去”，正确做法是：

  - 在按钮所在节点挂一个脚本组件
  - 给按钮 Click Events 绑定这个组件的一个公开方法
  - 在这个方法里调用 await TransitionManager.instance.gotoScene(...)

  推荐这样写：

  import { _decorator, Component } from 'cc';
  import { TransitionManager } from '../remote/TransitionManager';

  const { ccclass } = _decorator;

  @ccclass('EnterBattleButton')
  export class EnterBattleButton extends Component {
      public async onClickEnterBattle(): Promise<void> {
          await TransitionManager.instance.gotoScene(
              'BattleScene',
              [
                  {
                      bundleName: 'battle-remote',
                      prefabPaths: [
                          'prefabs/BattleRoot',
                          'prefabs/BattleHUD',
                          'prefabs/BattlePausePanel',
                      ],
                  },
              ],
              {
                  preparing: '正在准备战斗资源',
                  downloading: '正在加载战斗资源',
                  entering: '正在进入战斗',
                  failed: '战斗资源加载失败，请稍后重试',
              },
          );
      }
  }

  然后在 Cocos 编辑器里这样挂：

  - 按钮节点挂 EnterBattleButton
  - Button -> Click Events
  - 拖入这个节点
  - 选择 EnterBattleButton -> onClickEnterBattle
```

说明：
- `RemoteSceneLoader.cleanupBeforeLoad()` 会先清理旧场景残留的 bundle 缓存。
- 过渡遮罩层级必须足够高，才能盖住 Home 销毁和 Battle 初始化时的黑屏闪动。

## 8. TransitionScreen.prefab 节点结构与挂载

`TransitionScreen.prefab` 根节点应挂 `RemoteSceneLoader`，并至少绑定以下字段：

```text
TransitionScreen                    <- 挂 RemoteSceneLoader
└── LoadingMask                     <- 绑定 loadingMask
    └── CenterPanel
        ├── TipLabel                <- 绑定 tipLabel
        ├── ProgressBar             <- 绑定 progressBar
        └── ProgressLabel           <- 绑定 progressLabel
```

推荐要求：
- `TransitionScreen` 根节点挂 `RemoteSceneLoader`
- `LoadingMask` 全屏铺满
- `TransitionScreen` 层级高于普通 UI 和对话框
- `TipLabel` 默认显示由 `RemoteSceneLoader` 动态写入，不要在 prefab 上依赖固定文案
