#!/usr/bin/env bash
# 安装 dsh 本体与 native addon。构建期由 Dockerfile 调用。
#
# 为什么单独成脚本（而不是写在 RUN 续行里）：
#   1. RUN 续行里不能放 `#` 注释，逻辑一复杂就写不清；
#   2. npm 从 registry 拉 dsh 时网络容易 ECONNRESET（实测 2026-11-21 构建在
#      247s 时被 reset），需要显式重试 + 代理配置，这些都需要 if/循环。
#
# 代理：docker build 的 --build-arg HTTP_PROXY/HTTPS_PROXY 会在 RUN 期间以环境
# 变量形式存在，但 npm 对 https-proxy 的读取有时不生效（尤其是 registry 走代理
# 而 tarball 走直连的场景），所以这里显式写进 npm config。
set -euo pipefail

NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
DSH_VERSION="${DSH_VERSION:?DSH_VERSION 必须显式指定（rc 版本用 @latest 匹配不到）}"
NATIVE_ADDON_VERSION="${NATIVE_ADDON_VERSION:-0.1.9}"

echo "[dsh] registry=$NPM_REGISTRY version=$DSH_VERSION"

npm config set registry "$NPM_REGISTRY"
# 降低并发 + 加长超时/重试，显著减少大包安装时的 ECONNRESET
npm config set fetch-retries 6
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 180000
npm config set fetch-timeout 600000
npm config set maxsockets 4
npm config set audit false
npm config set fund false

# 代理：把 build-arg 透传的环境变量固化到 npm config（缺失则跳过）。
# npm 的合法 key 是 `proxy` 与 `https-proxy` —— 没有 `http-proxy`
#（写 `npm config set http-proxy ...` 会直接报 "is not a valid npm option"）。
if [ -n "${HTTP_PROXY:-}" ]; then
    npm config set proxy "$HTTP_PROXY"
    echo "[dsh] proxy=$HTTP_PROXY"
fi
if [ -n "${HTTPS_PROXY:-}" ]; then
    npm config set https-proxy "$HTTPS_PROXY"
    echo "[dsh] https-proxy=$HTTPS_PROXY"
fi

install_with_retry() {
    local desc="$1"; shift
    local attempt=1 max=4
    while [ "$attempt" -le "$max" ]; do
        echo "[dsh] ($attempt/$max) $desc"
        if "$@"; then
            echo "[dsh] $desc 成功"
            return 0
        fi
        echo "[dsh] !! $desc 第 $attempt 次失败，10s 后重试" >&2
        attempt=$((attempt + 1))
        sleep 10
        # 重试前清缓存，避免沿用坏的半包
        npm cache verify >/dev/null 2>&1 || true
    done
    echo "[dsh] !! $desc 连续 $max 次失败" >&2
    return 1
}

install_with_retry "安装 pnpm" npm install -g pnpm

# 显式固定 pnpm store 位置（必须在 pnpm 装好之后）。必须与运行期一致：dsh
# 运行期用的 store 在 $DSH_HOME/.pnpm-store（即 /home/dshuser/.dsh/.pnpm-store，
# 跟着数据卷一起持久化）。构建期若让它自动选（默认 ~/.pnpm-store），运行期
# 同步插件时会报
#   ERR_PNPM_UNEXPECTED_STORE: Unexpected store location
# （node_modules/.modules.yaml 里记录的 storeDir 与 pnpm 本次想用的不同）。
PNPM_STORE_DIR="${PNPM_STORE_DIR:-${DSH_HOME:-/home/dshuser/.dsh}/.pnpm-store}"
mkdir -p "$PNPM_STORE_DIR"
pnpm config set store-dir "$PNPM_STORE_DIR" --global
echo "[dsh] pnpm store-dir=$PNPM_STORE_DIR"

install_with_retry "安装 @deepseek-ai/dsh@${DSH_VERSION}" \
    npm install -g --omit=dev "@deepseek-ai/dsh@${DSH_VERSION}"
install_with_retry "安装 native addon" \
    npm install -g --omit=dev \
        "node-addon-require-builtin@${NATIVE_ADDON_VERSION}" \
        "node-addon-native-custom-loader@${NATIVE_ADDON_VERSION}"

# dsh 的官方 bin shim 在容器里跑不起来（它依赖 node 自带的某些 flag 组合），
# 这里换成直接调 lib/bin.js 的包装脚本。
rm -f /usr/local/bin/dsh
printf '#!/usr/bin/env bash\nexec node --expose-internals /usr/local/lib/node_modules/@deepseek-ai/dsh/lib/bin.js "$@"\n' > /usr/local/bin/dsh
chmod 755 /usr/local/bin/dsh

command -v dsh >/dev/null || { echo "[dsh] !! dsh 不在 PATH" >&2; exit 1; }
dsh --version || { echo "[dsh] !! dsh --version 执行失败" >&2; exit 1; }
echo "[dsh] 自检通过"
