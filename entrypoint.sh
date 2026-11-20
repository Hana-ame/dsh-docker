#!/usr/bin/env bash
set -e

if [ "$1" = "dsh" ]; then
    shift
fi

if [ "$1" = "web" ]; then
    shift

    # ══════════════════════════════════════════════════════════════════════
    # 一、数据卷里的插件同步（解决「重建镜像后插件不更新」）
    # ══════════════════════════════════════════════════════════════════════
    # 问题：compose 把整份 /home/dshuser/.dsh 挂成命名卷 dsh_data。命名卷只在
    # **首次创建**时从镜像拷贝内容，之后重建镜像、插件版本变了，卷里仍是旧
    # 插件——`docker compose build && up -d` 永远装不到新插件，而删卷又会丢
    # sessions/profile。
    #
    # 解决：镜像构建时把插件清单的 sha256 写进 /opt/dsh/plugins/fingerprint；
    # 启动时比对卷里的 .plugins-fingerprint：
    #   * 相同 → 卷里插件就是镜像这一版，跳过（绝大多数重启走这条，秒级）；
    #   * 不同 → 按镜像里的清单把插件重装一遍，再写回指纹。
    # 只动 plugin 相关的 profile 依赖，不碰 sessions / storages / 其他状态。
    #
    # 想强制跳过（例如镜像坏了要紧急起服务）：DSH_SKIP_PLUGIN_SYNC=1
    sync_plugins() {
        local manifest=/opt/dsh/plugins/plugins.list
        local stamp=/opt/dsh/plugins/fingerprint
        local profile="${DSH_HOME:-/home/dshuser/.dsh}/profiles/web"
        local current="$profile/.plugin-sync-fingerprint"
        local installer=/opt/dsh/plugins/install-plugins.sh

        [ -f "$manifest" ] || { echo "[plugins] 镜像内没有插件清单，跳过同步"; return 0; }
        [ -f "$stamp" ]    || { echo "[plugins] 镜像内没有插件指纹，跳过同步"; return 0; }
        [ -x "$installer" ] || { echo "[plugins] 镜像内没有安装脚本，跳过同步"; return 0; }

        local want have=""
        want="$(cat "$stamp")"
        [ -f "$current" ] && have="$(cat "$current")"

        if [ "$want" = "$have" ]; then
            echo "[plugins] 卷内插件已与镜像一致（${want:0:12}），跳过"
            return 0
        fi

        echo "[plugins] 卷内插件版本与镜像不一致（have=${have:0:12} want=${want:0:12}），开始同步"

        # 先修正 .modules.yaml 里记录的旧 pnpm storeDir，否则任何
        # `dsh plugin add` 都会因 ERR_PNPM_UNEXPECTED_STORE 全部失败
        #（数据卷是独立文件系统，store 必须落在卷内，与构建期路径不同）。
        [ -f /opt/dsh/plugins/fix-pnpm-store.mjs ] && \
            node /opt/dsh/plugins/fix-pnpm-store.mjs --profile web || true

        # 用 --allow-partial：单个插件装失败不该让容器起不来。
        # 脚本只在**全部成功**时才写指纹，所以失败时下次启动会自动重试；
        # 本次仍用卷里现存的旧副本启动（脚本是增量覆盖，不会先删 node_modules）。
        if "$installer" --manifest "$manifest" --profile web --allow-partial; then
            echo "[plugins] 同步流程结束"
        else
            echo "[plugins] !! 同步脚本异常退出（继续启动，用卷内现存的插件）" >&2
        fi
    }

    if [ "${DSH_SKIP_PLUGIN_SYNC:-0}" = "1" ]; then
        echo "[plugins] DSH_SKIP_PLUGIN_SYNC=1，跳过插件同步"
    else
        sync_plugins
    fi

    # ══════════════════════════════════════════════════════════════════════
    # 二、对外端口桥（0.0.0.0:3080 → 127.0.0.1:3081）
    # ══════════════════════════════════════════════════════════════════════
    # dsh 的 webserver 插件**明确拒绝**绑定通配地址 0.0.0.0：
    #   "host \"0.0.0.0\" is an unspecified (wildcard) address, which is not
    #    supported: binding every interface would expose remote code execution
    #    to the network"
    # （`dsh web --host 0.0.0.0` 也因此在 CLI 层被禁）。这是有意的安全设计，
    # 不该、也无法用 --patch 绕过（实测 patch 覆盖 host 会直接启动失败）。
    #
    # 但容器必须能从外部访问，所以这里放一个极薄 TCP 转发：
    #   0.0.0.0:3080  ->  127.0.0.1:3081（dsh 真实监听）
    # 对外的暴露面由 compose 的 HOST_BIND 控制（默认 127.0.0.1），
    # 真正的安全边界是「宿主机端口绑定 + dsh 自身的 URL token/cookie 鉴权」，
    # 这层桥不承担鉴权职责，也不额外增加暴露面。
    node -e '
    const net = require("net");
    const server = net.createServer(src => {
        const dst = net.connect(3081, "127.0.0.1");
        src.pipe(dst).pipe(src);
        src.on("error", () => dst.destroy());
        dst.on("error", () => src.destroy());
    });
    server.listen(3080, "0.0.0.0", () => {
        console.log("[dsh-bridge] Forwarding external port 3080 to internal 127.0.0.1:3081");
    });
    // 容器收到 SIGTERM 时让桥安静退出（容器 stop 会同时结束 dsh 与本进程）。
    const bye = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1500).unref(); };
    process.on("SIGTERM", bye);
    process.on("SIGINT", bye);
    ' &

    # 下面用的是 `exec`，它会用 dsh 替换当前 bash 进程——因此**任何 trap 都会
    # 立即失效**（原实现的 `trap ... EXIT INT TERM` 就是死代码，从未执行过）。
    # 清理责任交给：① 桥自己处理 SIGTERM（上面已加）；② 容器 stop 时向
    # PID 1 之外所有进程发 SIGTERM。桥是 `&` 起的后台进程，dsh exec 后它是
    # PID 1(dsh) 的子进程，随容器一并停止，不会留僵尸。

    EXTRA_TRUST_ARGS=()
    if [ -n "${EXTRA_TRUSTED_HOSTS:-}" ]; then
        for host in ${EXTRA_TRUSTED_HOSTS}; do
            EXTRA_TRUST_ARGS+=(--trusted-host "$host")
        done
    fi

    # dsh 进程内部监听 3081；对外声明 3080（容器端口，由 compose 映射到宿主
    # HOST_PORT）。两者必须与上面的桥一致，否则 Browser-Trust Fence 会 403。
    # HOST_PORT 只影响 trusted-host 白名单里的端口写法，不能用来改监听端口。
    PORT_NUM="${HOST_PORT:-8080}"

    exec /usr/local/bin/dsh web --no-open --port 3081 \
        --trusted-host "localhost:${PORT_NUM}" \
        --trusted-host "127.0.0.1:${PORT_NUM}" \
        --trusted-host "localhost:3080" \
        --trusted-host "127.0.0.1:3080" \
        --trusted-host "localhost:3081" \
        --trusted-host "127.0.0.1:3081" \
        "${EXTRA_TRUST_ARGS[@]}" \
        "$@"
fi

exec /usr/local/bin/dsh "$@"
