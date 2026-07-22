# Minecraft 服务器状态页文档

面向一个逻辑 Minecraft 服务器的公开状态页文档。项目支持一个 Java 入口和一个基岩版兼容入口：Java 状态协议提供共享服务器信息，基岩版用于检查入口连通性。

- [查看源代码](https://github.com/Fan1K413/Minecraft-Server-Status)

## 当前实现

```text
浏览器 / 宿主机反向代理
              │
        Next.js Web
              │
          SQLite WAL
              │
       Node.js Monitor
          ├─ Java TCP / Server List Ping
          └─ Bedrock UDP / RakNet Ping
```

- Java / 基岩入口状态与整体状态。
- Java 在线人数、版本、延迟、MOTD 和图标。
- 在线人数趋势与 30 格可用性记录。
- 默认 60 秒检测、3 次失败离线、2 次成功恢复。
- 轻量状态 API、SVG 状态标签与受限手动检查。
- GHCR 镜像与两容器部署方案。

## 当前限制

当前实现只支持一个逻辑服务器、单主机 SQLite 和单 Monitor Writer。不包含多服务器、事件系统、管理后台、通知渠道、多探测点或 PostgreSQL。

## 文档目录

- [架构与状态规则](architecture.md)
- [配置参考](configuration.md)
- [API 参考](api.md)
- [部署指南](deployment.md)
- [故障排查](troubleshooting.md)
- [产品与技术路线图](status-page-plan.md)

GitHub Pages 仅发布本目录中的静态项目文档；实际状态页面和 `/api/*` 仍需按部署指南运行 Web 与 Monitor。
