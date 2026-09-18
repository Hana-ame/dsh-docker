FROM node:22-bookworm-slim

# 国内镜像源加速：apt 使用 USTC（实测 ~665KB/s，优于 aliyun 的 31KB/s），npm 使用 npmmirror
RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i 's|deb.debian.org|mirrors.ustc.edu.cn|g; s|security.debian.org|mirrors.ustc.edu.cn|g' /etc/apt/sources.list.d/debian.sources; \
    fi; \
    if [ -f /etc/apt/sources.list ]; then \
        sed -i 's|deb.debian.org|mirrors.ustc.edu.cn|g; s|security.debian.org|mirrors.ustc.edu.cn|g' /etc/apt/sources.list; \
    fi; \
    apt-get -o Acquire::Retries=5 update && \
    apt-get install -y --no-install-recommends \
        bash \
        curl \
        git \
        ca-certificates \
        procps \
        python3 \
        python3-pip \
        python3-venv \
        python-is-python3 && \
    npm config set registry https://registry.npmmirror.com && \
    npm config set fetch-retries 5 && \
    npm config set fetch-timeout 120000 && \
    npm install -g --omit=dev @deepseek-ai/dsh && \
    rm -f /usr/local/bin/dsh && \
    printf '#!/usr/bin/env bash\nexec node --expose-internals /usr/local/lib/node_modules/@deepseek-ai/dsh/lib/bin.js "$@"\n' > /usr/local/bin/dsh && \
    chmod 755 /usr/local/bin/dsh && \
    npm cache clean --force && \
    apt-get purge -y --auto-remove && \
    rm -rf /var/lib/apt/lists/* /tmp/* /root/.npm && \
    useradd -m -u 10001 -s /bin/bash dshuser && \
    mkdir -p /home/dshuser/.dsh /workspace && \
    chown -R dshuser:dshuser /home/dshuser /workspace

COPY --chmod=755 entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER 10001:10001
WORKDIR /workspace

ENV HOME=/home/dshuser \
    DSH_HOME=/home/dshuser/.dsh \
    NODE_ENV=production \
    PIP_BREAK_SYSTEM_PACKAGES=1

EXPOSE 3080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["web"]
