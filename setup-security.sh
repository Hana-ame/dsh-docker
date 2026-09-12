#!/usr/bin/env bash
set -euo pipefail

# This script configures iptables in both the INPUT and DOCKER-USER chains
# to enforce complete host isolation:
# The dsh container (subnet 172.28.0.0/16) CANNOT reach the host or any private/internal networks.

SUBNET="172.28.0.0/16"

echo "[*] Applying security iptables rules for DSH container network ($SUBNET)..."

# ==============================================================================
# 1. Protect the HOST itself (INPUT chain)
# ==============================================================================
# Allow established and related connections (replies to connections initiated by host)
if ! sudo iptables -C INPUT -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 1 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
fi

# Block any new incoming connection from the container subnet to the host
if ! sudo iptables -C INPUT -s "$SUBNET" -j DROP 2>/dev/null; then
    sudo iptables -I INPUT 2 -s "$SUBNET" -j DROP
fi

# ==============================================================================
# 2. Protect FORWARDED traffic (DOCKER-USER chain)
# ==============================================================================
sudo iptables -N DOCKER-USER 2>/dev/null || true

# Allow established/related forwarding
if ! sudo iptables -C DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null; then
    sudo iptables -I DOCKER-USER 1 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
fi

# Block container from accessing Cloud Metadata service (169.254.169.254)
if ! sudo iptables -C DOCKER-USER -s "$SUBNET" -d 169.254.169.254/32 -j DROP 2>/dev/null; then
    sudo iptables -I DOCKER-USER 2 -s "$SUBNET" -d 169.254.169.254/32 -j DROP
fi

# Block container from accessing internal RFC1918 private subnets
for private_net in "10.0.0.0/8" "172.16.0.0/12" "192.168.0.0/16"; do
    if ! sudo iptables -C DOCKER-USER -s "$SUBNET" -d "$private_net" -j DROP 2>/dev/null; then
        sudo iptables -A DOCKER-USER -s "$SUBNET" -d "$private_net" -j DROP
    fi
done

echo "[+] Security rules applied successfully."
echo "    - Outbound internet (DeepSeek API, package registries) is allowed."
echo "    - Access to the host system is BLOCKED (via INPUT chain DROP)."
echo "    - Access to private internal subnets & cloud metadata is BLOCKED (via DOCKER-USER DROP)."
