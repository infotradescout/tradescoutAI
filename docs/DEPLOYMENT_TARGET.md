# Deployment Target Decision

Canonical production target: **Render Web Service**.

## Active path
- Config source: `render.yaml`
- Predeploy database step: `npm run db:migrate`
- Runtime migrations at boot: disabled by default (`RUNTIME_MIGRATIONS_MODE=off`)

## Non-canonical artifacts kept in repo
- `vercel.json`
- `Dockerfile` and `docker-compose.yml`
- `k8s-deployment.yaml`

These are retained for local experiments and portability, not the default production serving path.
