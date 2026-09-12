FROM node:22-bookworm-slim

# Single combined RUN layer to minimize image layers and keep image size minimal
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

USER 10001:10001
WORKDIR /workspace

ENV HOME=/home/dshuser \
    DSH_HOME=/home/dshuser/.dsh \
    NODE_ENV=production

EXPOSE 3080

ENTRYPOINT ["dsh"]
CMD ["web", "--host", "0.0.0.0", "--port", "3080"]
