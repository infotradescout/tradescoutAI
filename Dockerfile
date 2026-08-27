FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN apk add --no-cache fontconfig ttf-dejavu

# Install dependencies deterministically from package-lock.json
COPY package.json package-lock.json ./
RUN npm ci

# Copy source (dockerignore will prevent huge/unneeded folders)
COPY . .

# Ensure optional knowledge folder exists even when excluded from Docker context
RUN mkdir -p /app/data

# Build client (dist/public) + bundle server (dist/index.js)
RUN set -eux; \
  HB_PID=""; \
  cleanup() { \
    if [ -n "${HB_PID}" ]; then \
      kill "${HB_PID}" 2>/dev/null || true; \
      wait "${HB_PID}" 2>/dev/null || true; \
    fi; \
  }; \
  trap cleanup EXIT; \
  (while true; do echo "[build-heartbeat] $(date -u +%Y-%m-%dT%H:%M:%SZ) npm run build still running..."; sleep 20; done) & HB_PID=$!; \
  npm run build

# Optional: drop devDependencies after build to shrink runtime node_modules
RUN npm prune --omit=dev

# Some build steps can delete empty directories; ensure these always exist for COPY --from=builder.
RUN mkdir -p /app/data /app/migrations /app/docs

# --- Production image ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache fontconfig ttf-dejavu

# Copy only what runtime needs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/scripts ./scripts
# Include SQL migrations for runtime auto-migrate on boot (server/runtimeMigrations.ts).
COPY --from=builder /app/migrations ./migrations
# Include the on-disk knowledge base used by Scout knowledgeService.ts
COPY --from=builder /app/data ./data
COPY --from=builder /app/docs ./docs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10m --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://127.0.0.1:${PORT:-5000}/api/health" || exit 1

# Render normally verifies public media in pre-deploy. The runtime gate requires an
# exact-release marker in the selected existing object store and performs the same
# idempotent migration if Blueprint sync ever lags, so a container cannot become
# healthy with missing public inventory.
CMD ["sh", "-c", "node scripts/ensure-public-media-ready.mjs && exec node dist/index.js"]
