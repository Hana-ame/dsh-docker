#!/usr/bin/env bash
# 把 plugins.list 里每条 GitHub 插件 spec 刷新到对应仓库 main 分支的最新 commit。
#
# 为什么需要它：plugins.list 故意钉死 commit（保证镜像可复现），
# 所以「升级插件」是一个显式动作，而不是每次 build 自动漂移。
#
# 用法：
#   ./scripts/bump-plugins.sh            # 改写 plugins.list
#   ./scripts/bump-plugins.sh --dry-run  # 只打印将要发生的变更
#
# 依赖：curl + python3。私有仓库场景可先 export GITHUB_TOKEN=...
set -euo pipefail

cd "$(dirname "$0")/.."

LIST="plugins.list"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

[ -f "$LIST" ] || { echo "找不到 $LIST" >&2; exit 1; }

api_headers=(-H "Accept: application/vnd.github+json")
[ -n "${GITHUB_TOKEN:-}" ] && api_headers+=(-H "Authorization: Bearer ${GITHUB_TOKEN}")

changed=0
out="$(mktemp)"
trap 'rm -f "$out"' EXIT

while IFS= read -r line || [ -n "$line" ]; do
    # 只处理生效行：git+https 开头的 spec
    case "$line" in
        git+https://github.com/*)
            repo_path="${line#git+https://github.com/}"   # owner/repo.git#sha
            repo_path="${repo_path%%.git*}"                # owner/repo
            old_sha=""
            case "$line" in *"#"*) old_sha="${line##*#}" ;; esac

            new_sha=""
            for br in main master; do
                body="$(curl -sf -m 15 "${api_headers[@]}" \
                    "https://api.github.com/repos/${repo_path}/commits/${br}" 2>/dev/null || true)"
                [ -n "$body" ] || continue
                new_sha="$(printf '%s' "$body" | python3 -c 'import sys,json
try: print(json.load(sys.stdin)["sha"])
except Exception: print("")' 2>/dev/null || true)"
                [ -n "$new_sha" ] && break
            done

            if [ -z "$new_sha" ]; then
                echo "!! ${repo_path}: 取不到最新 commit（网络/权限/仓库改名？），保持原值" >&2
                printf '%s\n' "$line" >> "$out"
                continue
            fi

            new_line="git+https://github.com/${repo_path}.git#${new_sha}"
            if [ "$new_line" != "$line" ]; then
                echo "${repo_path}: ${old_sha:0:12} -> ${new_sha:0:12}"
                changed=$((changed + 1))
            fi
            printf '%s\n' "$new_line" >> "$out"
            ;;
        *)
            printf '%s\n' "$line" >> "$out"
            ;;
    esac
done < "$LIST"

if [ "$changed" -eq 0 ]; then
    echo "所有插件已是最新，未改动 $LIST"
    exit 0
fi

if [ "$DRY_RUN" -eq 1 ]; then
    echo "--dry-run：将更新 ${changed} 条，未写盘"
    exit 0
fi

cp "$out" "$LIST"
echo "已更新 ${changed} 条 -> $LIST（记得重建镜像：docker compose build）"
