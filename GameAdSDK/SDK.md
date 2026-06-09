# GameAdSDK V1 接入文档

## 1. 定位

`GameAdSDK` 是一套通用 Cocos Creator 广告接入层，目标是让任意 IAA 游戏都可以用同一套方式接入广告。

V1 不绑定任何具体游戏项目，也不内置具体项目的广告文案规则。

业务层只关心三件事：

- 初始化时配置平台广告 ID。
- 播放广告时传业务广告点 `placement`。
- 根据返回值判断是否发放奖励。

## 2. 可以直接给外部逻辑调用吗

可以。

游戏启动时先初始化一次：

```ts
GameAd.init(config);
```

之后任意业务逻辑都可以直接调用：

```ts
const ret = await GameAd.showReward("revive");
if (ret.rewarded) {
    // 发放奖励
}
```

判断是否发奖只看 `ret.rewarded`。

不要用 Promise 成功、`ok`、`shown` 作为发奖条件。

## 3. 推荐目录

建议放在：

```text
assets/Script/GameAdSDK/
```

业务代码导入时按实际目录层级调整：

```ts
import { GameAd } from "../GameAdSDK";
```

或：

```ts
import { GameAd } from "../../GameAdSDK";
```

## 4. 初始化放在哪里

必须在第一次播放广告前初始化。

推荐放在：

- 游戏启动入口
- 全局管理器初始化
- 登录完成后进入大厅前
- 第一个主场景的 `onLoad`

不要在每个广告按钮点击时重复初始化。

## 5. 没有广告 ID 时怎么学习

个人学习或编辑器预览时，使用 Mock 模式。

Mock 模式不需要真实广告 ID，可以练习完整的广告调用、回调、发奖、暂无广告、超时和重复点击逻辑。

```ts
import { GameAd } from "./GameAdSDK";

GameAd.init({
    platform: "mock",
    debug: true,
    rewardTimeoutMs: 15000,
    mock: {
        rewardResult: "success",
        delayMs: 500,
    },
});
```

模拟完整观看：

```ts
mock: {
    rewardResult: "success",
}
```

模拟中途关闭：

```ts
mock: {
    rewardResult: "cancelled",
}
```

模拟暂无广告：

```ts
mock: {
    rewardResult: "no-fill",
}
```

模拟网络超时：

```ts
GameAd.init({
    platform: "mock",
    rewardTimeoutMs: 1000,
    mock: {
        rewardResult: "timeout",
        delayMs: 3000,
    },
});
```

## 6. 真实平台广告 ID 配置

上线或真机测试时，推荐使用 `platform: "auto"`。

SDK 会自动识别：

- 微信小游戏环境：走微信广告 API。
- 抖音小游戏环境：走抖音广告 API。
- 编辑器或普通浏览器：走 Mock。

```ts
import { GameAd } from "./GameAdSDK";

GameAd.init({
    platform: "auto",
    debug: false,
    rewardTimeoutMs: 15000,
    ids: {
        wechat: {
            reward: {
                revive: "微信激励视频广告位ID",
                daily_reward: "微信激励视频广告位ID",
                double_coin: "微信激励视频广告位ID",
                free_item: "微信激励视频广告位ID",
            },
            interstitial: {
                level_end: "微信插屏广告位ID",
                home_back: "微信插屏广告位ID",
            },
            banner: {
                home_bottom: "微信Banner广告位ID",
                shop_bottom: "微信Banner广告位ID",
            },
        },
        douyin: {
            reward: {
                revive: "抖音激励视频广告位ID",
                daily_reward: "抖音激励视频广告位ID",
                double_coin: "抖音激励视频广告位ID",
                free_item: "抖音激励视频广告位ID",
            },
            interstitial: {
                level_end: "抖音插屏广告位ID",
                home_back: "抖音插屏广告位ID",
            },
            banner: {
                home_bottom: "抖音Banner广告位ID",
                shop_bottom: "抖音Banner广告位ID",
            },
        },
    },
});
```

配置规则：

| 配置 | 含义 |
| --- | --- |
| `ids.wechat.reward.revive` | 微信平台复活激励视频广告 ID |
| `ids.douyin.reward.revive` | 抖音平台复活激励视频广告 ID |
| `ids.wechat.interstitial.level_end` | 微信平台结算插屏广告 ID |
| `ids.douyin.banner.home_bottom` | 抖音平台首页 Banner 广告 ID |

`revive`、`daily_reward`、`double_coin` 这些叫 `placement`，代表业务广告点。

真实平台广告 ID 只写在初始化配置里，业务调用时不要直接传真实广告 ID。

## 7. 推荐 placement 命名

`placement` 应该表达业务场景，不应该表达平台或广告 ID。

推荐命名：

| 场景 | 推荐 placement |
| --- | --- |
| 看广告复活 | `revive` |
| 每日免费奖励 | `daily_reward` |
| 双倍金币 | `double_coin` |
| 免费道具 | `free_item` |
| 跳过等待 | `skip_wait` |
| 离线收益翻倍 | `offline_double` |
| 关卡结束插屏 | `level_end` |
| 首页底部 Banner | `home_bottom` |
| 商店底部 Banner | `shop_bottom` |

新增广告点时，只需要新增一个 placement，并在 `GameAd.init` 的 `ids` 中填写对应平台广告 ID。

## 8. 激励视频调用

### async/await 写法

```ts
const ret = await GameAd.showReward("revive");

if (ret.rewarded) {
    this.revivePlayer();
    return;
}

this.showToast(ret.userMessage || "广告暂不可用，请稍后再试");
```

### 回调写法

```ts
GameAd.showReward("double_coin", (ret) => {
    if (ret.rewarded) {
        this.addCoin(baseCoin);
        return;
    }

    this.showToast(ret.userMessage || "广告暂不可用，请稍后再试");
});
```

### 旧数字状态写法

如果项目里已有很多 `st == 1` 的旧判断，可以临时使用兼容接口：

```ts
GameAd.showRewardLegacy("daily_reward", (st, ret) => {
    if (st == 1) {
        this.giveDailyReward();
        return;
    }

    this.showToast(ret?.userMessage || "广告暂不可用，请稍后再试");
});
```

状态含义：

| st | 含义 |
| --- | --- |
| `1` | 完整观看，可以发奖 |
| `2` | 用户中途关闭，不发奖 |
| `0` | 其他失败，不发奖 |

## 9. 插屏广告调用

插屏不发奖励，失败也不应该阻断业务流程。

```ts
const ret = await GameAd.showInterstitial("level_end");
if (!ret.ok) {
    console.log("插屏未展示", ret.reason, ret.userMessage);
}
```

默认频控：

| 规则 | 默认值 |
| --- | --- |
| 启动后多久内不展示插屏 | 30 秒 |
| 两次插屏最小间隔 | 60 秒 |
| 激励视频结束后多久内不展示插屏 | 60 秒 |

初始化时可以调整：

```ts
GameAd.init({
    platform: "auto",
    interstitial: {
        launchDelayMs: 30000,
        intervalMs: 60000,
        afterRewardMs: 60000,
    },
});
```

## 10. Banner 广告调用

展示：

```ts
await GameAd.showBanner("home_bottom", {
    position: "bottom-center",
    widthRatio: 0.8,
});
```

隐藏：

```ts
GameAd.hideBanner();
```

销毁：

```ts
GameAd.destroyBanner();
```

建议：

- 首页、商店、离线收益页可以展示 Banner。
- 战斗、拖拽、合成、点击压力大的页面不要长期展示 Banner。
- 离开页面时调用 `hideBanner` 或 `destroyBanner`。

## 11. 暂无广告处理

平台无填充、广告 ID 没配、平台不支持、网络超时，都会返回不发奖结果。

业务统一处理：

```ts
const ret = await GameAd.showReward("free_item");
if (!ret.rewarded) {
    this.showToast(ret.userMessage || "暂无广告，请稍后再试");
    return;
}

this.giveItem();
```

常见失败原因：

| reason | 说明 | 默认提示 |
| --- | --- | --- |
| `unavailable` | 暂无广告填充 | 暂无广告，请稍后再试 |
| `config-missing` | 没有配置广告 ID | 广告配置未完成 |
| `platform-unsupported` | 当前平台不支持该广告 | 当前平台暂不支持广告 |
| `timeout` | 广告加载超时 | 广告加载超时，请稍后再试 |
| `cancelled` | 用户中途关闭 | 观看完整广告后才能获得奖励 |
| `busy` | 重复点击或已有广告请求 | 广告正在加载中，请勿重复点击 |

## 12. 网络卡顿重复点击处理

SDK 内置激励视频全局锁。

从调用 `GameAd.showReward` 开始，到广告成功、失败、取消或超时之前，再次调用会直接返回：

```ts
{
    rewarded: false,
    reason: "busy",
    userMessage: "广告正在加载中，请勿重复点击"
}
```

业务层可以不用再写复杂并发锁，但推荐按钮层仍然临时禁用，玩家反馈会更清楚：

```ts
this.adButton.interactable = false;

const ret = await GameAd.showReward("double_coin");

this.adButton.interactable = true;

if (ret.rewarded) {
    this.addCoin(baseCoin);
} else {
    this.showToast(ret.userMessage || "广告暂不可用，请稍后再试");
}
```

## 13. 旧项目迁移配置

如果某个游戏已经有旧广告系统，可以用通用桥接模式临时接入。

注意：这是通用桥接，不绑定任何具体旧 SDK。

```ts
GameAd.init({
    platform: "legacy-bridge",
    debug: true,
    rewardTimeoutMs: 15000,
    legacyBridge: {
        showRewardedAd: (placement, cb) => {
            OldAdSdk.showRewardedAd(placement, cb);
        },
    },
});
```

如果旧项目传入的是中文文案或旧事件名，可以显式配置别名映射：

```ts
GameAd.init({
    platform: "auto",
    placementAliasMap: {
        "看广告复活": "revive",
        "领取每日奖励": "daily_reward",
        "双倍金币": "double_coin",
    },
    ids: {
        wechat: {
            reward: {
                revive: "微信广告位ID",
                daily_reward: "微信广告位ID",
                double_coin: "微信广告位ID",
            },
        },
    },
});
```

SDK 默认不会自动识别任何具体游戏的中文广告文案，必须由项目自己配置 `placementAliasMap`。

## 14. 返回值说明

激励视频返回：

```ts
{
    ok: boolean;
    shown: boolean;
    rewarded: boolean;
    completed: boolean;
    placement: string;
    rawPlacement?: string;
    platform: string;
    reason?: string;
    userMessage?: string;
    errorCode?: string | number;
    errorMessage?: string;
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `rewarded` | 是否可以发奖，业务最重要字段 |
| `completed` | 是否完整观看，V1 中通常和 `rewarded` 一致 |
| `shown` | 广告是否真实展示过 |
| `placement` | 归一化后的广告点 |
| `rawPlacement` | 业务原始传入内容 |
| `reason` | 失败原因 |
| `userMessage` | 可以展示给玩家的中文提示 |
| `platform` | 当前实际使用的平台 |

## 15. 最小完整示例

启动时初始化：

```ts
import { GameAd } from "./GameAdSDK";

export function initAdSdk(): void {
    GameAd.init({
        platform: "mock",
        debug: true,
        mock: {
            rewardResult: "success",
            delayMs: 500,
        },
    });
}
```

按钮点击时调用：

```ts
public onClickRevive(): void {
    void this.watchAdForRevive();
}

private async watchAdForRevive(): Promise<void> {
    const ret = await GameAd.showReward("revive");

    if (!ret.rewarded) {
        this.showToast(ret.userMessage || "广告暂不可用，请稍后再试");
        return;
    }

    this.revivePlayer();
}
```

上线前替换真实广告 ID：

```ts
GameAd.init({
    platform: "auto",
    ids: {
        wechat: {
            reward: {
                revive: "填写微信后台的激励视频广告位ID",
            },
        },
        douyin: {
            reward: {
                revive: "填写抖音后台的激励视频广告位ID",
            },
        },
    },
});
```

## 16. 接入检查清单

- 已经把 `GameAdSDK` 放到 `assets/Script/GameAdSDK/`。
- 游戏启动阶段已经调用一次 `GameAd.init`。
- 学习或编辑器预览使用 `platform: "mock"`。
- 真机真实平台测试使用 `platform: "auto"` 并填写广告 ID。
- 外部业务调用 `GameAd.showReward(placement)`。
- 业务只用 `ret.rewarded` 判断是否发奖。
- 失败时展示 `ret.userMessage`。
- 不在按钮逻辑里直接创建微信或抖音广告对象。
- 不在业务代码里直接写平台广告 ID。
- 离开 Banner 页面时调用 `hideBanner` 或 `destroyBanner`。
