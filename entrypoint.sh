#!/usr/bin/env bash
set -e

if [ "$1" = "dsh" ]; then
    shift
fi

if [ "$1" = "web" ]; then
    shift
    # Launch lightweight TCP bridge: 0.0.0.0:3080 -> 127.0.0.1:3081
    node -e '
    const net = require("net");
    const server = net.createServer(src => {
        const dst = net.connect(3081, "127.0.0.1");
        src.pipe(dst).pipe(src);
        src.on("error", () => dst.destroy());
        dst.on("error", () => src.destroy());
    });
    server.listen(3080, "0.0.0.0", () => {
        console.log("[dsh-bridge] Forwarding external port 3080 to internal 127.0.0.1:3081");
    });
    ' &
    PROXY_PID=$!
    trap 'kill -TERM $PROXY_PID 2>/dev/null' EXIT INT TERM

    EXTRA_TRUST_ARGS=()
    if [ -n "${EXTRA_TRUSTED_HOSTS:-}" ]; then
        for host in ${EXTRA_TRUSTED_HOSTS}; do
            EXTRA_TRUST_ARGS+=(--trusted-host "$host")
        done
    fi

    PORT_NUM="${HOST_PORT:-3080}"

    exec dsh web --no-open --port 3081 \
        --trusted-host "localhost:${PORT_NUM}" \
        --trusted-host "127.0.0.1:${PORT_NUM}" \
        --trusted-host "localhost:3080" \
        --trusted-host "127.0.0.1:3080" \
        "${EXTRA_TRUST_ARGS[@]}" \
        "$@"
fi

exec dsh "$@"
