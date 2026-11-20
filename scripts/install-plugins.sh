#!/usr/bin/env bash
# 按清单安装 / 同步 dsh 插件。构建期与容器启动期**共用同一份逻辑**，
# 保证「镜像里装出来的插件」和「卷里同步出来的插件」完全一致。
#
# 用法：
#   install-plugins.sh --manifest <plugins.list> [选项]
#
# 选项：
#   --profile web            要装的 dsh profile（默认 web）
#   --allow-partial          单个插件失败时继续（运行期用；构建期不要用）
#   --no-fingerprint         不写指纹
#   --fingerprint <path>     指纹输出路径（默认 <DSH_HOME>/profiles/<profile>/.plugin-sync-fingerprint）
#   --manifest-copy <path>   把清单一并复制到该路径（构建期留在镜像里用）
#
# 退出码：0 全部成功；1 有插件失败（--allow-partial 时仍返回 0，但会打印告警）
set -euo pipefail

MANIFEST=""
PROFILE="web"
ALLOW_PARTIAL=0
WRITE_FP=1
FP_PATH=""
MANIFEST_COPY=""

while [ $# -gt 0 ]; do
    case "$1" in
        --manifest)      MANIFEST="$2"; shift 2 ;;
        --profile)       PROFILE="$2"; shift 2 ;;
        --allow-partial) ALLOW_PARTIAL=1; shift ;;
        --no-fingerprint) WRITE_FP=0; shift ;;
        --fingerprint)   FP_PATH="$2"; shift 2 ;;
        --manifest-copy) MANIFEST_COPY="$2"; shift 2 ;;
        *) echo "未知参数: $1" >&2; exit 2 ;;
    esac
done

[ -n "$MANIFEST" ] || { echo "必须给 --manifest" >&2; exit 2; }
[ -f "$MANIFEST" ] || { echo "清单不存在: $MANIFEST" >&2; exit 2; }

DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
[ -n "$FP_PATH" ] || FP_PATH="$PROFILE_DIR/.plugin-sync-fingerprint"
mkdir -p "$PROFILE_DIR"

# ── 固定 pnpm store 位置（关键）───────────────────────────────────────────────
# 必须写在 **profile 自己的 .npmrc** 里，而不是 ~/.npmrc 或 pnpm 全局配置：
# pnpm 处理某个项目时读的是该项目目录下的 .npmrc，用户级/全局配置在一些
# 调用路径（dsh 内部 spawn 的 pnpm）下并不生效。
#
# 位置必须是 $DSH_HOME/.pnpm-store —— 也就是和 node_modules **同一个文件系统**。
# pnpm 用硬链接把 node_modules 链到 store，跨文件系统时无法硬链接，它会：
#   1. 打印 "[WARN] The store at ... is not used because packages cannot be
#      hard linked from it into this project"
#   2. 自作主张换成项目旁的 store
#   3. 若 .modules.yaml 里记录的 storeDir 与本次想用的不同 → 直接
#      ERR_PNPM_UNEXPECTED_STORE 让所有插件安装失败。
# 运行期 $DSH_HOME 是数据卷（独立文件系统），所以 store 必须放进去；
# 构建期同样写这里，两边才能对上。
PNPM_STORE_DIR="${PNPM_STORE_DIR:-$DSH_HOME/.pnpm-store}"
mkdir -p "$PNPM_STORE_DIR"
NPMRC="$PROFILE_DIR/.npmrc"
touch "$NPMRC"
if grep -q '^store-dir=' "$NPMRC" 2>/dev/null; then
    sed -i "s|^store-dir=.*|store-dir=${PNPM_STORE_DIR}|" "$NPMRC"
else
    printf 'store-dir=%s\n' "$PNPM_STORE_DIR" >> "$NPMRC"
fi
echo "[plugins] pnpm store-dir=$PNPM_STORE_DIR（写入 $NPMRC）"

# ── 修正已有的 node_modules/.modules.yaml ────────────────────────────────────
# 即使 .npmrc 里 store-dir 写对了，只要 node_modules/.modules.yaml 里记录的
# storeDir 是旧值（例如镜像构建时 pnpm 走了默认 store），后续任何
# `dsh plugin add` 都会直接失败：
#   ERR_PNPM_UNEXPECTED_STORE: Unexpected store location
# 这个字段只是 pnpm 的「上次用的是哪个 store」标记，改写成当前实际 store 即可
# 自愈（已实测：改写后 `dsh plugin add` 立刻成功，不需要重装 node_modules）。
MODULES_YAML="$PROFILE_DIR/node_modules/.modules.yaml"
if [ -f "$MODULES_YAML" ]; then
    node -e '
const fs = require("node:fs");
const [file, store] = process.argv.slice(1);
try {
  const raw = fs.readFileSync(file, "utf8");
  const cur = (raw.match(/^\s*"?storeDir"?\s*:\s*"?([^"\n,]+)"?/m) || [])[1];
  if (cur && cur.trim() === store + "/v11") { console.log("[plugins] .modules.yaml storeDir 已是正确值"); process.exit(0); }
  const next = raw.replace(/^(\s*)"?storeDir"?\s*:\s*"[^"]*"/m, `$1"storeDir": "${store}/v11"`);
  if (next === raw) { console.log("[plugins] .modules.yaml 无 storeDir 字段，跳过"); process.exit(0); }
  fs.writeFileSync(file, next);
  console.log(`[plugins] .modules.yaml storeDir: ${cur} -> ${store}/v11`);
} catch (e) { console.error("[plugins] !! 修正 .modules.yaml 失败:", String(e)); }
' "$MODULES_YAML" "$PNPM_STORE_DIR"
fi

# 清单一律先过滤成「生效行」，避免注释/空行进入安装循环。
RESOLVED="$(mktemp)"
trap 'rm -f "$RESOLVED"' EXIT
grep -vE '^[[:space:]]*(#|$)' "$MANIFEST" > "$RESOLVED" || true

total=0 ok=0 fail=0 failed_specs=()
while IFS= read -r spec || [ -n "$spec" ]; do
    [ -z "$spec" ] && continue
    total=$((total + 1))
    echo "[plugins] ($total) dsh plugin --profile $PROFILE add $spec"
    if dsh plugin --profile "$PROFILE" add "$spec"; then
        ok=$((ok + 1))
    else
        fail=$((fail + 1))
        failed_specs+=("$spec")
        echo "[plugins] !! 安装失败: $spec" >&2
    fi
done < "$RESOLVED"

# 登记 bundles（只 add 不登记的话，包在 node_modules 里但不会被加载）
ENABLE_BUNDLES="$(cd "$(dirname "$0")" && pwd)/enable-bundles.mjs"
if [ -f "$ENABLE_BUNDLES" ]; then
    DSH_HOME="$DSH_HOME" node "$ENABLE_BUNDLES" || echo "[plugins] !! enable-bundles 失败" >&2
else
    echo "[plugins] !! 找不到 enable-bundles.mjs，跳过登记" >&2
fi

# 指纹 = 清单文件的 sha256（清单内容决定装什么）
if [ "$WRITE_FP" = "1" ] && [ "$fail" -eq 0 ]; then
    mkdir -p "$(dirname "$FP_PATH")"
    sha256sum "$MANIFEST" | cut -d' ' -f1 > "$FP_PATH"
    echo "[plugins] 指纹已写入 $FP_PATH"
elif [ "$WRITE_FP" = "1" ]; then
    echo "[plugins] 有失败项，不写指纹（下次重试）" >&2
fi

if [ -n "$MANIFEST_COPY" ]; then
    mkdir -p "$(dirname "$MANIFEST_COPY")"
    cp "$MANIFEST" "$MANIFEST_COPY"
fi

echo "[plugins] 完成：总计 $total，成功 $ok，失败 $fail"
if [ "$fail" -gt 0 ]; then
    if [ "$ALLOW_PARTIAL" = "1" ]; then
        echo "[plugins] 允许部分失败继续启动；下次启动会重试这些条目：" >&2
        printf '  - %s\n' "${failed_specs[@]}" >&2
        exit 0
    fi
    echo "[plugins] 构建失败：以下插件无法安装" >&2
    printf '  - %s\n' "${failed_specs[@]}" >&2
    exit 1
fi
