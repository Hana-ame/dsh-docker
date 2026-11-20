#!/usr/bin/env bash
set -euo pipefail

# dsh-docker 宿主机隔离规则。
#
# 目标：dsh 容器（默认子网 172.28.0.0/16）不能访问
#   - 宿主机本身
#   - 云元数据服务 169.254.169.254
#   - 除本容器网络以外的任何 RFC1918 私网（含宿主机所在的局域网）
# 但仍然允许：
#   - 出站公网（DeepSeek API / npm / GitHub）
#   - **同一容器网络内互通**（多实例互测必需；容器子网本身就落在 RFC1918 里）
#
# 关键实现约束（踩过的坑）：
# 1. **必须用 `-I` 插入，不能用 `-A` 追加**。Docker 在 DOCKER-USER 链末尾有自动
#    维护的 `-j RETURN`；`-A` 加在它后面 = 永远不执行（规则形同不存在）。
# 2. **`-I` 会把顺序反过来**。逐条 `-I chain 1` 的结果是最后一条跑到了最前面，
#    所以本脚本按**倒序**遍历期望顺序，最终链内顺序与 RULES_* 字面顺序一致。
#    否则「先 ACCEPT 同网段、再 DROP 私网」这类顺序敏感的规则会被颠倒而失效。
# 3. **必须先放行同容器子网**。容器子网 172.28.0.0/16 落在 172.16.0.0/12 之内，
#    直接 DROP 掉 172.16.0.0/12 会连带把容器之间的通信一起封死。
# 4. **IPv4 与 IPv6 都要配**。只配 iptables 时，宿主机启用 IPv6 后容器可经
#    IPv6 直连私网/宿主机，隔离被绕过。
# 5. **规则不持久**，重启即失效。用 --persist 安装 systemd unit 做开机自动应用。
#
# 用法：
#   sudo ./setup-security.sh              # 应用规则（IPv6 需设 DSH_SUBNET6 才配）
#   sudo ./setup-security.sh --persist    # 应用并安装 systemd 开机自启
#   sudo ./setup-security.sh --remove     # 移除本脚本添加的规则
#   sudo ./setup-security.sh --dry-run    # 只打印将执行的命令，不落规则
#   ./setup-security.sh --help
#
# 环境变量：
#   DSH_SUBNET=172.28.0.0/16     容器 IPv4 子网（必须与 compose 的 DSH_SUBNET 一致）
#   DSH_SUBNET6=fd00:172:28::/64 容器 IPv6 子网（可选；compose 启用 IPv6 时填）

SUBNET="${DSH_SUBNET:-172.28.0.0/16}"
SUBNET6="${DSH_SUBNET6:-}"

MODE="apply"
for arg in "$@"; do
  case "$arg" in
    --persist) MODE="persist" ;;
    --remove) MODE="remove" ;;
    --dry-run) MODE="dry-run" ;;
    -h|--help) sed -n '2,48p' "$0"; exit 0 ;;
    *) echo "未知参数: $arg" >&2; exit 2 ;;
  esac
done

# ── 工具检测 ────────────────────────────────────────────────────────────────
# 用数组承载「sudo + 命令」，避免把 `$SUDO iptables` 拼成字符串后
# 在函数里被 word-splitting 搞错参数位置（SUDO 为空时尤其容易踩）。
IPT=(iptables)
IPT6=(ip6tables)
[ "$(id -u)" -ne 0 ] && { IPT=(sudo iptables); IPT6=(sudo ip6tables); }
command -v iptables >/dev/null 2>&1 || { echo "缺少 iptables，请先安装" >&2; exit 1; }
IPV6_OK=0
command -v ip6tables >/dev/null 2>&1 && IPV6_OK=1

run() {
  if [ "$MODE" = "dry-run" ]; then echo "  [dry-run] $*"; else "$@"; fi
}

# ── 规则定义（**字面顺序 = 最终链内顺序**）─────────────────────────────────
# 格式：链|规则串
#
# INPUT：宿主机上 terminate 的流量。默认 DROP 整条容器子网，
#        但仍要先放行 ESTABLISHED/RELATED，避免把已建立的容器外联回包掐掉。
RULES4_INPUT=(
  "INPUT|-m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT"
  "INPUT|-s $SUBNET -j DROP"
)

# DOCKER-USER：容器转发出去的流量（DNAT 之后、FORWARD 之前）。
# 顺序极其重要：
#   ① 同容器子网互通 → 必须最先 ACCEPT（它落在下面 172.16/12 的范围内）
#   ② 已建立连接的回包
#   ③ 云元数据
#   ④ RFC1918 其余私网
RULES4_DOCKER=(
  "DOCKER-USER|-s $SUBNET -d $SUBNET -j ACCEPT"
  "DOCKER-USER|-m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT"
  "DOCKER-USER|-s $SUBNET -d 169.254.169.254/32 -j DROP"
  "DOCKER-USER|-s $SUBNET -d 10.0.0.0/8 -j DROP"
  "DOCKER-USER|-s $SUBNET -d 172.16.0.0/12 -j DROP"
  "DOCKER-USER|-s $SUBNET -d 192.168.0.0/16 -j DROP"
)

RULES6_INPUT=(
  "INPUT|-m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT"
  "INPUT|-s $SUBNET6 -j DROP"
)

# IPv6 私网：fc00::/7（ULA）+ fe80::/10（链路本地）。同样先放行同子网互通。
RULES6_DOCKER=(
  "DOCKER-USER|-s $SUBNET6 -d $SUBNET6 -j ACCEPT"
  "DOCKER-USER|-m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT"
  "DOCKER-USER|-s $SUBNET6 -d fc00::/7 -j DROP"
  "DOCKER-USER|-s $SUBNET6 -d fe80::/10 -j DROP"
)

# 按「倒序插入到链首」实现：遍历期望顺序的逆序，每条 -I <chain> 1，
# 插完链内顺序即等于期望顺序。
# apply_rules <ipt|ipt6> <规则...>
apply_rules() {
  local which=$1; shift
  local -a bin=( "${IPT[@]}" ); [ "$which" = "ipt6" ] && bin=( "${IPT6[@]}" )
  local -a entries=( "$@" )
  local idx entry chain rule
  for (( idx=${#entries[@]}-1 ; idx>=0 ; idx-- )); do
    entry="${entries[idx]}"
    chain="${entry%%|*}"
    rule="${entry#*|}"
    if "${bin[@]}" -C "$chain" $rule 2>/dev/null; then
      echo "  [=] $chain: $rule"
      continue
    fi
    run "${bin[@]}" -I "$chain" 1 $rule
    echo "  [+] $chain: $rule"
  done
}

remove_rules() {
  local which=$1; shift
  local -a bin=( "${IPT[@]}" ); [ "$which" = "ipt6" ] && bin=( "${IPT6[@]}" )
  local entry chain rule
  for entry in "$@"; do
    chain="${entry%%|*}"
    rule="${entry#*|}"
    while "${bin[@]}" -C "$chain" $rule 2>/dev/null; do
      run "${bin[@]}" -D "$chain" $rule
      echo "  [-] $chain: $rule"
    done
  done
}

# ensure_chain <ipt|ipt6> <链名>
ensure_chain() {
  local which=$1 chain=$2
  local -a bin=( "${IPT[@]}" ); [ "$which" = "ipt6" ] && bin=( "${IPT6[@]}" )
  if ! "${bin[@]}" -S "$chain" >/dev/null 2>&1; then
    echo "[*] $chain 链不存在，创建并加默认 RETURN"
    run "${bin[@]}" -N "$chain"
    run "${bin[@]}" -A "$chain" -j RETURN
  fi
}

persist_unit() {
  local self unit="/etc/systemd/system/dsh-docker-security.service"
  self="$(readlink -f "$0")"
  echo "[*] 安装开机自启：$unit"
  if [ "$MODE" = "dry-run" ]; then echo "  [dry-run] 写入 $unit 并 enable"; return; fi
  cat > "$unit" <<UNIT
[Unit]
Description=dsh-docker host isolation iptables rules
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
Environment=DSH_SUBNET=${SUBNET}
Environment=DSH_SUBNET6=${SUBNET6}
ExecStart=${self}
ExecStop=${self} --remove

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable dsh-docker-security.service
  echo "  已启用。注意：\`systemctl restart docker\` 会重建 DOCKER-USER 链，之后需重跑本脚本。"
}

# ── 主流程 ─────────────────────────────────────────────────────────────────
echo "[*] dsh-docker 宿主机隔离（subnet=$SUBNET, subnet6=${SUBNET6:-<未启用>}, mode=$MODE）"

if [ "$MODE" = "remove" ]; then
  echo "[*] 移除 IPv4 规则…"
  remove_rules ipt "${RULES4_INPUT[@]}" "${RULES4_DOCKER[@]}"
  if [ -n "$SUBNET6" ] && [ "$IPV6_OK" = "1" ]; then
    echo "[*] 移除 IPv6 规则…"
    remove_rules ipt6 "${RULES6_INPUT[@]}" "${RULES6_DOCKER[@]}"
  fi
  echo "[+] 已移除。"
  exit 0
fi

ensure_chain ipt DOCKER-USER
echo "[*] IPv4 规则（宿主 INPUT）"
apply_rules ipt "${RULES4_INPUT[@]}"
echo "[*] IPv4 规则（DOCKER-USER）"
apply_rules ipt "${RULES4_DOCKER[@]}"

if [ -n "$SUBNET6" ] && [ "$IPV6_OK" = "1" ]; then
  ensure_chain ipt6 DOCKER-USER
  echo "[*] IPv6 规则（宿主 INPUT）"
  apply_rules ipt6 "${RULES6_INPUT[@]}"
  echo "[*] IPv6 规则（DOCKER-USER）"
  apply_rules ipt6 "${RULES6_DOCKER[@]}"
else
  echo "  [skip] 未配置 IPv6 隔离（容器未启用 IPv6，或未设 DSH_SUBNET6）"
fi

[ "$MODE" = "persist" ] && persist_unit

echo "[+] 完成。当前 DOCKER-USER（前 12 条，应能看见 DROP 出现在 RETURN 之前）："
"${IPT[@]}" -S DOCKER-USER 2>/dev/null | head -12 || true

cat <<'INFO'

[*] 验证（应当都被 BLOCK）：
    # 云元数据
    docker compose exec dsh sh -c 'curl -m3 -s http://169.254.169.254/ >/dev/null && echo LEAK || echo "metadata blocked OK"'
    # 宿主机
    docker compose exec dsh sh -c 'curl -m3 -s http://<宿主机局域网IP>:22 >/dev/null && echo LEAK || echo "host blocked OK"'
    # 公网仍应通（放行）
    docker compose exec dsh sh -c 'curl -m5 -sI https://api.deepseek.com | head -1'
    # 同网段两容器互通必须正常（不应被隔离误杀）
    docker compose exec dsh sh -c 'curl -m3 -s -o /dev/null -w "%{http_code}\n" http://172.28.0.11:3080/ || true'

[*] 说明：
    - 规则只约束「容器 → 外面」，不影响你从宿主机/局域网访问容器映射出的端口。
      （端口发布走 DNAT/FORWARD 而非 INPUT，且 probe 由宿主发起。）
    - 宿主启用 IPv6 且容器有 IPv6 地址时，必须设 DSH_SUBNET6 才生效。
    - 容器子网必须与 compose 的 DSH_SUBNET 一致，否则规则匹配不到任何流量。
INFO
