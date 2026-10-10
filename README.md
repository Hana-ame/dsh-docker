# Hardened DeepSeek Harness (`dsh`) in Docker — 插件集合仓库

生产就绪、高安全性且极致精简层级的 **DeepSeek Harness (`dsh`)** Web UI 容器化部署方案。已配置严苛的**宿主机隔离防护**与**网络白名单机制**，并预装三枚常用 Cordis 插件。

---

## 目录
1. [预装插件](#预装插件)
2. [安全与宿主机隔离设计](#安全与宿主机隔离设计)
3. [快速启动与访问](#快速启动与访问)
4. [如何修改访问 IP 与端口（必读）](#如何修改访问-ip-与端口必读)
5. [常用运维管理命令](#常用运维管理命令)
6. [镜像精简与层级优化说明](#镜像精简与层级优化说明)

---

## 预装插件

本仓库聚合了三个自用的 DSH Cordis 插件，在 Docker 镜像构建时一并 COPY 到 `/home/dshuser/.dsh/plugins/`，容器启动即生效，无需额外安装。

| 插件 | 目录 | 用途 | 挂载方式 |
|------|------|------|----------|
| **Agent Canvas** | `plugins/dsh-agent-canvas/` | Web GUI 侧边栏画布图：以文件为节点、Agent 为根的可视化工作区 | Cordis 动态插件（host + client 双半） |
| **Advanced Patrol** | `plugins/dsh-advanced-patrol/` | 会话级定时巡检：多预设（标准巡检/上下文审查/知识录入/卡住脱困），LLM 多轮工具操作 | Cordis 动态插件（host + client 双半） |
| **Schedule Viewer** | `plugins/dsh-schedule-viewer/` | 定时任务查看器：GUI 侧边栏按钮，查看所有 schedule 任务 + 委派记录 | Cordis 动态插件（host + client 双半） |
| **Our Free Model (OFM)** | `plugins/dsh-our-free-model/` | 免费额度自动切换：多模型自动 fallback、用量探测、feed 推送 | Cordis 动态插件（host + client 双半） |

四个插件**互不干扰**，各自独立挂载，任一插件缺失不影响其余插件工作。

### 插件目录结构

```
plugins/
├── dsh-agent-canvas/        # Agent Canvas 画布插件
│   ├── src/
│   │   ├── client.js        # 浏览器半（React UI）
│   │   └── host.js          # 服务器半（RPC handlers）
│   ├── package.json
│   └── README.md
├── dsh-advanced-patrol/     # 高级巡检插件
│   ├── src/
│   │   ├── client.js        # 浏览器半（侧边栏图标 + 控制面板）
│   │   ├── host.js          # 服务器半（定时器 + LLM 巡检）
│   │   └── presets.js       # 预设定义
│   ├── presets/             # 预设模板 Markdown
│   ├── cordis.patch.yml     # Cordis 组合声明
│   ├── index.js
│   └── package.json
├── dsh-schedule-viewer/     # 定时任务查看器插件
│   ├── src/
│   │   ├── client.js        # 浏览器半（侧边栏图标 + 任务面板）
│   │   └── host.js          # 服务器半（读取 schedule.json + state.json）
│   ├── cordis.patch.yml     # Cordis 组合声明
│   ├── index.js
│   └── package.json
└── dsh-our-free-model/      # OFM 免费模型插件
    ├── src/                 # 核心模块（adapter/catalog/forward/probe 等）
    ├── vendor/              # 运行时依赖（jet-hub wasm）
    ├── adapter/  catalog/  feed/  worker/
    ├── index.js             # 插件入口
    ├── client.js            # 浏览器半
    ├── cordis.patch.yml
    └── package.json
```

### 如何添加/移除插件

- **添加**：将新插件目录放入 `plugins/`，确保有 `package.json` + `cordis.patch.yml`，重新 `docker compose build --no-cache`。
- **移除**：从 `plugins/` 删除目录，重新 build。
- **自定义**：修改插件源码后重新 build，或挂载自定义插件目录到容器内 `/home/dshuser/.dsh/plugins/`。

---

## 安全与宿主机隔离设计

本部署方案从底层杜绝了容器内程序访问宿主机的可能：

1. **宿主机完全阻断（防火墙 INPUT 链拦截）**：
   - 执行 `./setup-security.sh` 会在 Linux 内核 `INPUT` 链中注入规则，**直接 DROP 容器子网（`172.28.0.0/16`）发送给宿主机的全部数据包**。
   - 容器内任何探测宿主机端口（如宿主机 SSH 22 端口、本地数据库等）的行为均会立即超时并丢弃。
2. **内网与云元数据阻断（DOCKER-USER 链拦截）**：
   - 阻断容器对私有子网（`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`）及云元数据地址（`169.254.169.254`）的路由访问。
3. **工作区隔离与持久化设计**：
   - **`/workspace`（持久化工作区）**：容器默认工作目录（`WORKDIR /workspace`），挂载独立 Docker 卷 `dsh_workspace`，归属于非特权用户 `dshuser:dshuser`。所有项目代码与生成物在容器重启或销毁后依然持久保存。
   - **`/tmp`（高速独立内存盘 tmpfs）**：挂载 1GB 内存 `tmpfs`（`rw,nosuid,nodev,size=1g`），具备标准 Linux `drwxrwxrwt` 权限。临时文件高速读写且容器重启自动彻底销毁，杜绝硬盘磨损与缓存泄露。
4. **无敏感挂载与特权剥夺**：
   - **绝不挂载** Docker Socket（`/var/run/docker.sock`）或宿主机根目录。数据存储使用独立的 Docker 卷（`dsh_data`, `dsh_workspace`）。
   - 剥离所有 Linux 内核特权（`cap_drop: [ALL]`）。
   - 阻止特权提权（`security_opt: [no-new-privileges=true]`）。
   - 强制使用低权限普通用户 `dshuser`（UID:GID `10001:10001`）运行。
5. **资源限制防打崩宿主机**：
   - 限制进程数（`pids: 256`）防止 Fork 炸弹，限制 CPU 与内存（`cpus: 2.0`, `memory: 4G`）避免宿主机资源耗尽。

---

## 快速启动与访问

### 第一步：加载安全防护规则
```bash
./setup-security.sh
```

### 第二步：启动容器
```bash
docker compose up -d
```

### 第三步：获取登录链接（含 Token）
查看容器输出的带 Token 访问链接：
```bash
docker compose logs --tail 10
```
你会看到如下日志输出：
```text
dsh web: http://127.0.0.1:3081/?token=<TOKEN>
```

### 第四步：在浏览器中打开

* **方式 A：通过 Cloud Shell 网页预览（如果在 Google Cloud Shell 中使用）**
  1. 点击 Cloud Shell 右上角 **「Web 预览」**（网页/电脑图标）。
  2. 点击 **「在端口 8080 上预览」**（默认端口即为 8080）。
  3. 在新打开的网页地址栏末尾拼接上刚才获取的 `?token=<TOKEN>` 即可登入。

* **方式 B：本地电脑 SSH 端口转发**
  本地电脑终端运行：
  ```bash
  gcloud cloud-shell ssh --ssh-flag="-L 8080:localhost:8080"
  # 或者原生 SSH:
  # ssh -L 8080:localhost:8080 user@your-server-ip
  ```
  在本地电脑浏览器访问：`http://localhost:8080/?token=<TOKEN>`

---

## 如何修改访问 IP 与端口（必读）

如果你需要将默认的 `0.0.0.0:3080` 改为其他端口（如 `8080`）、绑定特定 IP（如仅限 `127.0.0.1`），或通过自定义域名/局域网 IP 访问，请按下述两步进行修改：

### 1. 修改配置文件 `.env`

项目通过根目录下的 `.env` 文件（若不存在可复制自 `.env.example`）集中管理变量：

```bash
# ==============================================================================
# 1. 改变绑定的宿主机 IP (HOST_BIND)
# ==============================================================================
# 默认为 0.0.0.0（允许公网/局域网访问）。
# 如果希望仅宿主机本机可用（配合 SSH 隧道，最安全），设为：
HOST_BIND=127.0.0.1

# ==============================================================================
# 2. 改变对外暴露的端口 (HOST_PORT)
# ==============================================================================
# 默认为 3080。若需要改为 8080、9090 等，直接修改：
HOST_PORT=8080

# ==============================================================================
# 3. 改变安全信任域名/IP 白名单 (EXTRA_TRUSTED_HOSTS)  ★ 关键步骤
# ==============================================================================
# dsh 内置了严格的 Browser-Trust Fence 安全机制。
# 如果浏览器访问的 Host 不是默认的 localhost 或 127.0.0.1，
# 必须在此处显式加入该“域名”或“IP:端口”，否则调用 /api 时会返回 403 Forbidden！
# 
# 示例 1: 改成了 8080 端口并通过局域网 IP 访问：
EXTRA_TRUSTED_HOSTS="192.168.1.100:8080 localhost:8080"
#
# 示例 2: 使用了公网域名：
# EXTRA_TRUSTED_HOSTS="my-agent.example.com"
```

### 2. 重启容器使配置生效

修改 `.env` 后，在项目目录下执行：
```bash
docker compose up -d
```
Docker Compose 会自动检测到配置变更并重新加载容器。

---

## 常用运维管理命令

* **启动服务**：
  ```bash
  docker compose up -d
  ```
* **停止服务**：
  ```bash
  docker compose down
  ```
* **重启服务**：
  ```bash
  docker compose restart
  ```
* **查看容器实时日志与登录 Token**：
  ```bash
  docker compose logs -f
  ```
* **重新构建镜像（在修改 Dockerfile 或 entrypoint.sh 之后）**：
  ```bash
  docker compose build --no-cache
  docker compose up -d
  ```

---

## 镜像精简与层级优化说明

- 基础镜像采用官方最小化的 `node:22-bookworm-slim`。
- 构建逻辑将所有的依赖安装（`bash`、`curl`、`git`、`procps`、`python3`）、全局包安装（`@deepseek-ai/dsh`）、包缓存清除（`npm cache clean`、`apt-get purge`、`rm -rf /var/lib/apt/lists/*`）以及非特权用户创建收敛合并为**单一 RUN 指令层**。
- 最终镜像体积约 ~200MB（含三枚预装插件 ~8.5MB），层数精简，确保高速拉取与启动。
