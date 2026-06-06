# WeChat Auth Server

这是一个适合部署到微信云托管的微信小游戏认证服务。

当前版本是无状态的：
- 只负责 `code -> openid`
- 生成和校验 JWT 登录态
- 返回 `uid/token`
- `uid` 由 `openid` 稳定计算得出

这意味着它很适合云托管容器：
- 不依赖本地 SQLite
- 不依赖本地文件持久化
- 容器重启后 `uid` 仍然稳定

## 接口

### `GET /api/health`

健康检查。

### `POST /api/auth/wechat-login`

请求体：

```json
{
  "code": "wx_login_code"
}
```

返回：

```json
{
  "success": true,
  "data": {
    "uid": "stable_uid",
    "token": "jwt_token",
    "openid": "openid_value",
    "isNewUser": false
  }
}
```

### `GET /api/auth/me`

请求头：

```text
Authorization: Bearer <token>
```

返回：

```json
{
  "success": true,
  "data": {
    "uid": "stable_uid",
    "openid": "openid_value"
  }
}
```

## 本地运行

1. 复制环境变量文件

```bash
cp .env.example .env
```

Windows `cmd`：

```bat
copy .env.example .env
```

2. 填写 `.env`

- `WX_APPID`
- `WX_SECRET`
- `JWT_SECRET`

3. 安装并启动

```bash
npm install
npm run start
```

## 部署到微信云托管

这个目录已经包含 [Dockerfile](/c:/Users/32244/Downloads/NewProjectX/server/Dockerfile)，可以直接作为云托管服务代码源。

建议部署时设置这些环境变量：

- `PORT=8080`
- `WX_APPID=你的小游戏 AppID`
- `WX_SECRET=对应 AppSecret`
- `JWT_SECRET=一串随机长字符串`
- `TOKEN_EXPIRES_IN=30d`

云托管启动后，确认：

1. 服务日志出现 `listening on 0.0.0.0:8080`
2. `GET /api/health` 可访问
3. 客户端 [conf.ts](/c:/Users/32244/Downloads/NewProjectX/assets/scripts/X/client/Script/easyFramework/network/conf.ts) 的 `baseUrl` 改成云托管访问地址

## 说明

这版因为游戏存档仍然只保存在客户端本地，所以服务端不需要保存用户资料表。

如果以后你要接：
- 云存档
- 用户资料
- 黑名单/封禁
- 账号绑定

再把服务端升级成数据库版会更合适。
