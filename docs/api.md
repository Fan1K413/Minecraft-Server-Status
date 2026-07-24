# API 参考

所有接口无需认证。除手动检查外，接口均为只读；不会接受客户端提供的探测主机或端口。

状态枚举：`OPERATIONAL`、`OUTAGE`、`UNKNOWN`、`PARTIAL_OUTAGE`、`MAINTENANCE`。

## `GET /api/v1/status`

完整当前快照。缓存：30 秒；允许跨域。

```json
{
  "overallStatus": "OPERATIONAL",
  "checkedAt": "2026-07-22T00:00:00.000Z",
  "configurationError": null,
  "server": {
    "name": "我的 Minecraft 服务器",
    "java": { "enabled": true, "displayAddress": "play.example.com" },
    "bedrock": { "enabled": true, "displayAddress": "bedrock.example.com:19132" }
  },
  "java": {},
  "bedrock": {},
  "availability": { "java": [], "bedrock": [] }
}
```

Java 快照可包含 `playersOnline`、`playersMax`、`versionName`、`latencyMs`、`motd`、`motdParts`、`favicon`。接口字段保持稳定：服务端内部会按 SHA-256 去重 favicon，并仅在版本、MOTD 或图标变更时记录其历史，不影响当前快照的返回形式。基岩快照当前只用于状态。配置无法加载时返回 `UNKNOWN` 与 `configurationError`。

## `GET /api/v1/status/simple`

用于轻量轮询或主页小组件。缓存：15 秒；允许跨域。

```json
{
  "status": "PARTIAL_OUTAGE",
  "checkedAt": "2026-07-22T00:00:00.000Z",
  "stale": false,
  "endpoints": { "java": "OPERATIONAL", "bedrock": "OUTAGE" }
}
```

禁用入口为 `null`。`stale` 当前由整体状态是否为 `UNKNOWN` 推导。

## `GET /api/v1/history?range=...`

`range` 可为 `24h`、`3d`、`7d`、`15d`、`30d`、`all`；默认 `7d`。`all` 受当前 `retentionDays` 保留期限制，并从保留期起点与最早已记录 Java 检测时间中的较晚者开始。

```json
{
  "range": "7d",
  "from": "2026-07-15T00:00:00.000Z",
  "to": "2026-07-22T00:00:00.000Z",
  "history": [{ "at": "...", "playersOnline": 12, "latencyMs": 42 }],
  "availability": { "java": [], "bedrock": [] }
}
```

`history` 仅来自 Java 玩家数据。可用性固定为 30 个时间桶；无样本桶的百分比为 `null`，不等于 0%。

## `POST /api/v1/probe`

临时检查已配置入口，不会写入数据库或修改状态机。

```json
{ "scope": "JAVA" }
```

`scope` 仅允许 `JAVA`、`BEDROCK`、`all`。请求体最大 128 字节，浏览器请求必须携带与 Web 容器 `APP_BASE_URL`（或 `PROBE_ALLOWED_ORIGINS`）匹配的 Origin，按来源和 scope 有 20 秒冷却。可能返回 `400`、`403`、`413`、`429`、`503`；所有响应带 `X-Request-ID`，可用于查询 Web 日志。

Java 手动检查使用与 Monitor 相同的 Java Server List Ping；基岩是 UDP ping。检查仅返回临时结果，不会写入数据库或影响状态机。

## `GET /api/v1/status.svg`

返回 76×28 的整体状态 SVG 胶囊标签，可直接嵌入：

```html
<img src="https://status.example.com/api/v1/status.svg" alt="Minecraft 服务器状态">
```

响应包含 `image/svg+xml`、30 秒缓存、CORS、`nosniff` 与严格 CSP。

## 健康检查

| 路径                      | 含义               |
| ------------------------- | ------------------ |
| `GET /api/health/live`  | Web 进程可以响应。 |
| `GET /api/health/ready` | SQLite 可读。      |

两者都不能证明 Monitor 正在运行或目标服务器可用。
