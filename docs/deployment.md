# 部署指南

当前生产拓扑只使用两个容器：Web 与 Monitor。HTTPS、域名和反向代理由宿主机自行管理。

## 镜像

Compose 当前固定使用：

```text
ghcr.io/<owner>/minecraft-server-status-web:main
ghcr.io/<owner>/minecraft-server-status-monitor:main
```

GitHub Actions 会在 PR 上验证测试/类型/构建；向 `main` 推送或创建 `v*` 标签时发布 GHCR 镜像。生产环境更推荐将 Compose 中的 `:main` 改为不可变 `sha-...` 标签或 digest，便于回滚。

私有 GHCR 包需要在部署主机登录：

```bash
printf '%s' "$CR_PAT" | docker login ghcr.io -u GITHUB_USERNAME --password-stdin
```

`CR_PAT` 使用单独的 classic PAT，最小权限为 `read:packages`。不要将令牌写入 Compose、配置文件或 shell 参数。组织启用 SSO 时还需授权令牌。

## 目录布局

从 `deploy/` 目录执行 Compose 时，当前配置使用以下相对路径：

```text
project/
├─ config/
│  └─ server.yaml
├─ data/                 # SQLite 数据库与 WAL 文件，由容器创建/写入
└─ deploy/
   └─ compose.yaml
```

Compose 将：

```text
../config -> /config (只读)
../data   -> /data (读写)
```

因此 `config/server.yaml` 必须是**文件**。如果 Docker 曾把它误创建为目录，会造成 `EISDIR` 错误；参见 [故障排查](troubleshooting.md)。

## 首次部署

```bash
cd deploy
mkdir -p ../data
# 在 ../config/server.yaml 写入实际配置
docker compose -f compose.yaml pull
docker compose -f compose.yaml up -d
```

检查：

```bash
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs -f web monitor
curl -fsS http://127.0.0.1:15879/api/health/ready
```

Web 端口映射是：

```text
15879 -> 容器内 3000
```

当前 Compose 端口映射为 `"15879:3000"`，会在宿主机所有网络接口公开 `15879` 端口，可直接通过 `http://服务器公网IP:15879` 访问。Web 容器还配置了 `APP_BASE_URL=https://status.example.com`，它必须与用户浏览器访问的公开状态域名一致，才能使用手动检查功能。反向代理仍可转发到 `http://127.0.0.1:15879`。

## 反向代理

宿主机 Caddy 示例：

```caddy
status.example.com {
  reverse_proxy 127.0.0.1:15879
}
```

仓库中的 `deploy/Caddyfile` 仅作为宿主机 Caddy 示例，不会被 Compose 自动启动。若反向代理不与容器共享 Docker 网络，目标必须是 `127.0.0.1:15879`，不要使用 `web:3000`。

## 更新与回滚

更新当前 `main` 镜像：

```bash
cd deploy
docker compose -f compose.yaml pull
docker compose -f compose.yaml up -d --force-recreate
```

建议记录每次部署使用的镜像 digest：

```bash
docker image inspect ghcr.io/<owner>/minecraft-server-status-web:main --format '{{index .RepoDigests 0}}'
```

回滚时将 `deploy/compose.yaml` 中两处镜像改为先前验证过的 SHA/digest，随后再次 `pull` 和 `up -d`。

## 镜像体积与构建缓存

Web 与 Monitor 均使用多阶段构建：运行镜像不包含 TypeScript、Vitest、pnpm store 或编译 `better-sqlite3` 所需的 Python/make/g++ 工具。Web 仅携带 Next standalone 产物；Monitor 仅携带自身源码和生产依赖。普通源码更新会复用由 lockfile 与 workspace manifests 决定的依赖层，因此服务器拉取的更新通常远小于完整构建镜像。

如需确认实际占用，请在部署主机执行：

```bash
docker image ls 'ghcr.io/<owner>/minecraft-server-status-*'
docker history ghcr.io/<owner>/minecraft-server-status-web:main
docker history ghcr.io/<owner>/minecraft-server-status-monitor:main
```

`docker history` 中不应出现完整仓库、测试文档或构建工具层。首次发布仍需下载基础镜像和生产依赖；之后应由镜像层缓存复用未变部分。

## 数据库迁移与更新

Web 和 Monitor 启动时会自动执行 SQLite schema 迁移；也可在镜像或本地工作区中运行 `pnpm db:migrate`，确认输出的 schema version。涉及数据库结构的镜像更新前，应先完成下方备份；迁移会保留既有原始检查记录，并将历史 favicon 去重、版本/MOTD/favicon 转换为变更事件。

## 数据与备份

`../data` 是 SQLite 数据目录。不要将它放在 NFS、SMB 或其他网络共享存储上。

备份前建议停止 Monitor，减少 WAL 写入竞争：

```bash
cd deploy
docker compose -f compose.yaml stop monitor
cp ../data/status.db ../data/status.db.backup
# 如存在，连同 status.db-wal / status.db-shm 一并备份
docker compose -f compose.yaml start monitor
```

恢复前先在非生产位置验证数据库可打开；恢复后检查 `/api/health/ready`、页面和 Monitor 日志。

原始检查记录按配置的 `retentionDays` 清理，但版本、MOTD 与图标变更事件会永久保留。清理记录不会立即缩小 `status.db` 文件；如需归还宿主机磁盘空间，请先备份并在停止 Monitor 的维护窗口使用 SQLite 的 `wal_checkpoint(TRUNCATE)` 与 `VACUUM`。不要直接删除 `status.db-wal` 或 `status.db-shm`。

## 已知部署限制

- 当前 Compose 未读取 `deploy/.env.example`；该文件是过时模板，不是现行部署输入。
- 容器内配置路径固定为 `/config/server.yaml`。
- 若 `server.yaml` 使用 `${JAVA_SERVER_HOST}` 等插值，必须在 Compose `environment` 中明确传入变量，或直接在配置文件写入实际主机名。
- SQLite 设计为单主机、单 Monitor 写入。
