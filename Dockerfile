FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DB_STORAGE=/dados/gestao.sqlite

COPY app/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && install -d -o node -g node -m 0750 /dados \
    && install -o node -g node -m 0640 /dev/null /dados/.volume
COPY app/src/ ./src/

USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=4s --start-period=10s --retries=5 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health', {signal: AbortSignal.timeout(3000)}).then(r => {if (!r.ok) process.exitCode = 1}).catch(() => {process.exitCode = 1})"]
CMD ["node", "src/server.js"]
