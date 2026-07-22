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
    "java": { "enabled": true, "displayAddress": "windking.fans" },
    "bedrock": { "enabled": true, "displayAddress": "bedrock.windking.fans:19132" }
  },
  "java": {},
  "bedrock": {},
  "availability": { "java": [], "bedrock": [] }
}
```

Java 快照可包含 `playersOnline`、`playersMax`、`versionName`、`latencyMs`、`motd`、`motdParts`、`favicon`。基岩快照当前只用于状态。配置无法加载时返回 `UNKNOWN` 与 `configurationError`。

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

`range` 可为 `24h`、`3d`、`7d`、`15d`、`30d`、`all`；默认 `7d`。`all` 受当前 90 天保留期限制。

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

`scope` 仅允许 `JAVA`、`BEDROCK`、`all`。请求体最大 128 字节，浏览器请求进行同源校验，按来源和 scope 有 20 秒冷却。可能返回 `400`、`403`、`413`、`429`。

Java 手动检查是 TCP 连通性检查；基岩是 UDP ping。它不等价于 Monitor 的完整 Java 协议采集。

## `GET /api/v1/status.svg`

返回 76×28 的整体状态 SVG 胶囊标签，可直接嵌入：

```html
<img src="https://status.windking.fans/api/v1/status.svg" alt="Minecraft 服务器状态">
```

响应包含 `image/svg+xml`、30 秒缓存、CORS、`nosniff` 与严格 CSP。

## 健康检查

| 路径                      | 含义               |
| ------------------------- | ------------------ |
| `GET /api/health/live`  | Web 进程可以响应。 |
| `GET /api/health/ready` | SQLite 可读。      |

两者都不能证明 Monitor 正在运行或目标服务器可用。
