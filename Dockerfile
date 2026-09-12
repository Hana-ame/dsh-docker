FROM node:22-bookworm-slim

# Single consolidated RUN layer to minimize Docker image layers and optimize image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        bash \
        curl \
        git \
        ca-certificates \
        procps \
        python3 && \
    npm install -g --omit=dev @deepseek-ai/dsh && \
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
    NODE_ENV=production

EXPOSE 3080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["web"]
