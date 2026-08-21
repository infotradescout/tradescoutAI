# Deployment Target Decision

Canonical production target: **Render Web Service** `tradescoutAI`.

## Production path (repo and dashboard contract)

- Config source: `render.yaml`
- Runtime: **Docker**, built from the root `Dockerfile`
- Predeploy database step: `npm run db:migrate && npm run db:verify:required`
- Start: Docker `CMD ["node", "dist/index.js"]`
- Render HTTP health check: `/api/health`
- Runtime migrations at boot: disabled (`RUNTIME_MIGRATIONS_MODE=off`)

As verified against Render's current deploy documentation and the paid Docker
Starter service settings on 2026-08-21, Render runs the service pre-deploy
command after building the image and before traffic moves. A Node runtime
conversion is not required for this lifecycle.

## Docker image invariant (must not regress)

The pre-deploy command runs inside the newly built image. The production stage
must therefore retain all of the following:

- `scripts/`, including `scripts/lib/subprocess.mjs`
- `drizzle.config.ts`, `shared/`, and `migrations/`
- `drizzle-kit` as a production dependency after `npm prune --omit=dev`

If any item is missing, do not enable or retain the pre-deploy setting: the next
deploy will fail before traffic moves. Do not work around that failure by
removing migrate or verify.

## Provider settings

1. Open production web service `tradescoutAI` (`srv-d4rivgm3jp1c7391th0g`).
2. Keep Runtime=`Docker`, Branch=`main`, and Auto-Deploy=`On Commit`.
3. Set Pre-Deploy Command to `npm run db:migrate && npm run db:verify:required`.
4. Set Health Check Path to `/api/health`.
5. Deploy once and prove the deploy log ran both commands before instance start.
6. Confirm `GET /api/health` remains healthy and compatible, and that
   `x-tradescout-build` matches the deployed SHA.
7. Do **not** lower migration, schema-verification, or health bars to make a deploy pass.

## Watermark trap / fill-gaps

Normal `db:migrate` is insufficient after a Drizzle ledger watermark trap (later tag in ledger hiding earlier gaps). Use `npm run db:migrate:fill-gaps` for recovery. See `docs/runbooks/DB_MIGRATE_FILL_GAPS.md`.

## Other deployment artifacts kept in repo

- `vercel.json`
- `docker-compose.yml`
- `k8s-deployment.yaml`

These are retained for local experiments and portability. `render.yaml` and the
root `Dockerfile` are the production pair; no Blueprint instance was attached
in Render when this contract was reconciled on 2026-08-21, so dashboard values
must still be verified after any provider-side change.
