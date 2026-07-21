# Minecraft Server Status

一个公开的单页 Minecraft 服务器状态页：Java 版提供在线人数、版本、MOTD 和延迟数据；基岩版兼容入口只检查是否可以连接。在线人数趋势只以 Java 状态协议的结果为准。

## 功能

- Java / 基岩两个入口的独立在线状态与整体可用性。
- Java 版在线人数、版本、MOTD、延迟与最近 24 小时人数趋势。
- 60 秒探测、连续 3 次失败判定离线、连续 2 次成功恢复。
- SQLite WAL 持久化与 90 天历史保留。
- 只读状态、趋势、健康检查 API；不接受浏览器提供的探测地址。
- Docker Compose + Caddy 部署模板。

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

3. 初始化、写入演示数据并启动页面：

   ```bash
   pnpm db:migrate
   pnpm db:seed
   pnpm dev
   ```

   在另一个终端运行真实探测 Worker：

   ```bash
   pnpm dev:monitor
   ```

4. 访问 `http://localhost:3000`。

## 常用命令

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm db:migrate
```

## Docker 部署

将 `config/server.example.yaml` 复制为 `config/server.yaml`，提供所需环境变量后执行：

```bash
docker compose -f deploy/compose.yaml up -d --build
```

这是**单主机、单 Worker 写入**设计：Web 和 Worker 通过同一个本地持久卷使用 SQLite。不要在 NFS/SMB 等共享网络卷上使用 SQLite；需要多实例 Web、多个探测点或多个 Worker 时，应先迁移到 PostgreSQL。

每日备份时应先使用 SQLite 在线备份机制或短暂停止 Worker，再复制数据库。恢复前应在非生产位置验证备份文件可以打开，并在恢复后调用 `/api/health/ready` 与状态页验证数据。

## 安全说明

- 探测主机仅从可信的本地配置加载，公共 API 不能指定 `host` 或 `port`。
- 配置拒绝常见环回、链路本地和云元数据目标；私网部署应额外完善允许列表策略。
- Java MOTD 作为纯文本显示，不会插入服务端返回的 HTML。
- 网络探测具有超时限制；基岩端仅将正确 UDP 响应判为可用。

详见 [产品与技术方案](docs/status-page-plan.md)。
