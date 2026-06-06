# EconomyFacade 使用

## 目标

这份文档说明两件事：

1. 以后怎么把 `NetworkFacade` 接到 `GameFacade`
2. `EconomyFacade.spendCurrency()` 怎么真正触发 `ActionQueueService` 埋点

当前这次改动只完成了服务端对 `spend_currency` 的协议支持，`GameFacade` 代码暂时不动。

## 为什么不要让 EconomyFacade 直接依赖 NetworkFacade

`EconomyFacade` 是业务门面，职责是：

- 查询金币、钻石、体力等货币
- 扣费
- 加钱
- 通知本地 UI 刷新

如果它直接依赖 `NetworkFacade`，就会把本地经济逻辑和登录、HTTP、离线队列、存储强耦合在一起。后面不方便测试，也不方便替换网络实现。

更稳的方式是：

- `EconomyFacade` 只依赖一个很薄的“动作上报接口”
- 这个接口背后再由 `NetworkFacade` 去调用 `ActionQueueService`

## 推荐注入结构

先定义一个很薄的动作上报接口，例如：

```ts
export interface IActionReporter {
    enqueueAction(actionType: string, payload: Record<string, unknown>): void;
    syncPendingActions?(): Promise<unknown>;
}
```

然后把 `EconomyFacade` 改成可选注入：

```ts
export class EconomyFacade {
    constructor(
        private readonly actionReporter?: IActionReporter,
    ) {
        ...
    }
}
```

这样 `EconomyFacade` 本身不知道 HTTP，也不知道 token，它只负责：

- 本地扣钱成功
- 通知外部“这里发生了一条业务动作”

## 后续 GameFacade 该怎么接

后面真正改 `GameFacade` 时，推荐由它负责组装依赖。

思路如下：

```ts
import { NetworkFacade } from '../network/facade/NetworkFacade';

const economyActionReporter = {
    enqueueAction: (actionType: string, payload: Record<string, unknown>) => {
        NetworkFacade.instance.enqueueAction(actionType, payload);
    },
    syncPendingActions: async () => {
        await NetworkFacade.instance.syncPendingActions();
    },
};

this.economy = new EconomyFacade(economyActionReporter);
```

这样 `GameFacade` 是装配层，`EconomyFacade` 还是纯业务层。

## spendCurrency 的埋点位置

埋点必须放在“本地扣费成功之后”。

错误顺序：

```ts
pushAction(...)
changeBalance(...)
```

这样会出现本地扣费失败，但动作已经进队列的问题。

正确顺序：

```ts
const changed = Economy.currency.changeBalance(type, -amount, reason);
if (!changed) {
    return false;
}

this.actionReporter?.enqueueAction(ActionType.SPEND_CURRENCY, {
    currencyId: type,
    amount,
    reason,
});

void this.actionReporter?.syncPendingActions?.();
return true;
```

这里的关键点是：

- 先扣本地
- 扣成功再入离线队列
- 是否立刻调用 `syncPendingActions()` 可以按项目策略决定

如果你想更保守，也可以只 `enqueueAction()`，把真正提交留给统一时机处理。

## 为什么这里要走 ActionQueueService

当前项目里，真正已经跑通的弱联网动作提交通道是：

`NetworkFacade.enqueueAction()` -> `ActionQueueService.enqueue()` -> `NetworkFacade.syncPendingActions()` -> `POST /api/actions/submit`

所以 `EconomyFacade` 的花金币埋点，应该接这条链，而不是直接接 HTTP。

## 服务端这次已经支持的 actionType

这次已经在服务端补了 `spend_currency`：

- 加入 `allowedActionTypes`
- 加入动作类型白名单
- 加入 payload 校验

现在服务端接受的最小请求体形状是：

```json
{
  "actionId": "user_001-12",
  "seqNo": 12,
  "actionType": "spend_currency",
  "payload": {
    "currencyId": "gold",
    "amount": 100,
    "reason": "shop_buy"
  },
  "createdAt": 1710000000000,
  "clientVersion": "0.1.0-dev",
  "protocolVersion": 1,
  "status": "pending"
}
```

## spend_currency 的服务端规则

服务端目前会校验：

- `currencyId` 必须有值
- `amount` 必须大于 `0`
- `reason` 可选

注意：

- `spend_currency` 当前不会生成 `pending_verify` 资产
- 它只是作为一条“消费动作记录”被服务端接收
- 如果以后要做服务端账本校验，再在服务端扩展消费核账逻辑

## 最小接入步骤

后续你真正开始改客户端时，按这个顺序做最稳：

1. 在 `EconomyFacade` 增加 `IActionReporter` 可选注入
2. 在 `spendCurrency()` 成功后调用 `enqueueAction(ActionType.SPEND_CURRENCY, payload)`
3. 在 `GameFacade` 构造 `EconomyFacade` 时传入基于 `NetworkFacade.instance` 的 reporter
4. 登录成功后确保 `NetworkFacade` 已经持有有效 token
5. 调用 `syncPendingActions()` 或由统一调度器批量提交

## 推荐 payload

推荐最小 payload：

```ts
{
    currencyId: type,
    amount,
    reason,
}
```

如果后面需要更强的服务端审计，可以继续扩展：

```ts
{
    currencyId: type,
    amount,
    reason,
    source: 'shop',
    sourceId: 'shop_item_001',
    scene: 'home_shop'
}
```

## 一条完整调用链示例

以“商店购买消耗 100 金币”为例：

1. UI 点击购买按钮
2. `GameFacade.shop` 调用 `EconomyFacade.spendCurrency(CurrencyType.Gold, 100, 'shop_buy')`
3. `EconomyFacade` 本地扣费成功
4. `EconomyFacade` 通过注入的 reporter 调用 `NetworkFacade.enqueueAction('spend_currency', payload)`
5. `ActionQueueService` 把动作写入本地离线队列
6. 网络可用时调用 `syncPendingActions()`
7. 客户端 `POST /api/actions/submit`
8. 服务端校验通过，返回 `accepted`
9. 客户端移除已确认动作

## 当前状态

当前仓库状态是：

- 服务端已经支持 `spend_currency`
- `GameFacade` 还没有注入 `NetworkFacade`
- `EconomyFacade` 还没有真正调用 `enqueueAction()`

也就是说，协议基础已经准备好，下一步就是改客户端装配和埋点。
