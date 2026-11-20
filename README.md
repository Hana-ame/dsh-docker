# Hardened DeepSeek Harness (`dsh`) in Docker — 插件集合仓库

生产就绪、高安全性的 **DeepSeek Harness (`dsh`)** Web UI 容器化部署方案。已配置宿主机隔离防护与网络白名单机制，插件清单放在 `plugins.list`，镜像构建时由 dsh 自己安装并按 commit 固定版本。

---

## 目录
1. [预装插件](#预装插件)
2. [安全与宿主机隔离设计](#安全与宿主机隔离设计)
3. [快速启动与访问](#快速启动与访问)
4. [配置访问 IP 与端口](#配置访问-ip-与端口)
5. [插件版本管理与更新](#插件版本管理与更新)
6. [常用运维管理命令](#常用运维管理命令)
7. [镜像构成与体积](#镜像构成与体积)

---

## 预装插件（构建时自动安装）

镜像**不打包插件源码**。仓库根目录的 `plugins.list` 是安装清单：每行一个 pnpm 安装 spec，构建镜像时 Dockerfile 逐行执行

```sh
dsh plugin --profile web add <spec>
```

装完由 `scripts/enable-bundles.mjs` 把声明了 `dsh.bundle` / `dsh.client` 的包登记进 web profile 的 `dsh.profile.bundles`，容器启动即加载。

当前清单（15 个，全部钉到 commit）：

| 插件 | 说明 |
|------|------|
| `dsh-peer-message` | P2P 消息 / 在线发现 / 好友 |
| `dsh-advanced-patrol` | 高级巡检 |
| `dsh-schedule-viewer` | 定时任务面板 |
| `dsh-bash-prelude` | bash 前置钩子 |
| `dsh-enable-ui-schedule` | 启用 UI 定时任务 |
| `dsh-gear-grid-model` | 齿轮 / 网格模型 |
| `dsh-model-select` | 模型选择 |
| `dsh-ofm-huawei-codearts` | OFM CodeArts 线路 |
| `dsh-ofm-rate-limit-retry` | OFM 限流重试 |
| `dsh-schedule-task-tab` | 定时任务 Tab |
| `dsh-sensenova-keypool` | 商汤 key 池 |
| `dsh-sensenova-multi` | 商汤多路 |
| `dsh-session-management` | 会话管理 |
| `dsh-siliconflow-keypool` | 硅基流动 key 池 |
| `dsh-workspace-session-mgmt` | 工作区会话管理 |

清单条目可替换成任意 pnpm spec（npm 包名 / git URL / `github:user/repo`）。

### 增加 / 移除插件

- **增加**：把 spec 追加进 `plugins.list`，重新构建镜像。新卷会自动带上；**已有数据卷**会在下次启动时自动同步（见下）。
- **移除**：从 `plugins.list` 删掉对应行，重新构建。同样会自动同步（同步会清掉 `node_modules` 后按新清单重装）。
- **Agent Canvas**：动态 Cordis 插件，必须由运行中的 agent 用 `cordis_define` / `cordis_run` 加载，无法通过本清单预装（源码在 [Hana-ame/dsh-canvases](https://github.com/Hana-ame/dsh-canvases)）。

### 构建期网络 / 代理

插件在构建时从 GitHub 拉取，构建机需要能访问 GitHub。

```bash
# 方式 1：.env 里配（docker-compose.yml 会透传为 build-arg）
#   注意代理地址是「构建容器视角」的地址：
#   127.0.0.1 指的是构建容器自己，不是宿主机！
HTTP_PROXY=http://172.17.0.1:7890
HTTPS_PROXY=http://172.17.0.1:7890

# 方式 2：命令行
docker compose build \
  --build-arg HTTP_PROXY=http://<宿主机在docker bridge上的IP>:7890 \
  --build-arg HTTPS_PROXY=http://<宿主机在docker bridge上的IP>:7890

# 方式 3：让构建容器与宿主共享网络栈（此时 127.0.0.1 才真的是宿主机）
docker build --network=host --build-arg HTTP_PROXY=http://127.0.0.1:7890 .
```

`host.docker.internal` 在新版 Docker 的 buildkit 里可用，但不保证所有环境都解析，所以上面按 docker bridge 网关（通常 `172.17.0.1`）写。

### 镜像源（国内 / 海外）

默认走国内源，海外构建覆盖这三个 build-arg 即可：

```bash
# .env
DEBIAN_MIRROR=deb.debian.org
NPM_REGISTRY=https://registry.npmjs.org
DSH_VERSION=0.2.2-rc.2     # 必须显式钉版本，rc 预发布用 @latest/* 匹配不到
```

国内默认值：`DEBIAN_MIRROR=mirrors.ustc.edu.cn`、`NPM_REGISTRY=https://registry.npmmirror.com`。容器的 DNS 也建议同步换国内（`.env` 里的 `DSH_DNS_1/2`）。

---

## 安全与宿主机隔离设计

本部署方案从底层杜绝容器内程序访问宿主机：

1. **宿主机完全阻断（`DOCKER-USER` 链拦截）**：
   `./setup-security.sh` 在 `DOCKER-USER` 链**插入**规则（必须插在最前面：Docker 会在该链末尾自动追加 `-j RETURN`，用 `-A` 追加的规则永远轮不到），DROP 容器子网发往宿主机的全部数据包。容器内探测宿主机端口（SSH 22、本地数据库等）会直接超时。
   - 同时支持 IPv6（设 `DSH_SUBNET6` 后生效）。
   - `--persist` 会安装 systemd 单元，重启后规则自动恢复。
2. **内网与云元数据阻断**：在 `DOCKER-USER` 链阻断容器访问私有子网（`10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`）与云元数据地址（`169.254.169.254`）。
3. **工作区隔离与持久化**：
   - **`/workspace`**：容器工作目录（`WORKDIR /workspace`），挂独立卷 `dsh_workspace`，属 `dshuser:dshuser`。项目代码与生成物重启/重建后仍保留。
   - **`/tmp`**：1GB 内存 `tmpfs`（`rw,nosuid,nodev,size=1g`），重启自动清空。注意 tmpfs 的 `exec` 选项会被 Docker 静默丢弃（`nosuid/nodev` 隐含 `noexec`），**不能**在这里执行二进制——dsh 的 native loader 需要可执行目录，故已用 `NARB_NATIVE_CACHE_DIR` 把缓存指到 `/workspace/.native-cache`。
4. **无敏感挂载与特权剥夺**：
   - **绝不挂载** Docker Socket（`/var/run/docker.sock`）或宿主机根目录。
   - 剥离全部内核特权（`cap_drop: [ALL]`）。
   - 阻止提权（`security_opt: [no-new-privileges=true]`）。
   - 低权限用户 `dshuser`（UID:GID `10001:10001`）运行。
5. **资源限制**：`pids: 256` 防 fork 炸弹，`cpus` / `memory` 默认 `2.0` / `4G`（可由 `.env` 的 `DSH_CPUS` / `DSH_MEMORY` 覆盖）。

### 端口暴露模型

```
浏览器 → 宿主 127.0.0.1:HOST_PORT(8080)
       → 容器 0.0.0.0:3080（entrypoint 里的 TCP 桥）
       → 容器 127.0.0.1:3081（dsh web 真实监听）
```

**为什么要有这层桥**：dsh 的 webserver 插件明确拒绝绑定 `0.0.0.0`，报

```
host "0.0.0.0" is an unspecified (wildcard) address, which is not supported:
binding every interface would expose remote code execution to the network
```

这是有意的安全设计，`--patch` 也绕不过（实测直接启动失败）。所以由 entrypoint 起一个极薄 TCP 转发，暴露面完全由 compose 的 `HOST_BIND` 控制。

`HOST_BIND` 默认 `127.0.0.1`：dsh 的鉴权是「URL 里的 launch token → 换 HttpOnly cookie」，走明文 HTTP；绑 `0.0.0.0` 等于把带 token 的 URL 暴露给同网段。需要 LAN/公网访问时，请在前面加 TLS 反代（nginx/caddy）并保持 `HOST_BIND=127.0.0.1`。

---

## 快速启动与访问

### 第一步：准备配置
```bash
cp .env.example .env      # 按需修改（默认值即可直接跑）
```

### 第二步：（可选，推荐）加载安全防护规则
```bash
./setup-security.sh --dry-run   # 先看会改什么
sudo ./setup-security.sh --persist   # 应用并持久化
```

### 第三步：构建并启动
```bash
docker compose build
docker compose up -d
```

### 第四步：获取登录链接（含 Token）
```bash
docker compose logs --tail 20
```
日志里会有一条：
```text
dsh web: http://127.0.0.1:3081/?token=<TOKEN>
```
把端口换成宿主端口后访问：`http://127.0.0.1:8080/?token=<TOKEN>`

token 是一次性的：首次访问会 303 跳转并种下 `dsh-auth-*` HttpOnly cookie，之后无需再带 token。

### 第五步：浏览器打开

* **本机**：直接开 `http://127.0.0.1:8080/?token=<TOKEN>`
* **远程服务器**：本地终端做 SSH 端口转发
  ```bash
  ssh -L 8080:127.0.0.1:8080 user@your-server-ip
  ```
  然后本地浏览器访问 `http://localhost:8080/?token=<TOKEN>`
* **域名 / 反代**：把域名加进 `.env` 的 `EXTRA_TRUSTED_HOSTS`，否则 `/api` 会 403。

---

## 配置访问 IP 与端口

所有变量集中在 `.env`（模板见 `.env.example`，每项都有默认值）：

| 变量 | 默认 | 说明 |
|------|------|------|
| `HOST_BIND` | `127.0.0.1` | 宿主机绑定 IP。改 `0.0.0.0` 前先读上面的端口暴露模型 |
| `HOST_PORT` | `8080` | 宿主机端口（→ 容器 3080） |
| `EXTRA_TRUSTED_HOSTS` | 空 | 额外信任的 Host 白名单，空格分隔。用于域名/局域网 IP 访问 |
| `DEEPSEEK_API_KEY` | 空 | 也可在 Web 界面里配 |
| `DSH_CONTAINER_NAME` | `dsh-sandbox` | 容器名（多开时改） |
| `DSH_DATA_VOLUME` / `DSH_WORKSPACE_VOLUME` | `dsh_data` / `dsh_workspace` | 卷名（**多开必须不同**，否则两实例抢同一 profile） |
| `DSH_SUBNET` / `DSH_GATEWAY` / `DSH_CONTAINER_IP` | `172.28.0.0/16` / `172.28.0.1` / `172.28.0.10` | 与宿主既有路由冲突时整组改（三者必须同网段，且与 `setup-security.sh` 的 `DSH_SUBNET` 一致） |
| `DSH_CPUS` / `DSH_MEMORY` | `2.0` / `4G` | 资源上限 |
| `DSH_DNS_1` / `DSH_DNS_2` | `1.1.1.1` / `8.8.8.8` | 容器 DNS；国内建议改 `223.5.5.5` / `119.29.29.29` |

修改后：
```bash
docker compose up -d    # compose 会重建容器使新配置生效
```

`EXTRA_TRUSTED_HOSTS` 示例：
```bash
EXTRA_TRUSTED_HOSTS="192.168.1.100:8080 localhost:8080"   # 局域网 IP
EXTRA_TRUSTED_HOSTS="my-agent.example.com"                # 域名
```

### 同机多开

```bash
# dsh-b.env
HOST_PORT=8083
DSH_CONTAINER_NAME=dsh-sandbox-b
DSH_DATA_VOLUME=dsh_data_b
DSH_WORKSPACE_VOLUME=dsh_workspace_b
DSH_SUBNET=172.29.0.0/16
DSH_GATEWAY=172.29.0.1
DSH_CONTAINER_IP=172.29.0.11
```
```bash
docker compose --env-file dsh-b.env up -d
```

---

## 插件版本管理与更新

### 版本固定

`plugins.list` 里每条都钉到具体 commit（`git+https://github.com/owner/repo.git#<sha>`），保证同一份 Dockerfile 在任何时间构建出的镜像内容一致；上游一次破坏性提交不会让「昨天还能 build」突然失败。

升级是显式动作：

```bash
./scripts/bump-plugins.sh --dry-run   # 看哪些有新提交
./scripts/bump-plugins.sh             # 把每行刷到对应仓库 main 的最新 commit
docker compose build && docker compose up -d
```

### 数据卷里的插件如何更新

`dsh_data` 卷第一次创建时从镜像拷贝 `/home/dshuser/.dsh`，之后一直复用卷内数据——**只重建镜像不会更新已有容器的插件**。

本仓库对此做了自动化：镜像构建时把 `plugins.list` 的 sha256 写进镜像（`/opt/dsh/plugins/fingerprint`），容器启动时 entrypoint 比对卷里的 `.plugin-sync-fingerprint`：

- **相同** → 卷内插件就是镜像这一版，直接启动（常规重启，秒级）；
- **不同** → 按镜像里的清单重装插件，写回指纹。

同步只清 `profiles/web/node_modules` 并重装依赖，**不动 sessions / storages / 其他状态**，所以升级镜像不会丢会话。

想临时跳过：`DSH_SKIP_PLUGIN_SYNC=1 docker compose up -d`。

> 注意：同步需要容器启动时能访问 GitHub。离线环境请改为构建前把插件打进镜像（或挂本地 registry/proxy）。

---

## 常用运维管理命令

```bash
docker compose up -d            # 启动
docker compose down             # 停止（保留卷）
docker compose down -v          # 停止并删除卷（清空会话/插件）
docker compose restart          # 重启
docker compose logs -f          # 实时日志与登录 Token
docker compose ps               # 状态

# 改过 Dockerfile / entrypoint.sh / plugins.list 后
docker compose build --no-cache
docker compose up -d

# 进入容器
docker compose exec dsh bash
```

---

## 镜像构成与体积

- 基础镜像 `node:22-bookworm-slim`。
- 依赖安装（`bash`/`curl`/`git`/`ca-certificates`/`procps`/`python3`/`python3-pip`/`python3-venv`）、全局包安装（`@deepseek-ai/dsh` 与 native addon）、缓存清理、非特权用户创建合并为**单个 RUN 层**；运行期不再需要的 `python3-pip`/`python3-venv` 在该层内显式 purge。
- **最终镜像约 1.5GB**（dsh 本体 + 15 个插件及其 node_modules 依赖；插件源码不进镜像层，而是装进 profile）。
- `EXPOSE 3080`（对外是容器内桥的端口，dsh 真实监听 3081）。

> 历史版本的 README 曾写「~200MB / 三枚预装插件」，那是插件清单只有 3 条时的数字，已不适用。
