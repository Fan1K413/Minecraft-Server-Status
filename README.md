# Minecraft Server Status

面向一个逻辑 Minecraft 服务器的公开单页状态页。它可同时监控 Java 与基岩版兼容入口：Java 状态协议提供共享服务器信息，基岩版仅提供入口连通性。

> **当前实现快照**：一个 Next.js Web 服务、一个 Node.js Monitor Worker、一个共享 SQLite WAL 数据库。生产 Compose 使用两个容器，Web 暴露在宿主机 `15879` 端口，由用户自行配置反向代理。

## 已实现功能

- Java / 基岩版入口状态、整体状态与手动即时检查。
- Java 协议返回的在线人数、版本、延迟、图标和安全格式化 MOTD。
- 在线人数趋势图和分时间段的可用性条。
- 60 秒默认检测、3 次失败离线、2 次成功恢复、过期数据未知。
- SQLite WAL 持久化、原始检查记录保留和 GHCR 镜像构建工作流。
- 完整状态 API、轻量状态 API、趋势 API、SVG 状态标签与健康检查。

## 当前限制

- 仅支持一个逻辑服务器，最多一个 Java 和一个基岩版入口。
- 单主机 SQLite、单 Monitor Writer；不支持多探测点、多实例写入或网络共享卷。
- 无管理员后台、事件/故障记录、通知订阅、多服务器模型、Prometheus 集成或 PostgreSQL。
- `maintenance` 是配置级整体状态覆盖，不是维护事件系统。

## 快速开始

```bash
pnpm install
cp config/server.example.yaml config/server.yaml
pnpm db:migrate
pnpm dev
```

另开终端启动 Monitor：

```bash
pnpm dev:monitor
```

可选：写入演示历史数据。

```bash
pnpm db:seed
```

开发页面默认地址为 `http://localhost:3000`。Windows 本地脚本使用 `set ... && ...` 环境变量语法；Linux/macOS 请显式设置 `SERVER_CONFIG_PATH` 和 `DATABASE_URL`，或使用容器部署。

## 常用命令

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm db:migrate
pnpm db:seed
```

## 文档

在线文档（GitHub Pages）：[fan1k413.github.io/Minecraft-Server-Status](https://fan1k413.github.io/Minecraft-Server-Status/)。GitHub Pages 直接发布 `docs/` 中的 Markdown 文档；实时状态页和 `/api/*` 仍需按部署指南运行。

- [文档首页](docs/index.md)
- [当前架构与状态规则](docs/architecture.md)
- [配置参考](docs/configuration.md)
- [API 参考](docs/api.md)
- [GHCR 与 Docker 部署](docs/deployment.md)
- [故障排查](docs/troubleshooting.md)
- [产品与技术路线图（非当前实现规范）](docs/status-page-plan.md)

## 本地配置安全

真实配置文件 `config/server.yaml`、数据库、运行数据和本地部署文件都被 Git 忽略。请提交 `config/server.example.yaml`，不要提交真实探测目标、令牌或数据库。
