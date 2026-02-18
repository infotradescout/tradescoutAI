Priority improvement plan

Phase 1 — Stability / Correctness (highest priority)
1) Ensure required env validation and startup fail-safes are explicit
   - What to change: make startup fatal in production when `DATABASE_URL` or `SESSION_SECRET` are missing and add clear startup log messages for all required envs.
   - Why it matters: prevents running in insecure or half-broken state.
   - Files: `server/index.ts`, `drizzle.config.ts`, `server/auth.ts`.
   - Verify: start server with `NODE_ENV=production` and missing envs and confirm process exits with clear error; run with envs set and ensure server binds port.

2) Validate and document required env vars and deployment checklist
   - What to change: create a single canonical env list in `README` and `docs/CONFIG_AND_DEPLOYMENT.md` and add a lightweight startup check script that prints required envs and their status.
   - Why: onboarding and ops errors are common; explicit checklist reduces incidents.
   - Files: `scripts/` (add small `scripts/check-env.mjs`), `docs/CONFIG_AND_DEPLOYMENT.md` (update if needed).
   - Verify: run `node scripts/check-env.mjs` and confirm clear output.

3) Confirm DB migrations are run as part of deployment and add a healthcheck
   - What to change: ensure CI/deployment runs `npm run db:push` before starting; add a `/health` endpoint that verifies DB connection and a simple query (e.g., `SELECT 1`).
   - Why: prevents runtime errors from missing columns and provides a simple readiness probe for orchestrators.
   - Files: `scripts/`, `server/index.ts`, `server/routes.ts` (add health route) and CI/deploy manifests (`Dockerfile`, `render.yaml`, `k8s-deployment.yaml`).
   - Verify: after running migrations, `curl /health` returns 200 and a JSON payload with DB status.

4) Harden session cookie and session store checks
   - What to change: verify session cookie settings for `production` (ensure `secure: true`, `sameSite: none`) and log a warning if `SESSION_SECRET` is defaulted in non-dev.
   - Why: session security is critical.
   - Files: `server/auth.ts`.
   - Verify: start server in production and inspect `Set-Cookie` header and server logs.

Phase 2 — UX consistency and observability
1) Add automated smoke tests for critical flows
   - What to change: add a small Playwright or Supertest suite that covers signup/login, profile publish, public profile rendering, and `/health`.
   - Why: prevents regressions and ensures the build actually serves the client.
   - Files: `tests/` (new), `package.json` test scripts.
   - Verify: CI runs smoke tests and they pass.

2) Ensure server-side rendered pages use the same build assets as client
   - What to change: during build, verify `dist/public/index.html` exists and is included in Docker image; add build-time assertion in `build-server.mjs`.
   - Why: prevents out-of-sync client/server builds that cause broken pages.
   - Files: `build-server.mjs`, `server/index.ts`, `Dockerfile`.
   - Verify: after `npm run build` the `dist/public/index.html` is present and `server/index.ts` serves it in prod.

3) Add minimal monitoring / logging improvements
   - What to change: ensure Sentry is optional and add structured startup logs listing active integrations (Stripe, Sentry, OAuth providers) with masked keys present/absent.
   - Why: faster triage of misconfigurations.
   - Files: `server/index.ts`, `server/auth.ts`, `server/payment-service.ts`.
   - Verify: start server and inspect logs for integration status lines.

Phase 3 — Clean-up and preparation for new features (do not add features now)
1) Identify and mark deprecated or commented schema sections
   - What to change: in `shared/schema.ts` move commented-out schema fragments to a clearly labeled `__deprecated__` section and add a migration note.
   - Why: reduces confusion when reading schema.
   - Files: `shared/schema.ts`, `migrations/` (note file).
   - Verify: review `shared/schema.ts` top-level and confirm deprecated blocks are clearly labeled.

2) Remove or document unused code paths
   - What to change: locate commented imports (e.g., `WebSocketManager`) and either document why they are disabled or remove them.
   - Why: reduces cognitive load and risk of dead code.
   - Files: `server/routes.ts`, `server/*`.
   - Verify: `grep "DISABLED"` no longer returns ambiguous comments; code compiles.

How to prioritize and run work
- Start with Phase 1: these are small, high-impact changes that reduce production risk.
- Run smoke tests from Phase 2 in CI after Phase 1 is merged.
- Do Phase 3 cleanup after stability is confirmed.
