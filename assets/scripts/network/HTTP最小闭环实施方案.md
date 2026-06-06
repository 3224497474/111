# HTTP 最小闭环实施方案

本文档基于 [联网.md](F:\BaiduNetdiskDownload\COCOS\cocswechat-main\联网.md) 的方向，进一步收敛成一套可从 0 开始、最小测试跑通的实施步骤。

目标不是一次性做完整联网系统，而是先做一个最小闭环，验证这条主技术路线成立：

- 客户端可离线记录操作
- 客户端恢复联网后可通过 HTTP 批量补交
- 服务端可鉴权、去重、接收并确认
- 客户端可清理已确认的本地待提交记录

这套最小闭环跑通后，再继续扩展排行榜、交易、挑战令牌、WSS 推送、Protobuf 等后续能力。

## 一、技术结论

当前项目优先采用：

- 主协议：`HTTPS`
- 主交互模型：`Request / Response`
- 主数据形态：前期 `JSON`
- 主离线补交方式：本地 `Action Queue` + 批量 HTTP 提交

当前阶段明确不做：

- 不做原生 TCP / UDP / KCP
- 不做完整 WebSocket 主链
- 不做排行榜强校验
- 不做交易系统
- 不做挑战令牌
- 不做 Protobuf
- 不做完整自动同步体系

原因很简单：

- 先验证“断网记录 + 恢复补交”这条核心路线
- 先减少联调面和排错面
- 先把最关键的架构边界跑通

## 二、最小闭环的目标

第一阶段只需要证明下面这条链路可用：

```text
客户端登录
    -> 本地记录一条待提交动作
    -> 客户端调用 HTTP 批量提交接口
    -> 服务端鉴权并按 actionId 去重
    -> 服务端返回 accepted / rejected
    -> 客户端移除已确认动作
```

只要这条链路通了，就说明：

- `HTTP` 适合当前项目
- `Action Queue` 方案可行
- 本地离线再补交的设计是能落地的

## 三、第一阶段的范围边界

### 3.1 本阶段只做这些

- `GET /api/health`
- `POST /api/auth/dev-login`
- `GET /api/auth/me`
- `POST /api/actions/submit`
- 客户端本地 action queue
- 客户端 token 持久化
- 客户端手动触发同步

### 3.2 本阶段不做这些

- 不做微信正式登录闭环
- 不做排行榜
- 不做邮件
- 不做交易
- 不做真正的战斗校验
- 不做自动重试
- 不做自动退避
- 不做自动心跳
- 不做 WSS
- 不做多端冲突合并

## 四、为什么先做 dev-login

当前仓库服务端已有微信登录基础，但本地最小联调如果直接依赖微信环境，会显著增加调试成本。

所以第一阶段建议新增一个只用于开发环境的登录接口：

- `POST /api/auth/dev-login`

用途：

- 本地开发直接拿 token
- 不依赖微信 `code`
- 不依赖小游戏正式环境
- 方便先把 HTTP + 队列 + 补交链路跑通

注意：

- `dev-login` 只用于本地开发或测试环境
- 后续正式环境可关掉

## 五、最小架构拆分

第一阶段客户端建议只创建下面这些文件：

```text
assets/scripts/network/
  NetworkConfig.ts
  protocol/
    Types.ts
  storage/
    NetworkKV.ts
  http/
    HttpClient.ts
  auth/
    AuthService.ts
  sync/
    ActionQueueService.ts
  facade/
    NetworkFacade.ts
```

### 5.1 `NetworkConfig.ts`

职责：

- 维护 `baseUrl`
- 维护 `timeoutMs`
- 维护 `protocolVersion`
- 维护开发环境开关

建议最小字段：

```ts
export const NetworkConfig = {
    baseUrl: 'http://127.0.0.1:8080',
    timeoutMs: 10000,
    protocolVersion: 1,
    enableDevLogin: true,
};
```

### 5.2 `protocol/Types.ts`

职责：

- 定义最小请求体和响应体
- 定义本地队列结构

建议最小类型：

```ts
export interface ILoginResult {
    uid: string;
    token: string;
}

export interface IQueuedAction {
    actionId: string;
    seqNo: number;
    actionType: string;
    payload: Record<string, unknown>;
    createdAt: number;
    clientVersion: string;
    protocolVersion: number;
    status: 'pending' | 'submitting';
}

export interface IActionSubmitRequest {
    actions: IQueuedAction[];
}

export interface IActionSubmitResult {
    actionId: string;
    seqNo: number;
    status: 'accepted' | 'rejected' | 'duplicate';
    reason?: string;
}
```

### 5.3 `storage/NetworkKV.ts`

职责：

- 保存 token
- 保存 uid
- 保存本地 action queue
- 不承担游戏总存档职责

建议最小键：

- `network_auth_token`
- `network_auth_uid`
- `network_action_queue`
- `network_action_seq`

### 5.4 `http/HttpClient.ts`

职责：

- 封装 `GET / POST`
- 自动注入 token
- 统一 JSON 请求
- 统一错误处理

这一层只做传输，不做业务。

### 5.5 `auth/AuthService.ts`

职责：

- `devLogin()`
- `restoreSession()`
- `getMe()`
- 管理登录态

### 5.6 `sync/ActionQueueService.ts`

职责：

- 入队
- 读取待提交列表
- 调用批量提交接口
- 删除已确认动作
- 保留失败动作

### 5.7 `facade/NetworkFacade.ts`

职责：

- 作为对外统一入口
- 聚合 `AuthService + ActionQueueService + HttpClient`

对外建议只暴露：

- `init()`
- `devLogin()`
- `enqueueAction()`
- `syncPendingActions()`
- `getQueueSnapshot()`
- `getAuthSnapshot()`

## 六、服务端最小实现

建议基于当前已有服务端目录继续补，而不是另起一套新服务：

- [server/src/index.js](F:\BaiduNetdiskDownload\COCOS\cocswechat-main\server\src\index.js)

当前这个服务端已经有：

- `GET /api/health`
- `POST /api/auth/wechat-login`
- `GET /api/auth/me`

所以第一阶段只需要再补两个最小能力：

1. `POST /api/auth/dev-login`
2. `POST /api/actions/submit`

### 6.1 `POST /api/auth/dev-login`

用途：

- 本地生成一个开发用 token
- 返回 `uid/token`

建议请求体：

```json
{
  "devUserId": "test_user_001"
}
```

建议响应体：

```json
{
  "success": true,
  "data": {
    "uid": "test_user_001",
    "token": "jwt_token"
  }
}
```

### 6.2 `POST /api/actions/submit`

用途：

- 接收客户端积压的动作队列
- 校验 token
- 校验 actionType
- 按 `actionId` 去重
- 返回每条动作的处理结果

建议请求体：

```json
{
  "actions": [
    {
      "actionId": "test_user_001-1",
      "seqNo": 1,
      "actionType": "debug_ping",
      "payload": {
        "value": 1
      },
      "createdAt": 1710000000000,
      "clientVersion": "0.1.0",
      "protocolVersion": 1,
      "status": "pending"
    }
  ]
}
```

建议响应体：

```json
{
  "success": true,
  "data": {
    "accepted": [
      {
        "actionId": "test_user_001-1",
        "seqNo": 1,
        "status": "accepted"
      }
    ],
    "rejected": []
  }
}
```

## 七、服务端最小校验规则

第一阶段不要一开始上复杂风控，只做最基础的 4 条：

1. 请求必须带有效 token
2. `actions` 必须是数组
3. `actionType` 必须在允许列表内
4. `actionId` 已处理过时不能重复入账

建议第一阶段允许的动作白名单只有这两个：

- `debug_ping`
- `debug_add_gold`

原因：

- 先验证链路
- 不先卷真实业务规则
- 方便观察服务端是否正确去重

## 八、服务端最小存储方案

第一阶段不建议接数据库，直接用文件存储就够。

建议在 `server/data/` 下增加：

- `actions-log.json`
- `action-state.json`

含义：

- `actions-log.json`
  - 保存每次提交的原始动作记录
  - 用于调试和回溯
- `action-state.json`
  - 保存已处理过的 `actionId`
  - 用于幂等和去重

第一阶段重点不是存储性能，而是先验证协议和行为是否正确。

## 九、客户端最小数据结构

### 9.1 登录态

建议最小结构：

```ts
export interface IAuthSnapshot {
    uid: string | null;
    token: string | null;
}
```

### 9.2 本地动作队列

建议最小结构：

```ts
export interface IQueuedAction {
    actionId: string;
    seqNo: number;
    actionType: string;
    payload: Record<string, unknown>;
    createdAt: number;
    clientVersion: string;
    protocolVersion: number;
    status: 'pending' | 'submitting';
}
```

### 9.3 入队规则

客户端入队时要做的最小动作：

1. 从本地取出当前 `seqNo`
2. 生成新的 `seqNo`
3. 拼出 `actionId = uid + '-' + seqNo`
4. 写入本地 queue
5. 持久化 queue

## 十、推荐的最小目录落地顺序

从低耦合到高耦合，建议按下面顺序做。

### 第一步：补服务端接口

先在现有服务端上增加：

- `POST /api/auth/dev-login`
- `POST /api/actions/submit`

这样客户端联调有目标接口，不会出现“客户端先写完但没地方打”的问题。

### 第二步：写客户端基础配置与类型

先写：

- `NetworkConfig.ts`
- `protocol/Types.ts`

这是最稳定的一层，越早定下来越好。

### 第三步：写本地存储层

写：

- `storage/NetworkKV.ts`

最小能力：

- 读写 token
- 读写 uid
- 读写 queue
- 读写 seqNo

### 第四步：写 HTTP 基础层

写：

- `http/HttpClient.ts`

最小能力：

- `get`
- `post`
- token header 注入
- JSON 解析

### 第五步：写 Auth 层

写：

- `auth/AuthService.ts`

最小能力：

- `devLogin`
- `restoreSession`
- `getMe`

### 第六步：写 ActionQueueService

写：

- `sync/ActionQueueService.ts`

最小能力：

- `enqueue`
- `listPending`
- `submitPending`
- `removeAccepted`

### 第七步：写 NetworkFacade

写：

- `facade/NetworkFacade.ts`

作用：

- 让外部统一调用
- 不让 UI 直接依赖底层 `HttpClient`

### 第八步：做一个最小调试面板

建议做一个测试组件，挂在独立测试场景或调试按钮上。

最小只要 4 个按钮：

- `Health`
- `DevLogin`
- `AddAction`
- `SyncQueue`

最小只要 2 个显示区：

- 当前登录状态
- 当前本地队列内容

这样最适合第一阶段验证。

## 十一、最小测试用例

### 用例 1：服务可用

步骤：

1. 启动服务端
2. 客户端点击 `Health`

预期：

- 返回 `success: true`

### 用例 2：开发登录

步骤：

1. 客户端点击 `DevLogin`
2. 本地保存 token 和 uid

预期：

- 登录成功
- `getAuthSnapshot()` 能看到 `uid/token`

### 用例 3：本地入队

步骤：

1. 客户端点击 `AddAction`
2. 写入一条 `debug_ping`

预期：

- 本地 queue 长度变为 1
- 状态为 `pending`

### 用例 4：联网提交

步骤：

1. 客户端点击 `SyncQueue`

预期：

- 服务端接收到动作
- 返回 `accepted`
- 客户端移除该条动作
- queue 变为空

### 用例 5：重复提交去重

步骤：

1. 构造相同 `actionId`
2. 再次提交

预期：

- 服务端识别为重复
- 不重复处理
- 返回 `duplicate` 或等价结果

### 用例 6：断网补交

步骤：

1. 把客户端 `baseUrl` 改错，模拟网络失败
2. 连续入队 2 条动作
3. 点击 `SyncQueue`，请求失败
4. 把 `baseUrl` 改回正确
5. 再点 `SyncQueue`

预期：

- 失败时 queue 不丢
- 恢复后 2 条动作都能成功提交
- 成功后 queue 被清空

## 十二、最小启动方式

### 12.1 服务端启动

工作目录：

- [server](F:\BaiduNetdiskDownload\COCOS\cocswechat-main\server)

命令：

```bash
npm install
npm run dev
```

### 12.2 客户端配置

本地开发建议：

```ts
export const NetworkConfig = {
    baseUrl: 'http://127.0.0.1:8080',
    timeoutMs: 10000,
    protocolVersion: 1,
    enableDevLogin: true,
};
```

### 12.3 联调顺序

推荐严格按这个顺序联调：

1. `health`
2. `dev-login`
3. `enqueue`
4. `submit`
5. `duplicate`
6. `offline -> retry`

不要跳步骤。

## 十三、第一阶段完成标准

满足下面 5 条，就算第一阶段完成：

1. 服务端能正常启动并响应 `GET /api/health`
2. 客户端能通过 `dev-login` 获取并持久化 token
3. 客户端能把动作写入本地 queue
4. 网络失败时 queue 不丢
5. 网络恢复后能通过 `POST /api/actions/submit` 成功补交并清空已确认动作

## 十四、跑通后再做什么

最小闭环通过后，按下面顺序继续扩展最稳。

### 第二阶段

- 增加自动重试
- 增加退避策略
- 增加动作类型白名单管理
- 增加基础错误码
- 增加真实业务动作接入

### 第三阶段

- 接 `ProgressFacade` 的部分待验证动作
- 接低风险奖励的 `pending_verify`
- 增加服务端基础规则校验

### 第四阶段

- 增加挑战令牌
- 增加排行榜独立链路
- 增加高价值资产正式入账逻辑

### 第五阶段

- 引入 `WSS` 作为通知通道
- 只做红点、公告、状态推送
- 不让 `WSS` 成为核心业务阻断链路

### 第六阶段

- 评估 JSON -> Protobuf
- 只在链路稳定后再切

## 十五、最后的收口原则

这一阶段请始终坚持下面 4 条：

1. 先跑通 `HTTP + Action Queue`，不要先做完整联网系统
2. 先做开发登录，降低本地联调成本
3. 先用 JSON，先验证流程，再谈压缩和升级
4. `WSS` 以后只能做通知增强，不能替代 HTTP 主链

一句话总结：

```text
先用最少的接口、最少的状态、最少的动作类型，
把“离线记录 -> 联网补交 -> 服务端确认 -> 客户端清理”跑通。
```
