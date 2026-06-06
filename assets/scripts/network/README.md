# Network 模块设计文档

本文档用于定义当前项目未来的 `assets/scripts/network` 模块边界。
当前阶段只写文档，不重写代码，不切换现有调用。

## 1. 目标

把旧的 `assets/scripts/X/client/Script/easyFramework/network` 网络能力从旧客户端框架中解耦出来，后续逐步迁移到新的项目级目录：

```text
assets/scripts/network/
```

迁移后的网络层应满足：

- 不依赖 `X/client` 的 UI 基类和旧框架生命周期
- 不直接耦合旧 `gameStorage / uiManager / notifications / comm`
- 能独立支撑 HTTP、Socket、心跳、鉴权、服务器同步
- 能被 `app` 主链或其他业务模块直接调用
- 支持微信小游戏环境和普通 Web/Native 环境的差异处理

## 2. 当前旧网络层能力盘点

旧目录：

```text
assets/scripts/X/client/Script/easyFramework/network/
```

当前包含以下能力：

### 2.1 配置与协议

文件：`conf.ts`

职责：

- 定义 HTTP / WebSocket 地址
- 定义服务器功能开关 `GameServerConfig`
- 定义网络命令码 `GNetCmd`
- 定义通用网络常量 `GNetConst`
- 定义网络事件名 `GEvent`

### 2.2 HTTP 请求层

文件：`HttpManager.ts`

职责：

- 统一 GET / POST / PUT 请求
- 维护认证 Token
- 微信小游戏环境优先走 `wx.cloud.callContainer`
- 其他环境回退到 `fetch` 或 `XMLHttpRequest`
- 提供服务健康检查、登录、注册、排行榜、资源更新等 REST 接口

### 2.3 微信鉴权层

文件：`WechatAuthManager.ts`

职责：

- 管理微信登录态
- 读写本地 `auth_uid / auth_token / auth_openid`
- 恢复本地 session
- 与 HTTP 服务协同做微信认证

### 2.4 数据同步层

文件：`GameDataSync.ts`

职责：

- 判断服务器功能是否启用
- 启动自动同步定时器
- 登录 / 注册后拉取远端数据
- 把本地数据同步到服务器
- 把服务器数据回写到本地存储
- 处理排行榜、资源等高层同步逻辑

### 2.5 WebSocket 通信层

文件：`WmSocketJSF.ts`

职责：

- 建立和维护 WebSocket 连接
- 发送、接收 Socket 消息
- 维护连接状态和最后心跳时间
- 处理粘包协议相关逻辑

### 2.6 Socket 心跳与批量操作层

文件：`CronCtrJSF.ts`

职责：

- 维护心跳
- 管理延迟上传、批量上传、批量删除
- 触发部分网络事件
- 依赖 Socket 与时间控制器

### 2.7 服务器总控入口

文件：`ServerCtrJSF.ts`

职责：

- 作为旧网络总入口
- 暴露登录、区域数据、云存档上传、批量写入等高层方法
- 串联 `WmSocketJSF / CronCtrJSF / TimeCtrJSF`
- 混合处理业务判断、网络请求、本地存储、UI 提示

### 2.8 服务器时间控制

文件：`TimeCtrJSF.ts`

职责：

- 管理服务器时间偏移
- 提供时间校准和比较
- 配合心跳更新时间

### 2.9 旧辅助层

文件：`http.ts`

职责：

- 历史 HTTP 辅助代码
- 当前价值需要在迁移时再确认

## 3. 当前旧网络层的主要问题

### 3.1 目录职责混乱

旧网络代码虽然在 `network/` 下，但实际强依赖大量非网络代码：

- `easyFramework/mgr/gameStorage.ts`
- `easyFramework/mgr/GameMemoryStorage.ts`
- `easyFramework/mgr/comm.ts`
- `easyFramework/mgr/uiManager.ts`
- `easyFramework/mgr/notifications.ts`
- `easyFramework/utils/UtilPub.ts`
- `config/Const.ts`
- `config/GD.ts`
- `config/global.ts`
- `game/comm/composeModel.ts`

说明当前网络层并不是纯网络层，而是“旧客户端框架中的服务器接入总线”。

### 3.2 业务逻辑与传输逻辑混杂

例如 `ServerCtrJSF.ts` 同时承担：

- 协议组包
- Socket 发送
- 登录状态维护
- 本地存储读写
- UI 交互提示
- 部分业务条件判断

这会导致后续任何网络改动都牵扯 UI、存档和业务状态。

### 3.3 环境适配分散

微信、Web、本地存储、云容器的差异分散在多个类里，后续迁移和测试成本高。

### 3.4 与当前 `app` 主链未统一

当前项目的主运行时入口已经转向：

- `GameFacade`
- `SaveCoordinator`
- `facades/*`

旧网络层还停留在 `easyFramework` 风格，未与新架构统一。

## 4. 新目录的目标边界

未来新网络层应收敛到：

```text
assets/scripts/network/
  README.md
  NetworkConfig.ts
  protocol/
    Commands.ts
    Events.ts
    Types.ts
  http/
    HttpClient.ts
    HttpApi.ts
  socket/
    SocketClient.ts
    HeartbeatService.ts
    SocketMessageBuffer.ts
  auth/
    AuthService.ts
    WechatAuthService.ts
  sync/
    GameSyncService.ts
  storage/
    NetworkKV.ts
  time/
    ServerTimeService.ts
  facade/
    NetworkFacade.ts
```

## 5. 新网络层建议职责拆分

### 5.1 `NetworkConfig.ts`

职责：

- 维护 `baseUrl`
- 维护 `wsUrl`
- 维护 `cloudEnv / cloudService`
- 维护功能开关
- 统一读取环境配置

### 5.2 `protocol/*`

职责：

- 命令码
- 事件名
- 协议体类型定义
- Socket 消息包结构定义

要求：

- 不包含业务逻辑
- 不包含存储逻辑

### 5.3 `http/HttpClient.ts`

职责：

- 封装 GET / POST / PUT / DELETE
- 统一 Header / Token / 错误处理
- 封装微信云容器与普通 HTTP 请求差异

要求：

- 只处理传输
- 不直接操作本地游戏数据

### 5.4 `socket/SocketClient.ts`

职责：

- 连接、重连、断开
- 发送原始消息
- 分发收到的消息
- 维护连接状态

### 5.5 `socket/HeartbeatService.ts`

职责：

- 心跳发送
- 超时检测
- 重连触发
- 配合服务器时间刷新

### 5.6 `auth/AuthService.ts`

职责：

- 普通登录、注册、登出
- Token 设置与恢复
- 统一登录态模型

### 5.7 `auth/WechatAuthService.ts`

职责：

- 微信登录
- session 恢复
- 本地 auth 缓存

### 5.8 `sync/GameSyncService.ts`

职责：

- 上传本地数据到服务器
- 拉取服务器数据到本地
- 自动同步定时器
- 同步状态和错误处理

要求：

- 不直接依赖旧 `GameStorage`
- 后续改成依赖新的 `storage/NetworkKV.ts` 或者注入式本地存储接口

### 5.9 `storage/NetworkKV.ts`

职责：

- 只管理网络域自己的本地键值
- 存登录态、Token、同步时间、服务器配置版本等
- 不承担整个游戏的总存档职责

### 5.10 `time/ServerTimeService.ts`

职责：

- 保存服务器时间偏移
- 提供统一的服务器当前时间
- 替代旧 `TimeCtrJSF.ts`

### 5.11 `facade/NetworkFacade.ts`

职责：

- 对外提供高层入口
- 聚合 `auth/http/socket/sync/time`
- 供 `app` 主链或启动流程使用

## 6. 迁移时必须保留的旧功能语义

未来重写时，以下语义需要保留：

- HTTP Token 注入
- 微信云容器优先请求
- 普通 HTTP 回退
- 服务器可用性检查
- 自动登录 / 自动同步
- WebSocket 连接和心跳
- 服务器时间校准
- 远端数据拉取到本地
- 本地数据上传到远端
- 微信鉴权 session 缓存

## 7. 新网络层明确不做的事

未来新目录下的网络层，不应直接承担这些职责：

- 直接控制弹窗 UI
- 直接操作 `uiManager`
- 直接依赖 `BaseView`
- 直接依赖剧情、战斗、首页业务对象
- 直接承担整个游戏存档系统
- 直接读写旧 `easyFramework` 的全局存储结构

如果需要提示 UI，建议通过事件、回调或 facade 输出状态，让上层处理。

## 8. 迁移建议顺序

当前阶段不重写，只给出后续实施顺序：

1. 先定义 `assets/scripts/network` 的协议类型与配置
2. 重写 HTTP 基础层
3. 重写 Auth 层
4. 重写 Socket 与 Heartbeat
5. 重写 Sync 层
6. 用新的 `NetworkFacade` 暴露统一入口
7. 把旧调用点逐步从 `X/client/.../network` 切到新目录
8. 等旧依赖清零后，再删除旧网络相关代码

## 9. 当前阶段的落地约束

本目录当前只包含文档，不包含任何实际实现。

也就是说：

- `assets/scripts/network` 现在是未来重构目标目录
- 现有运行逻辑仍然使用旧 `X/client/Script/easyFramework/network`
- 本文档用于后续迁移时对照，不影响当前功能

## 10. 后续重写时的第一批最小可用集合

如果后续开始真正落代码，建议第一批只做下面这些文件：

```text
assets/scripts/network/
  NetworkConfig.ts
  protocol/Commands.ts
  protocol/Types.ts
  http/HttpClient.ts
  auth/AuthService.ts
  storage/NetworkKV.ts
  facade/NetworkFacade.ts
```

先把 HTTP 登录、Token、基础配置和本地登录态跑通，再进入 Socket 和自动同步。
