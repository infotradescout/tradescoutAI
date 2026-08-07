# Deployment Target Decision

Canonical production target: **Render Web Service**.

## Intended path (repo contract)

- Config source: `render.yaml`
- Runtime: **Node** (not Docker)
- Predeploy database step: `npm run db:migrate && npm run db:verify:required`
- Start: `npm start` → `node dist/index.js`
- Runtime migrations at boot: disabled (`RUNTIME_MIGRATIONS_MODE=off`)

This is the only path where Render honors `preDeployCommand` from the blueprint / native Node service settings.

## Live path hazard (must not regress)

As of 2026-08-07 recovery: production was green after a manual ledger catch-up, but the **live** service had been running as **Docker** (`CMD ["node", "dist/index.js"]`) with `RUNTIME_MIGRATIONS_MODE=off`. In that configuration:

- `render.yaml` `preDeployCommand` is **ignored**
- Boot does **not** run migrate or `db:verify:required`
- Schema gaps can ship silently until `/api/health` shows incompatible / required-schema failure

**Owner GO required before mutating Render.** Preferred fix (dashboard):

1. Open production web service `tradescout-pro`.
2. Confirm current runtime. If **Docker**, plan a maintenance window (auto-deploy will rebuild).
3. Switch service to **Node** runtime matching `render.yaml`:
   - Build command: `npm run build` (or existing equivalent that produces `dist/`)
   - Pre-Deploy Command: `npm run db:migrate && npm run db:verify:required`
   - Start command: `npm start`
   - Keep `RUNTIME_MIGRATIONS_MODE=off`
   - Keep health check path `/api/health` (not only Docker `HEALTHCHECK`)
4. Deploy once; confirm `GET /api/health` stays `status=healthy`, `migrations.compatibility=compatible`, and `x-tradescout-build` matches the deployed SHA.
5. Do **not** lower health/verify bars to make Docker “pass.”

Until that alignment lands, treat every `main` deploy as **migrate-not-guaranteed** and run migrate+verify manually (or fill-gaps if the watermark trap applies) before trusting schema.

## Watermark trap / fill-gaps

Normal `db:migrate` is insufficient after a Drizzle ledger watermark trap (later tag in ledger hiding earlier gaps). Use `npm run db:migrate:fill-gaps` for recovery. See `docs/runbooks/DB_MIGRATE_FILL_GAPS.md`.

## Non-canonical artifacts kept in repo

- `vercel.json`
- `Dockerfile` and `docker-compose.yml`
- `k8s-deployment.yaml`

These are retained for local experiments and portability. **Do not assume Docker is the production migrate path** unless the live Render service is Docker *and* an explicit pre-start migrate/verify entrypoint is configured and proven.
