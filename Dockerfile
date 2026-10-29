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
    npm install -g pnpm && \
    npm install -g --omit=dev @deepseek-ai/dsh && \
    rm -f /usr/local/bin/dsh && \
    printf '#!/usr/bin/env bash\nexec node --expose-internals /usr/local/lib/node_modules/@deepseek-ai/dsh/lib/bin.js "$@"\n' > /usr/local/bin/dsh && \
    chmod 755 /usr/local/bin/dsh && \
    npm cache clean --force && \
    apt-get purge -y --auto-remove && \
    rm -rf /var/lib/apt/lists/* /tmp/* /root/.npm && \
    useradd -m -u 10001 -s /bin/bash dshuser && \
    mkdir -p /home/dshuser/.dsh /workspace && \
    printf 'registry=https://registry.npmmirror.com\nauto-install-peers=false\n' > /home/dshuser/.npmrc && \
    chown -R dshuser:dshuser /home/dshuser /workspace

# 插件清单 + 登记脚本：插件源码不进镜像，构建时由 dsh 自己按清单安装
COPY plugins.list /tmp/dsh-plugins/plugins.list
COPY scripts/enable-bundles.mjs /tmp/dsh-plugins/enable-bundles.mjs

COPY --chmod=755 entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER 10001:10001
WORKDIR /workspace

ENV HOME=/home/dshuser \
    DSH_HOME=/home/dshuser/.dsh \
    NODE_ENV=production \
    PIP_BREAK_SYSTEM_PACKAGES=1

# 构建期安装插件：逐行读 plugins.list，`dsh plugin --profile web add <spec>`，
# 再把装好的组合包登记进 web profile 的 dsh.profile.bundles。
# 插件从 GitHub 拉取；构建机需要代理时通过 --build-arg 传入（见 README）。
ARG HTTP_PROXY=""
ARG HTTPS_PROXY=""
ARG NO_PROXY=""
RUN set -eux; \
    grep -vE '^[[:space:]]*(#|$)' /tmp/dsh-plugins/plugins.list > /tmp/dsh-plugins/resolved.list; \
    while IFS= read -r spec; do \
        echo "[plugins] dsh plugin --profile web add $spec"; \
        dsh plugin --profile web add "$spec"; \
    done < /tmp/dsh-plugins/resolved.list; \
    node /tmp/dsh-plugins/enable-bundles.mjs; \
    dsh --profile web --dump-config > /dev/null; \
    pnpm store prune || true; \
    rm -rf /tmp/dsh-plugins /home/dshuser/.npm

EXPOSE 3080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["web"]
