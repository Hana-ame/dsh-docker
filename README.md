# dsh in Docker (Hardened & Isolated)

Production-ready Docker environment for running **DeepSeek Harness (`dsh`)** web interface with strict host isolation and minimal image layers.

## Security & Host Isolation Guarantees

This deployment is specifically designed so that **`dsh` inside the container cannot access the host**:

1. **Strict Network Isolation**:
   - Containers run in an isolated custom bridge network (`172.28.0.0/16`).
   - `setup-security.sh` configures `iptables` in the `DOCKER-USER` chain to explicitly **DROP** all traffic from the container to the host gateway (`172.28.0.1`), host private subnets (RFC1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and cloud metadata (`169.254.169.254`).
   - `host.docker.internal` is mapped to `127.0.0.1` to neutralize internal host resolution.
   - Public DNS (`8.8.8.8`, `1.1.1.1`) is configured to avoid leaking host resolver requests.
2. **No Host Sockets or Sensitive Mounts**:
   - No Docker daemon socket (`/var/run/docker.sock`) is mounted.
   - No host root or user filesystems are mounted; only isolated Docker named volumes (`dsh_data`, `dsh_workspace`) are used.
3. **Unprivileged Non-Root Execution**:
   - The container runs as unprivileged user `dshuser` (UID:GID `10001:10001`).
4. **Dropped Linux Capabilities & Privileges**:
   - `cap_drop: [ALL]` drops all Linux capabilities.
   - `security_opt: [no-new-privileges:true]` prevents privilege escalation through setuid/setgid binaries.
5. **Host Resource Protection**:
   - PIDs are constrained (`pids: 256`) to prevent fork bombs.
   - CPU and memory limits (`cpus: 2.0`, `memory: 4G`) prevent resource starvation of the host.

## Layer Optimization

The `Dockerfile` is optimized to use the **least possible layers**:
- Base layer: `node:22-bookworm-slim`
- **A single consolidated `RUN` layer** that combines package installation, `@deepseek-ai/dsh` global installation, apt/npm cache purging, user creation, and workspace preparation.
- Results in a minimal footprint and fast pull/build execution.

---

## Quick Start

### 1. Configure Environment (Optional)
```bash
cp .env.example .env
# Edit .env to set custom HOST_PORT or DEEPSEEK_API_KEY if desired
```

### 2. Apply Security Firewall Rules
```bash
./setup-security.sh
```

### 3. Build & Run
```bash
docker compose up -d --build
```

### 4. Access Web Interface
Open your browser at:
```
http://localhost:3080
```
(or the port configured via `HOST_PORT`).

---

## Verification

- **Check container status**:
  ```bash
  docker compose ps
  ```

- **Verify non-root user**:
  ```bash
  docker compose exec dsh id
  # Expected: uid=10001(dshuser) gid=10001(dshuser)
  ```

- **Verify host access is blocked from container**:
  ```bash
  # Attempting to reach host gateway will timeout/fail:
  docker compose exec dsh curl -m 3 http://172.28.0.1
  ```

- **Stop container**:
  ```bash
  docker compose down
  ```
