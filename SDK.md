# 通用广告 SDK V1 方案

## 1. 目标

V1 要实现一套可以直接接入任意 Cocos Creator 游戏的广告 SDK。

核心目标：

- 业务层只调用统一 API。
- 平台广告 ID 只在初始化配置里填写。
- 微信、抖音、Mock 通过 Adapter 隔离。
- 激励视频只在完整观看后发放奖励。
- 暂无广告、网络超时、重复点击都有统一处理。
- SDK 不绑定任何具体游戏项目，也不内置具体游戏的广告文案规则。

## 2. 对外调用方式

业务层只依赖：

```ts
import { GameAd } from "./GameAdSDK";
```

初始化一次：

```ts
GameAd.init(config);
```

播放激励视频：

```ts
const ret = await GameAd.showReward("revive");

if (ret.rewarded) {
    // 发放奖励
} else {
    this.showToast(ret.userMessage);
}
```

判断是否发奖只看：

```ts
ret.rewarded
```

不要用 Promise 成功、`ok`、`shown` 作为发奖条件。

## 3. 目录结构

```text
assets/Script/GameAdSDK/
├── GameAd.ts
├── GameAdTypes.ts
├── GameAdConfig.ts
├── index.ts
├── SDK.md
├── adapters/
│   ├── IAdAdapter.ts
│   ├── WechatAdAdapter.ts
│   ├── DouyinAdAdapter.ts
│   ├── MockAdAdapter.ts
│   └── LegacyBridgeAdAdapter.ts
└── core/
    ├── AdPlatformDetector.ts
    ├── AdFrequencyGuard.ts
    ├── AdLogger.ts
    └── AdResultFactory.ts
```

## 4. API 设计

V1 对外只暴露以下能力：

```ts
GameAd.init(config);
GameAd.showReward(placement, cb?);
GameAd.showRewardLegacy(placement, cb);
GameAd.showInterstitial(placement);
GameAd.showBanner(placement, options?);
GameAd.hideBanner();
GameAd.destroyBanner();
GameAd.getPlatform();
```

业务层不能直接依赖微信、抖音或某个旧广告 SDK。

## 5. placement 规则

`placement` 是业务广告点，不是平台广告 ID。

推荐命名：

| 场景 | placement |
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

要求：

- 小写英文。
- 使用 `_` 分隔。
- 同一广告点在所有平台使用同一个 placement。
- 不要把 UI 文案、埋点名、平台广告 ID 当 placement。

## 6. 广告 ID 配置

真实平台初始化示例：

```ts
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
            },
            interstitial: {
                level_end: "微信插屏广告位ID",
            },
            banner: {
                home_bottom: "微信Banner广告位ID",
            },
        },
        douyin: {
            reward: {
                revive: "抖音激励视频广告位ID",
                daily_reward: "抖音激励视频广告位ID",
                double_coin: "抖音激励视频广告位ID",
            },
            interstitial: {
                level_end: "抖音插屏广告位ID",
            },
            banner: {
                home_bottom: "抖音Banner广告位ID",
            },
        },
    },
});
```

配置原则：

- 业务代码只传 `placement`。
- 平台广告 ID 只写在 `ids` 中。
- 新增广告点时，只新增 placement 和对应平台 ID。

## 7. Mock 学习模式

没有广告 ID 时使用 Mock：

```ts
GameAd.init({
    platform: "mock",
    debug: true,
    mock: {
        rewardResult: "success",
        delayMs: 500,
    },
});
```

可模拟：

| mock.rewardResult | 含义 |
| --- | --- |
| `success` | 完整观看 |
| `cancelled` | 中途关闭 |
| `no-fill` | 暂无广告 |
| `timeout` | 网络超时 |
| `platform-error` | 平台错误 |

这样个人没有广告 ID 时，也能完整练习广告 SDK 的接入流程。

## 8. 统一返回值

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

失败原因：

| reason | 含义 |
| --- | --- |
| `busy` | 重复点击或已有广告请求 |
| `cooldown` | 频控中 |
| `unavailable` | 暂无广告 |
| `config-missing` | 广告 ID 未配置 |
| `platform-unsupported` | 当前平台不支持 |
| `adunit-empty` | 广告位为空 |
| `no-fill` | 平台无填充 |
| `frequency-limit` | 平台请求频率限制 |
| `cancelled` | 用户中途关闭 |
| `timeout` | 广告加载超时 |
| `platform-error` | 平台 API 错误 |

## 9. 暂无广告处理

业务统一写法：

```ts
const ret = await GameAd.showReward("free_item");

if (!ret.rewarded) {
    this.showToast(ret.userMessage || "暂无广告，请稍后再试");
    return;
}

this.giveItem();
```

SDK 内部会把平台无填充、广告位缺失、平台不支持等情况整理成业务可读结果。

## 10. 网络卡顿重复点击处理

激励视频从进入 `GameAd.showReward` 开始就会上锁。

广告请求未结束前，再次点击会返回：

```ts
{
    rewarded: false,
    reason: "busy",
    userMessage: "广告正在加载中，请勿重复点击"
}
```

SDK 负责防并发，业务 UI 推荐同时禁用按钮，提升玩家反馈。

## 11. 平台适配策略

### 微信

- 使用 `wx.createRewardedVideoAd`。
- `onClose(res)` 中只有 `res.isEnded === true` 才发奖。
- `show` 失败时尝试 `load` 后再 `show`。
- 错误码统一映射为 SDK 的 `reason`。

### 抖音

- 使用 `tt.createRewardedVideoAd`。
- `onClose(res)` 中只有 `res.isEnded === true` 才发奖。
- 高频限制映射为 `frequency-limit`。
- `count` 等平台原始信息透传到 `raw`。

### Mock

- 用于编辑器、浏览器、没有广告 ID 的学习阶段。
- 不依赖任何平台 API。
- 可模拟成功、失败、无广告、超时。

### Legacy Bridge

- 只作为旧项目迁移桥接。
- 名称是通用 `legacy-bridge`，不绑定某个旧 SDK。
- 新项目可以不使用。

## 12. Banner 方案

接口：

```ts
await GameAd.showBanner("home_bottom", {
    position: "bottom-center",
    widthRatio: 0.8,
});

GameAd.hideBanner();
GameAd.destroyBanner();
```

规则：

- 每个平台只保留一个当前 Banner 实例。
- 首页、商店、离线奖励页可以展示。
- 强操作页面不建议长期展示。
- 离开页面时隐藏或销毁。

## 13. 插屏方案

接口：

```ts
await GameAd.showInterstitial("level_end");
```

规则：

- 插屏不发奖励。
- 插屏失败不阻断业务流程。
- 只在自然断点展示。
- 默认启动后 30 秒内不展示。
- 默认两次插屏至少间隔 60 秒。
- 默认激励视频结束后 60 秒内不展示插屏。

## 14. V1 不做的内容

V1 先不做：

- 原生模板广告。
- 格子广告。
- 互推广告。
- 服务端动态下发广告 ID。
- 广告收益埋点闭环。
- A/B 测试策略。

这些适合放到 V2。

## 15. V1 验收标准

激励视频：

- 完整观看后只发奖一次。
- 中途关闭不发奖。
- 快速连点只创建一个广告请求。
- 暂无广告时不发奖，并返回 `userMessage`。
- 网络超时时释放点击锁。
- 微信和抖音真机都按 `isEnded === true` 判断发奖。

Banner：

- 展示、隐藏、销毁都能正常调用。
- 重复展示不会残留多个实例。
- 不遮挡核心操作区域。

插屏：

- 频控生效。
- 启动保护生效。
- 激励视频后冷却生效。
- 展示失败不影响业务继续执行。

## 16. 文档入口

具体初始化、调用、广告 ID 配置示例见：

```text
GameAdSDK/SDK.md
```
