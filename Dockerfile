FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=4096

# Install dependencies deterministically from package-lock.json
COPY package.json package-lock.json ./
RUN npm ci

# Copy source (dockerignore will prevent huge/unneeded folders)
COPY . .

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

# --- Production image ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only what runtime needs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server ./server
# Include the on-disk knowledge base used by Scout knowledgeService.ts
COPY --from=builder /app/data ./data
COPY --from=builder /app/docs ./docs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/scout/health || exit 1

CMD ["node", "dist/index.js"]
