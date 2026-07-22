# 故障排查

从 `deploy/` 目录执行以下命令：

```bash
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs -f web monitor
```

## `EISDIR: illegal operation on a directory, read`

配置路径指向目录，不是 YAML 文件。检查：

```bash
ls -ld ../config ../config/server.yaml
file ../config/server.yaml
```

`../config/server.yaml` 必须显示为普通文本文件。如果它被误创建成目录：

```bash
rm -rf ../config/server.yaml
cp ../config/server.example.yaml ../config/server.yaml
```

然后填写配置并重建：

```bash
docker compose -f compose.yaml up -d --force-recreate
```

## Web 报找不到生产构建

错误类似：

```text
Could not find a production build in the '.next' directory
```

说明正在运行旧镜像或 Dockerfile 的 Web 工作目录不正确。等待 GitHub Actions 发布包含当前 Dockerfile 的镜像后：

```bash
docker compose -f compose.yaml pull
docker compose -f compose.yaml up -d --force-recreate
```

确认实际 digest：

```bash
docker image inspect ghcr.io/<owner>/minecraft-server-status-web:main --format '{{index .RepoDigests 0}}'
```

## Monitor 无法连接或长期退出

先看日志：

```bash
docker compose -f compose.yaml logs --tail=100 monitor
```

检查项：

1. `server.yaml` 可读取，且启用了至少一个入口。
2. `${JAVA_SERVER_HOST}` / `${BEDROCK_SERVER_HOST}` 若被使用，容器环境中必须存在；最简单的方法是直接在配置里填写主机名。
3. 部署主机允许出站 Java TCP 与基岩 UDP 端口。
4. Java 入口的 DNS、端口、代理/SRV 设置正确。
5. 基岩入口实际支持 UDP/RakNet ping，端口不是仅开放 TCP。

正常轮次会输出：

```text
{"event":"monitor.check.complete", ...}
```

## 页面长期显示“状态未知”

`UNKNOWN` 表示无快照，或最后检查时间超过 `staleAfterIntervals × intervalSeconds`。

```bash
curl -fsS http://127.0.0.1:15879/api/v1/status
```

检查 `checkedAt`、Monitor 容器运行状态和日志。`/api/health/ready` 仅证明 SQLite 可读，不能证明 Monitor 仍在运行。

## Java 或基岩入口显示离线

等待连续失败达到 `downAfterFailures`（默认 3）后才会显示离线。恢复也需要连续成功达到 `upAfterSuccesses`（默认 2）。

页面上的手动检查仅是临时结果：Java 为 TCP 连通性，基岩为 UDP ping；它不会改变历史或状态机。

## 手动检查按钮始终失败

手动检查的浏览器 Origin 必须与 Web 容器的 `APP_BASE_URL` 一致。当前 Compose 使用：

```text
APP_BASE_URL=https://status.example.com
```

确认浏览器实际访问的域名与其一致；若使用别名域名，在 Web 容器添加 `PROBE_ALLOWED_ORIGINS=https://别名域名`。反向代理可将请求转发到 `127.0.0.1:15879`，但不应改写浏览器的公开 Origin。

浏览器开发者工具中查看 `POST /api/v1/probe` 的 HTTP 状态、JSON 响应和 `X-Request-ID`。再用请求 ID 查询：

```bash
docker compose -f compose.yaml logs --tail=200 web
```

- `403`：公开 Origin 配置不匹配、缺失或请求不是浏览器同源请求。
- `429`：同一 scope 20 秒内重复检查。
- `503`：Web 无法读取配置或执行检查；查看 Web 日志。
- `200` 且 `success: false`：HTTP 路由正常，继续检查容器对 Minecraft TCP/UDP 的出站连通性。

## 反向代理无法访问

如果代理运行在宿主机，应代理到：

```text
http://127.0.0.1:15879
```

如果需要只允许宿主机反向代理访问，可将 Compose 映射改为：

```yaml
ports:
  - "127.0.0.1:15879:3000"
```

不要在宿主机代理配置中使用 `web:3000`；该名称仅对同一 Docker 网络中的容器可解析。

## 历史数据为空或不完整

- Monitor 首次检查尚未完成。
- 数据库在 `../data/status.db`，确认该目录没有被清空。
- 原始记录超过 `retentionDays`（默认 90 天）会清理。
- Java 才会产生在线人数趋势；基岩版没有玩家趋势数据。
- 可用性无样本桶显示中性状态，不等于 0% 可用。
