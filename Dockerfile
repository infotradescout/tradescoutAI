# --- Multi-stage build for production ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --frozen-lockfile
COPY . .
RUN npm run build

# --- Production image ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production


# Install PM2 globally
RUN npm install -g pm2
# Copy only built output and production deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/server/cache ./server/cache
COPY --from=builder /app/client ./client
COPY --from=builder /app/.env ./

# Expose port (default: 3000)
EXPOSE 3000

# Healthcheck endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run with PM2 for zero-downtime reloads (cluster mode)
COPY --from=builder /app/ecosystem.config.js ./ecosystem.config.js
CMD ["pm2-runtime", "ecosystem.config.js"]
