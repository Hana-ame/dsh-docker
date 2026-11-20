#!/usr/bin/env bash
# 安装运行期依赖（apt 包）。构建期由 Dockerfile 调用。
#
# 为什么要单独成脚本：
#   1. Dockerfile 的 RUN 续行里**不能**放 `#` 注释行——它会被拼进同一条 shell
#      命令并注释掉后续内容，导致命令截断（踩过多次）。
#   2. apt 镜像源偶发「Hash Sum mismatch」（CDN 缓存了损坏/旧版 deb，实测
#      2026-11-21 构建时 libpython3.11-minimal 就撞上），需要有回退逻辑。
#
# 关键：**不能用 apt-get install --fix-missing**。它会跳过下载失败的包继续
# dpkg 配置，导致 perl 未 configure → git 依赖不满足 → git 命令不可用 →
# 后续所有插件安装全失败（表面症状是 "dsh: not found" 但真正原因在这）。
# 正确做法是让 apt 整体失败，然后换官方源整体重试。
set -euo pipefail

DEBIAN_MIRROR="${DEBIAN_MIRROR:-mirrors.ustc.edu.cn}"

PKGS=(bash curl git ca-certificates procps python3 python3-pip python3-venv python-is-python3)

rewrite_sources() {
    local mirror="$1"
    for f in /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list; do
        [ -f "$f" ] || continue
        # 把当前 mirror / 官方源统一改写成目标 mirror
        sed -i "s|deb.debian.org|${mirror}|g; s|security.debian.org|${mirror}|g" "$f"
        # 若文件里还残留别的已知镜像，也一并改写
        sed -i "s|mirrors.ustc.edu.cn|${mirror}|g; s|mirrors.aliyun.com|${mirror}|g; s|mirrors.tuna.tsinghua.edu.cn|${mirror}|g" "$f"
    done
}

try_install() {
    apt-get -o Acquire::Retries=5 update
    apt-get install -y --no-install-recommends "${PKGS[@]}"
}

echo "[base] 使用镜像源：$DEBIAN_MIRROR"
rewrite_sources "$DEBIAN_MIRROR"

if try_install; then
    echo "[base] 依赖安装完成（$DEBIAN_MIRROR）"
else
    echo "[base] !! 镜像源安装失败，回退官方源重试" >&2
    # apt 失败可能留下未 configure 的包；先尝试修复再重试。
    dpkg --configure -a || true
    apt-get -f install -y || true
    rewrite_sources "deb.debian.org"
    rm -rf /var/lib/apt/lists/*
    try_install
    echo "[base] 依赖安装完成（官方源回退）"
fi

# 自检：git / curl 必须真的可用，否则后续插件安装会以「dsh: not found」
# 之类完全无关的形态失败，极难排查。
for bin in git curl python3; do
    command -v "$bin" >/dev/null || { echo "[base] !! $bin 不在 PATH 中，安装失败" >&2; exit 1; }
done
git --version
curl --version | head -1
echo "[base] 自检通过"
