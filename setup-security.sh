#!/usr/bin/env bash
set -euo pipefail

# This script configures iptables in the DOCKER-USER chain to enforce complete network isolation:
# The dsh container (subnet 172.28.0.0/16) CANNOT reach the host or any private/internal networks.

SUBNET="172.28.0.0/16"
GATEWAY="172.28.0.1"

echo "[*] Applying security iptables rules for DSH container network ($SUBNET)..."

# Ensure DOCKER-USER chain exists
sudo iptables -N DOCKER-USER 2>/dev/null || true

# 1. Allow already established/related traffic
if ! sudo iptables -C DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null; then
    sudo iptables -I DOCKER-USER 1 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
fi

# 2. Block dsh container from reaching the host gateway
if ! sudo iptables -C DOCKER-USER -s "$SUBNET" -d "$GATEWAY" -j DROP 2>/dev/null; then
    sudo iptables -I DOCKER-USER 2 -s "$SUBNET" -d "$GATEWAY" -j DROP
fi

# 3. Block dsh container from accessing Cloud Metadata service (169.254.169.254)
if ! sudo iptables -C DOCKER-USER -s "$SUBNET" -d 169.254.169.254/32 -j DROP 2>/dev/null; then
    sudo iptables -I DOCKER-USER 3 -s "$SUBNET" -d 169.254.169.254/32 -j DROP
fi

# 4. Block dsh container from accessing internal host network (RFC1918 private subnets)
for private_net in "10.0.0.0/8" "172.16.0.0/12" "192.168.0.0/16"; do
    if ! sudo iptables -C DOCKER-USER -s "$SUBNET" -d "$private_net" -j DROP 2>/dev/null; then
        sudo iptables -A DOCKER-USER -s "$SUBNET" -d "$private_net" -j DROP
    fi
done

echo "[+] Security rules applied successfully."
echo "    - Outbound internet (DeepSeek API) is allowed."
echo "    - Access to host gateway, private subnets, and metadata service is BLOCKED."
