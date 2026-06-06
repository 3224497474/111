# Network V2

这是一套与现有 `assets/scripts/network` 解耦的全新弱联网骨架。

目标：

- 明确传输层、动作层、同步层、状态层的职责边界
- 为后续接入 `EconomyFacade`、存档模块、玩法结算提供统一入口
- 支持乐观更新、离线入列、后台补交、失败退避、异常回滚

目录说明：

```text
network_v2/
  transport/
    ITransport.ts
    HttpAdapter.ts
  action/
    ActionTypes.ts
    ActionFactory.ts
  sync/
    LocalQueue.ts
    SyncEngine.ts
    SyncTypes.ts
  state/
    SnapshotManager.ts
  NetClient.ts
```

当前阶段只做“架构骨架 + 接口约束”：

- 已定义标准 Action 结构
- 已定义本地队列持久化
- 已定义 `/api/sync` 请求/响应结构
- 已定义同步引擎的防抖 / 退避 / 403 回滚入口
- 已定义快照接管接口
- 尚未绑定具体玩法和正式服务端协议

建议接入顺序：

1. 先让 `EconomyFacade` / `ProgressFacade` 通过 `NetClient.dispatch()` 产生日志
2. 再补 `/api/sync` 服务端协议
3. 再接入正式 `SnapshotManager` 覆盖逻辑
4. 最后替换旧 `assets/scripts/network` 的部分调用点
