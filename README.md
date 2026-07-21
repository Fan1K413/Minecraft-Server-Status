# Minecraft Server Status

一个公开的单页 Minecraft 服务器状态页，适用于同一服务器同时提供 Java 与基岩版兼容入口的场景。Java 状态协议提供服务器共享的在线人数、版本、MOTD、图标与延迟；基岩版只检测入口连通性。

## 功能

- Java / 基岩入口的独立状态与整体状态。
- Java 协议数据驱动的服务器信息：在线人数、版本、延迟与 Minecraft 格式化 MOTD。
- Java 在线人数趋势：支持 `24小时`、`3天`、`7天`、`15天`、`30天` 与 `全部` 范围，并支持鼠标或键盘查看具体采样点。
- 每个入口独立的可用性记录与范围选择；固定 30 个时间分段，范围越短，每格代表的时间越短。
- 每 60 秒自动探测；连续 3 次失败判定离线，连续 2 次成功恢复。
- 点击入口状态可进行一次即时检查；点击顶部整体状态可检查全部已启用入口。即时检查不会写入历史数据，也不会绕过 Worker 的状态判定阈值。
- SQLite WAL 持久化、90 天历史保留和 Docker Compose 部署模板。

## 快速开始

1. 安装 Node.js 22+ 与 pnpm：

   ```bash
   pnpm install
   ```

2. 创建本地配置并填写真实连接入口：

   ```bash
   cp config/server.example.yaml config/server.yaml
   ```

   在 `config/server.yaml` 中设置 `JAVA_SERVER_HOST`、`BEDROCK_SERVER_HOST` 对应的环境变量，或将占位符替换为真实主机名。公开页面只会展示 `displayAddress`，不会泄露实际探测目标。

3. 初始化数据库并启动页面：

   ```bash
   pnpm db:migrate
   pnpm dev
   ```

   在另一个终端运行监测 Worker：

   ```bash
   pnpm dev:monitor
   ```

   可选：写入演示趋势数据。

   ```bash
   pnpm db:seed
   ```

4. 访问 `http://localhost:3000`。

## API

所有公共接口均不会接受或返回实际探测主机与端口。

| 接口 | 说明 |
| --- | --- |
| `GET /api/v1/status` | 完整当前状态、服务器展示信息和可用性数据。 |
| `GET /api/v1/status/simple` | 轻量状态：整体状态、最后检测时间、是否过期及 Java/基岩入口状态。适合主页小组件或轮询。 |
| `GET /api/v1/status.svg` | 可嵌入的整体状态 SVG 图标。 |
| `GET /api/v1/history?range=24h|3d|7d|15d|30d|all` | Java 在线人数趋势，以及 Java/基岩入口的固定 30 格可用性数据。默认 `7d`。 |
| `POST /api/v1/probe` | 对已配置入口执行一次临时检查。请求体为 `{ "scope": "JAVA" }`、`{ "scope": "BEDROCK" }` 或 `{ "scope": "all" }`。有同源校验和冷却限制，且不写入数据库。 |
| `GET /api/health/live` | Web 进程存活检查。 |
| `GET /api/health/ready` | 数据库可读检查。 |

在其他站点嵌入状态图标：

```html
<img
  src="https://status.example.com/api/v1/status.svg"
  alt="Minecraft 服务器状态"
/>
```

## 常用命令

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm db:migrate
pnpm db:seed
```

## Docker 部署

将 `config/server.example.yaml` 复制为 `config/server.yaml`，提供所需环境变量后执行：

```bash
docker compose -f deploy/compose.yaml up -d --build
```

这是**单主机、单 Worker 写入**设计：Web 和 Worker 通过同一个本地持久卷使用 SQLite。不要在 NFS/SMB 等共享网络卷上使用 SQLite；需要多实例 Web、多个探测点或多个 Worker 时，应先迁移到 PostgreSQL。

每日备份时应先使用 SQLite 在线备份机制或短暂停止 Worker，再复制数据库。恢复前应在非生产位置验证备份文件可以打开，并在恢复后调用 `/api/health/ready` 与状态页验证数据。

## 安全说明

- 探测目标仅从受信任的本地配置加载，浏览器无法提交 `host` 或 `port`。
- 配置拒绝常见环回、链路本地和云元数据目标；私网部署应额外完善允许列表策略。
- MOTD 会解析为受限的 Minecraft 文本组件，仅允许固定颜色和常见文字样式；不会插入服务端返回的 HTML、事件或任意 CSS。
- 网络探测具有超时与响应限制；基岩端仅将有效 UDP 响应判为可用。
- 手动检查只探测已配置入口，受请求体限制、同源校验和冷却限制保护，不会修改历史记录或状态机。

详见 [产品与技术方案](docs/status-page-plan.md)。
