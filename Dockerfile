# ─── Build Stage ─────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Copy workspace config + lockfile
COPY package.json package-lock.json turbo.json tsconfig.json ./

# Copy all package.json files for workspace resolution
COPY apps/cli/package.json apps/cli/
COPY packages/core/package.json packages/core/
COPY packages/llm/package.json packages/llm/
COPY packages/tools/package.json packages/tools/
COPY packages/config/package.json packages/config/
COPY packages/logger/package.json packages/logger/
COPY packages/hooks/package.json packages/hooks/
COPY packages/mcp/package.json packages/mcp/
COPY packages/test-utils/package.json packages/test-utils/
COPY packages/worker/package.json packages/worker/
COPY packages/orchestrator/package.json packages/orchestrator/
COPY packages/memory/package.json packages/memory/
COPY packages/artifact/package.json packages/artifact/
COPY packages/queue/package.json packages/queue/
COPY packages/message-bus/package.json packages/message-bus/
COPY packages/server/package.json packages/server/
COPY packages/integrations/package.json packages/integrations/

# Install dependencies (including native modules like better-sqlite3)
RUN npm ci --ignore-scripts=false

# Copy source code (excluding desktop and web for server-only build)
COPY packages/ packages/
COPY apps/cli/ apps/cli/

# Build all packages
RUN npx turbo run build --filter=@pram1t/mustard-server --filter=@pram1t/mustard-cli

# ─── Runtime Stage ───────────────────────────────────────────
FROM node:22-slim AS runtime

WORKDIR /app

# Copy built artifacts and node_modules
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/packages packages/
COPY --from=builder /app/apps/cli apps/cli/
COPY --from=builder /app/package.json package.json

# Default server port
ENV PORT=3100
ENV HOST=0.0.0.0

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3100/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# Start the API server via CLI
CMD ["node", "apps/cli/dist/index.js", "server", "start", "--host", "0.0.0.0"]
