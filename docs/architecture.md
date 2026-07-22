# 当前架构

本文件描述当前代码实际实现。未来功能见 [状态页路线图](status-page-plan.md)。

## 运行拓扑

```text
浏览器 / 用户管理的反向代理
              |
          宿主机端口 15879
              |
        Next.js Web 容器
              |
       SQLite WAL 数据库
              |
      Node.js Monitor 容器
       |                 |
Java Server List Ping   Bedrock UDP/RakNet Ping
```

`deploy/compose.yaml` 只运行 `web` 和 `monitor` 两个容器。反向代理不在 Compose 内，由部署主机自行维护。

## 数据流

1. Web 和 Monitor 均通过 `loadServerConfig()` 读取可信配置。
2. Monitor 按配置顺序检查启用的 Java、基岩版入口。
3. 每次检查调用 `StatusDatabase.recordCheck()`：写入历史结果，并更新当前快照。
4. Web 只从 SQLite 读取快照与历史记录；正常页面请求不触发探测。
5. `POST /api/v1/probe` 是临时连通性检查，不写入数据库，不更新状态机。

## 数据库

SQLite 启用 WAL 与 `busy_timeout=5000`。当前只有两张表：

| 表 | 用途 |
| --- | --- |
| `endpoint_snapshots` | Java / Bedrock 各一行的当前状态、计数和最新展示数据。 |
| `check_results` | 每次检查的原始成功/失败、延迟、玩家数、MOTD 和错误分类。 |

Worker 按 `retentionDays` 清理旧 `check_results`。没有 `servers`、`daily_stats`、`incidents` 或事件更新表。

## 状态规则

| 规则 | 默认值 |
| --- | --- |
| 检测周期 | 60 秒 |
| 单次超时 | 5 秒 |
| 判定离线 | 连续 3 次失败 |
| 判定恢复 | 连续 2 次成功 |
| 数据过期 | 超过 3 个检测周期未更新 |
| 原始记录保留 | 90 天 |

状态枚举：

- `OPERATIONAL`：入口可用。
- `OUTAGE`：已确认离线。
- `UNKNOWN`：无快照或快照过期。
- `PARTIAL_OUTAGE`：两个启用入口中仅部分可用。
- `MAINTENANCE`：配置中的维护窗口覆盖整体状态。

当 Java 与基岩入口都启用时，整体状态由两个入口状态计算。维护只是配置覆盖，不会创建历史事件。

## Java 与基岩版职责

- Java：TCP Server List Ping，采集在线人数、版本、延迟、MOTD 和 favicon。
- 基岩：UDP/RakNet ping，当前仅用于入口连通性。
- Java 数据被作为逻辑服务器的共享展示信息，不代表“仅 Java 玩家”的统计。

MOTD 会被转换为受限文本组件：仅保留固定 Minecraft 色彩及常见文字样式。不会渲染服务端返回 HTML、点击事件、悬停事件或任意 CSS。

## 手动检查边界

页面点击状态按钮会请求临时检查：

- Java 仅执行 TCP 连通性检查；不等价于完整 Java 协议信息采集。
- 基岩执行 UDP ping。
- 只允许检查已配置的 `JAVA`、`BEDROCK` 或所有启用入口。
- 结果不会写入 `check_results`、`endpoint_snapshots`，不会影响 3 次失败/2 次恢复规则或可用性历史。

## 扩展边界

SQLite 方案仅适合单主机和单 Monitor Writer。需要多 Worker、多 Web 写入、多探测点、NFS/SMB 数据目录或长期大规模历史时，应先迁移到 PostgreSQL 并重新设计协调方式。
