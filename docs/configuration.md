# 配置参考

实际配置由 `config/server.yaml` 提供。先复制模板：

```bash
cp config/server.example.yaml config/server.yaml
```

该文件包含真实探测目标，已被 Git 忽略。

## 完整结构

```yaml
server:
  name: "我的 Minecraft 服务器"
  timezone: "Asia/Shanghai"

java:
  enabled: true
  host: "play.example.com"
  port: 25565
  displayAddress: "play.example.com"

bedrock:
  enabled: true
  host: "bedrock.example.com"
  port: 19132
  displayAddress: "bedrock.example.com:19132"

monitor:
  intervalSeconds: 60
  timeoutMs: 5000
  downAfterFailures: 3
  upAfterSuccesses: 2
  staleAfterIntervals: 3
  retentionDays: 90

maintenance:
  enabled: false
  startsAt: null
  endsAt: null
  message: null
```

至少启用 `java` 或 `bedrock` 之一。

## 字段说明

### `server`

| 字段 | 说明 |
| --- | --- |
| `name` | 页面展示的服务器名称。 |
| `timezone` | 页面时间格式化使用的 IANA 时区，例如 `Asia/Shanghai`。 |

### `java` / `bedrock`

| 字段 | 说明 |
| --- | --- |
| `enabled` | 是否检查和公开该入口。 |
| `host` | 实际探测目标，仅容器/Worker 使用。 |
| `port` | 实际探测端口。Java 默认 25565；基岩默认 19132。 |
| `displayAddress` | 页面和公开 API 展示、供玩家复制的连接地址。 |

`host` 与 `displayAddress` 可以不同。例如实际探测代理内部地址，但公开地址仍为玩家域名。公开 API 不返回实际 `host` 或 `port`。

### `monitor`

| 字段 | 默认值 | 说明 |
| --- | ---: | --- |
| `intervalSeconds` | 60 | Worker 每轮检查间隔。范围 10–3600 秒。 |
| `timeoutMs` | 5000 | 单次网络检查超时。范围 500–30000 毫秒。 |
| `downAfterFailures` | 3 | 连续失败达到该值后确认离线。 |
| `upAfterSuccesses` | 2 | 连续成功达到该值后确认恢复。 |
| `staleAfterIntervals` | 3 | 快照超过此检测周期数未更新时公开为未知。 |
| `retentionDays` | 90 | 保留原始 `check_results` 的天数。 |

当前 Worker 依次检查启用的 Java 和基岩版入口；未实现随机抖动、多探测点、重试队列或配置并发数。

### `maintenance`

启用后可覆盖整体状态为 `MAINTENANCE`。

| 字段 | 说明 |
| --- | --- |
| `enabled` | 是否启用维护覆盖。 |
| `startsAt` / `endsAt` | 可选 ISO 8601 时间。为空时不限制开始或结束。 |
| `message` | 页面展示的维护文案。 |

这是全局配置覆盖，不会生成事件、故障历史或可用率例外记录。

## 环境变量插值

`host` 支持严格的大写环境变量占位符：

```yaml
host: "${JAVA_SERVER_HOST}"
```

对应变量缺失时，应用启动失败。容器部署时需要在 Compose 的 `environment` 中传入该变量；也可以直接在 `server.yaml` 写入实际主机名。

常用运行时变量：

| 变量 | 说明 |
| --- | --- |
| `SERVER_CONFIG_PATH` | 配置文件路径。默认 `./config/server.yaml`。容器使用 `/config/server.yaml`。 |
| `APP_BASE_URL` | Web 容器的公开浏览器地址，例如 `https://status.example.com`。生产环境手动检查会要求浏览器 `Origin` 与该地址匹配。 |
| `PROBE_ALLOWED_ORIGINS` | 可选的额外公开 Origin，逗号分隔；仅用于别名域名。 |
| `DATABASE_URL` | SQLite URL，例如 `file:/data/status.db`。 |
| `JAVA_SERVER_HOST` | 仅当 Java `host` 使用 `${JAVA_SERVER_HOST}` 时需要。 |
| `BEDROCK_SERVER_HOST` | 仅当基岩 `host` 使用 `${BEDROCK_SERVER_HOST}` 时需要。 |

## 目标安全限制

当前实现会拒绝：`localhost`、`::1`、`127.*`、`169.254.*`、`metadata.google.internal`。

这不是完整的私网 CIDR 或 DNS 解析后地址验证。请仅在可信配置中填写探测目标；不要将配置编辑能力公开给不可信用户。
