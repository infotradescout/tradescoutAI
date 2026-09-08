# Production Deployment Guide - TradeScout AI

This guide provides instructions for deploying TradeScout AI to a production environment.

## Canonical Target
- Canonical production host is **Render Web Service** (`render.yaml`).
- **Production** path: Docker runtime; `preDeployCommand` runs the compiled schema-first production predeploy worker; start with `RUNTIME_MIGRATIONS_MODE=off`.
- **Invariant:** the production image retains the migration scripts/config, SQL, shared schema, and production `drizzle-kit` so Render can block traffic when migrate or verify fails. See `docs/DEPLOYMENT_TARGET.md`.
- After a Drizzle watermark trap, use `npm run db:migrate:fill-gaps` (not normal migrate alone). See `docs/runbooks/DB_MIGRATE_FILL_GAPS.md`.
- Vercel, `docker-compose.yml`, and Kubernetes artifacts remain in-repo for experimentation; the root `Dockerfile` is the production image contract.
- See `docs/DEPLOYMENT_TARGET.md` for the current deployment decision record.

## Prerequisites
- A Postgres database (e.g., Neon, RDS, or self-hosted)
- A Node.js 20+ environment or Docker
- Required API keys (Stripe, SendGrid, etc.)

## 1. Environment Setup
Copy `.env.example` to `.env` and fill in the required values:
```bash
cp .env.example .env
# Edit .env with your production values
```

## 2. Database Migration
Before starting the server, ensure the database schema is up to date:
```bash
npm run db:migrate
```

## 3. Build the Application
Build both the frontend and the backend:
```bash
npm run build
```
This will generate:
- `dist/public`: The compiled React frontend.
- `dist/index.js`: The bundled Express server.

## 4. Start the Server
Run the production server:
```bash
npm start
```
The server will listen on the port specified by the `PORT` environment variable (default: 5000).

## 5. Docker Deployment
You can also use the provided `Dockerfile` to build and run the application in a container:
```bash
docker build -t tradescout-ai .
docker run -p 5000:5000 --env-file .env tradescout-ai
```

## 6. Verification
After deployment, verify the system health:
```bash
curl https://your-domain.com/api/health
```
Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  ...
}
```

## 7. Pre-Deploy Release Gates
Recommended pre-ship lane:
```bash
npm run verify:release
npm run build
```

If you want to run the lanes individually:
```bash
npm run verify:db
npm run test:release-gates:local
npm run build
```

Expected artifacts:
- `.playwright/test-results/results.json`
- `artifacts/release-gate-metrics.json`
- `artifacts/test-skip-delta.no-skips.json`
- `artifacts/test-skip-delta.no-skips.md`

## 8. Ongoing Maintenance
- **Backups**: Ensure regular backups of your Postgres database.
- **Monitoring**: Use Sentry for error tracking and check logs regularly.
- **Scaling**: Run `npm run check:scale-readiness` periodically to identify potential bottlenecks.
