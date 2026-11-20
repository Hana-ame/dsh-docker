FROM node:22-bookworm-slim

# ══════════════════════════════════════════════════════════════════════════════
# 可切换的镜像源与版本（国内默认；海外构建用 --build-arg 覆盖）
# ══════════════════════════════════════════════════════════════════════════════
#   docker build \
#     --build-arg DEBIAN_MIRROR=deb.debian.org \
#     --build-arg NPM_REGISTRY=https://registry.npmjs.org \
#     --build-arg DSH_VERSION=0.2.2-rc.2 .
#
# DSH_VERSION 必须显式给出：这是 rc 预发布版本，`@latest` / `*` 都匹配不到。
ARG DEBIAN_MIRROR=mirrors.ustc.edu.cn
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG DSH_VERSION=0.2.2-rc.2
ARG NATIVE_ADDON_VERSION=0.1.9

# 构建期代理（插件 / npm 从 GitHub 拉取时需要）
ARG HTTP_PROXY=""
ARG HTTPS_PROXY=""
ARG NO_PROXY=""

# 安装脚本必须在第一个 RUN 之前拷进来。
# 为什么把 apt / npm 逻辑挪进脚本：Dockerfile 的 RUN 续行里**不能**放 `#` 注释
# 行——续行会被拼成同一条 shell 命令，`#` 会把后面全部内容注释掉，导致命令被
# 截断（这个坑在本仓库踩过多次）。脚本里可以自由写注释和 if/else。
COPY --chmod=755 scripts/install-base.sh /opt/dsh/install-base.sh
COPY --chmod=755 scripts/install-dsh.sh /opt/dsh/install-dsh.sh

# ── 阶段 1：系统依赖 + dsh 本体 + 非特权用户（单层）─────────────────────────
# install-base.sh 负责 apt（含镜像源 Hash Sum mismatch 时回退官方源），并在
# 结束时自检 git/curl/python3 确实可用——否则后续插件安装会以
#「dsh: not found」这种完全无关的形态失败，极难排查。
# npm 缓存用 buildkit cache mount：dsh 本体及其依赖体积大，网络偶发 reset，
# 缓存命中后重试很快，不必每次从头下 40+ MB。
RUN --mount=type=cache,target=/root/.npm-cache,sharing=locked set -eux; \
    export npm_config_cache=/root/.npm-cache; \
    /opt/dsh/install-base.sh; \
    /opt/dsh/install-dsh.sh; \
    apt-get purge -y python3-pip python3-venv || true; \
    apt-get autoremove -y || true; \
    rm -rf /var/lib/apt/lists/* /tmp/*; \
    useradd -m -u 10001 -s /bin/bash dshuser; \
    mkdir -p /home/dshuser/.dsh /workspace; \
    mkdir -p /opt/dsh/plugins; \
    printf 'registry=%s\nauto-install-peers=false\n' "${NPM_REGISTRY}" > /home/dshuser/.npmrc; \
    chown -R dshuser:dshuser /home/dshuser /workspace /opt/dsh

# ── 阶段 2：插件清单与脚本 ──────────────────────────────────────────────────
# 这几份文件同时留在镜像的 /opt/dsh/plugins/ 下——容器启动时 entrypoint 要用
# 它们把「镜像里的插件版本」同步进数据卷（见 entrypoint.sh 的同步段）：
#   plugins.list        插件清单（指纹来源）
#   install-plugins.sh  安装/同步逻辑（构建期与运行期共用）
#   enable-bundles.mjs  登记 dsh.profile.bundles
#   fix-pnpm-store.mjs  修正 .modules.yaml 里的 storeDir
COPY --chown=10001:10001 plugins.list /tmp/dsh-plugins/plugins.list
COPY --chown=10001:10001 scripts/enable-bundles.mjs /tmp/dsh-plugins/enable-bundles.mjs
COPY --chown=10001:10001 scripts/install-plugins.sh /tmp/dsh-plugins/install-plugins.sh
COPY --chown=10001:10001 scripts/fix-pnpm-store.mjs /tmp/dsh-plugins/fix-pnpm-store.mjs

COPY --chmod=755 entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER 10001:10001
WORKDIR /workspace

ENV HOME=/home/dshuser \
    DSH_HOME=/home/dshuser/.dsh \
    NODE_ENV=production

# ── 阶段 3：安装插件 + 记录指纹（单层）──────────────────────────────────────
# 插件安装逻辑抽到 scripts/install-plugins.sh，构建期与容器启动期共用同一份，
# 避免两处 shell 逻辑漂移。该脚本内部用 `|| [ -n "$spec" ]` 兜住
#「文件末尾缺换行时 read 返回非 0 且丢掉最后一行 → 静默少装一个插件」。
#
# 指纹 = plugins.list 的 sha256，写进镜像；容器启动时比对卷里的指纹决定是否
# 需要重新同步插件（解决「整卷挂载导致重建镜像后插件永不更新」）。
# 注意：这里**不能**给 pnpm store 用 cache mount。
#   1. pnpm 用硬链接把 node_modules 链到 store；store 若落在临时的 cache mount
#      里，最终镜像中的 node_modules 会指向不存在的文件。
#   2. cache mount 是独立文件系统，pnpm 检测到「store 与项目不在同一盘」时会
#      自动把 store 换到项目旁（`<home>/.pnpm-store`），导致构建期与运行期
#      store 位置不一致 → 运行期同步报 ERR_PNPM_UNEXPECTED_STORE。
# store 位置改由 install-dsh.sh 显式固定（构建期与运行期同一条配置）。
RUN set -eux; \
    chmod 755 /tmp/dsh-plugins/install-plugins.sh; \
    mkdir -p /opt/dsh/plugins; \
    /tmp/dsh-plugins/install-plugins.sh \
        --manifest /tmp/dsh-plugins/plugins.list \
        --profile web \
        --manifest-copy /opt/dsh/plugins/plugins.list; \
    dsh --profile web --dump-config > /dev/null; \
    cp /tmp/dsh-plugins/install-plugins.sh /opt/dsh/plugins/install-plugins.sh; \
    cp /tmp/dsh-plugins/enable-bundles.mjs /opt/dsh/plugins/enable-bundles.mjs; \
    cp /tmp/dsh-plugins/fix-pnpm-store.mjs /opt/dsh/plugins/fix-pnpm-store.mjs; \
    node /tmp/dsh-plugins/fix-pnpm-store.mjs --profile web; \
    chmod 755 /opt/dsh/plugins/install-plugins.sh; \
    chmod 644 /opt/dsh/plugins/plugins.list /opt/dsh/plugins/enable-bundles.mjs; \
    chown -R dshuser:dshuser /opt/dsh; \
    sha256sum /opt/dsh/plugins/plugins.list | cut -d' ' -f1 > /opt/dsh/plugins/fingerprint; \
    chmod 644 /opt/dsh/plugins/fingerprint; \
    cp /opt/dsh/plugins/fingerprint /home/dshuser/.dsh/profiles/web/.plugin-sync-fingerprint; \
    chown dshuser:dshuser /home/dshuser/.dsh/profiles/web/.plugin-sync-fingerprint; \
    rm -rf /tmp/dsh-plugins /home/dshuser/.npm

# 对外是容器内 TCP 桥的端口；dsh 真实监听 127.0.0.1:3081（见 entrypoint.sh）。
EXPOSE 3080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["web"]
