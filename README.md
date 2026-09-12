# Hardened DeepSeek Harness (`dsh`) in Docker

Production-ready Docker environment for running **DeepSeek Harness (`dsh`)** Web UI with strict host isolation, minimal container image layers, and preconfigured security policies.

---

## Architecture & Security Highlights

### 1. Complete Host Isolation ("Cannot Access the Host")
- **Host System Block**: `setup-security.sh` injects `INPUT` chain `iptables` rules that drop all incoming traffic from the container subnet (`172.28.0.0/16`) to the host. Any attempt from inside the container to connect to host ports (e.g. SSH on port 22, host databases, or daemon services) will immediately time out.
- **Internal Subnet & Cloud Metadata Shield**: Rules in `DOCKER-USER` block access to cloud metadata (`169.254.169.254`) and private RFC1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- **No Host Sockets or Sensitive Directories**: No `/var/run/docker.sock` and no host filesystem directories are mounted. Only isolated Docker volumes are used (`dsh_data` and `dsh_workspace`).
- **Unprivileged Non-Root Execution**: Runs as dedicated user `dshuser` (UID:GID `10001:10001`).
- **Linux Capability Stripping**: All kernel capabilities are dropped (`cap_drop: [ALL]`).
- **No Privilege Escalation**: `security_opt: [no-new-privileges:true]`.
- **Resource Constraints**: PID limit (`pids: 256`), memory (`4G`), and CPU limits (`2.0`) prevent host resource starvation or fork-bombs.

### 2. Layer & Build Optimization
- Built on `node:22-bookworm-slim`.
- Utilizes a single consolidated `RUN` layer to bundle system tools, `@deepseek-ai/dsh`, package cache cleanups, and user setup.
- Minimizes image size (~180MB) and ensures fast layer caching.

### 3. Loopback Bridge Architecture
Because `dsh web` enforces loopback binding (`127.0.0.1`) for browser security, an internal lightweight Layer-4 TCP bridge forwards external traffic from `0.0.0.0:3080` to internal `127.0.0.1:3081`, maintaining full WebSocket, SSE, and HTTP streaming support while satisfying the security constraints.

---

## Quick Start

### 1. (Optional) Configuration
```bash
cp .env.example .env
```

### 2. Apply Security Rules
```bash
./setup-security.sh
```

### 3. Build and Start Container
```bash
docker compose up -d --build
```

### 4. Retrieve Access Token & Open Browser
View container logs to get the session access URL with authentication token:
```bash
docker compose logs
```
Look for:
```
dsh web: http://127.0.0.1:3081/?token=<TOKEN>
```
Access in your browser using port `3080`:
```
http://localhost:3080/?token=<TOKEN>
```

---

## Verification & Security Testing

- **Verify non-root user**:
  ```bash
  docker compose exec dsh id
  # Expected: uid=10001(dshuser) gid=10001(dshuser)
  ```

- **Verify container cannot reach the host**:
  ```bash
  # Attempt to connect to host SSH (port 22) - will time out:
  docker compose exec dsh curl -m 2 http://172.28.0.1:22
  ```

- **Verify outbound internet works for DeepSeek API**:
  ```bash
  docker compose exec dsh curl -m 3 -Is https://api.deepseek.com
  ```

- **Stop container**:
  ```bash
  docker compose down
  ```
