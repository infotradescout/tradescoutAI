How to run locally (exact commands)
- Install dependencies: `npm install` (run in repo root).
- Development server (server + client HMR):
  - `npm run dev` - starts the server (`server/index.ts`) under `NODE_ENV=development` and sets up Vite HMR in dev mode.
- Build for production:
  - `npm run build` - runs `vite build`, `node scripts/generate-sitemap.mjs`, then `node build-server.mjs` to create the `dist`/`public` build.
  - Start the production server: `npm start` (runs `node dist/index.js`).
- Release gates:
  - `npm run test:release-gates` - runs the Chromium release gate suite against an already-running app instance (preflight checks `BASE_URL/api/health`).
  - Recommended local lane: `npm run test:release-gates:local` (bootstraps a test DB, starts a test server, runs release gates, writes `artifacts/release-gate-metrics.json`).
- Verification:
  - `npm run verify` - runs typecheck + tests + audits. If `TEST_DATABASE_URL` is present, it runs the strict no-skip DB lane.
  - `npm run verify:release` - runs DB-backed verify + release gates (recommended pre-ship).
- Database migrations:
  - `npm run db:push` - run Drizzle migrate/push using `drizzle-kit`.
  - `npm run db:migrate` - run migration helper script.
  - `npm run db:apply:tool-discovery` - apply `migrations/0046_tool_discovery_tables.sql` directly (safe/idempotent).

Required environment variables (observed in code)
- REQUIRED (server will warn/fail if missing in production):
  - `DATABASE_URL` - Postgres connection URL (used by `drizzle.config.ts` and `server/db.ts`).
  - `SESSION_SECRET` - session signing secret (used in `server/auth.ts`).
- Commonly used / optional envs referenced in code (add if you rely on those features):
  - `PORT` - server port (default 5000).
  - `NODE_ENV` - `development` or `production`.
  - `SENTRY_DSN` - Sentry DSN for error/tracing (`server/index.ts`).
  - `STRIPE_SECRET_KEY` - Stripe secret key for payments (`server/payment-service.ts`).
  - `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` / `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`, `FACEBOOK_CALLBACK_URL` - Facebook OAuth (`server/auth.ts`).
  - `PUBLIC_WEB_URL` / `APP_URL` / `APP_BASE_URL` - used to build public links (`server/routes.ts`).
  - `UPLOAD_DIR` - directory for uploaded files (server uses `./public/uploads` by default).
  - `CORS_ALLOWED_ORIGINS` - optional CORS override.
  - `VITE_API_BASE_URL` - preferred explicit frontend API origin (falls back to `VITE_API_URL`).
  - `VITE_GOOGLE_MAPS_WEB_API_KEY` - preferred frontend browser Maps key (fallback to `VITE_GOOGLE_MAPS_API_KEY`).
  - `VITE_GOOGLE_MAPS_MAP_ID` - optional Google Maps map style ID.
  - `SCHEDULER_ENABLED` - set `true` to enable background scheduler (`server/index.ts`).
  - `MASTER_ADMIN_EMAIL`, `MASTER_ADMIN_PASSWORD`, `MASTER_ADMIN_FIRST_NAME`, `MASTER_ADMIN_LAST_NAME` - bootstrap master admin on startup (`server/index.ts`).
  - Replit OIDC auth variables were removed with the legacy `server/replitAuth.ts` module. Use `server/auth.ts` providers (local/Facebook/Google) instead.

Where config is loaded and validated
- Many scripts and the server import `dotenv/config` at process start (see `server/index.ts` top). `drizzle.config.ts` reads `process.env.DATABASE_URL` and fails if missing. `server/index.ts` checks `DATABASE_URL` and `SESSION_SECRET` at startup (warns in dev, exits in production if missing).

How it is deployed (clues in repo)
- Docker: `Dockerfile` present at repo root (you can build and run container).
- Kubernetes: `k8s-deployment.yaml` present (deployment manifest).
- Render: references to `tradescoutai.onrender.com` and `render.yaml` suggest Render.com hosting is supported.
- Typical containerized deploy flow: build artifacts via `npm run build`, copy `dist` to container image, run `node dist/index.js` with env vars set.

Common failure points you can spot
- Missing `DATABASE_URL` or `SESSION_SECRET` in production will fail startup (explicit checks in `server/index.ts` and `drizzle.config.ts`).
- If `dist/public` is missing in production, the server will run in API-only mode - missing client assets will lead to 404 for app pages (see `server/index.ts`).
- Migrations out-of-date: server calls `runSchemaPreflight()` on startup (non-fatal), but schema drift can cause runtime query errors; ensure `npm run db:push` is executed before migrating production DB.
- OAuth callback URLs not configured (e.g., `FACEBOOK_CALLBACK_URL`) will throw when registering providers (see `server/auth.ts`).

Production hardening checklist (TradeScout)
- Frontend API origin:
  - Set `VITE_API_BASE_URL` explicitly in frontend build/deploy env.
  - If using shared API infra, point it to the API origin you actually host in production.
- Credentialed auth/session calls:
  - TradeScout API helpers send `credentials: "include"`; preserve this on direct `fetch` calls for auth/session paths.
- OAuth provider console settings (Google/Facebook):
  - Authorized JavaScript origins should include both:
    - `https://www.thetradescout.com`
    - `https://thetradescout.com`
  - Redirect/callback URLs should include the domain variants you support for auth callbacks (for example):
    - `https://www.thetradescout.com/api/auth/google/callback`
    - `https://thetradescout.com/api/auth/google/callback`
    - `https://www.thetradescout.com/api/auth/facebook/callback`
    - `https://thetradescout.com/api/auth/facebook/callback`
- CORS allowlist behavior:
  - Defaults already include both TradeScout domains.
  - Only set `CORS_ALLOWED_ORIGINS` if you need to extend or replace defaults; if you set a restrictive custom list, include both TradeScout domains.
- Websocket origin in production:
  - Client websocket initialization should target the same resolved API origin as HTTP API traffic in production.
- Maps frontend build env:
  - Set `VITE_GOOGLE_MAPS_WEB_API_KEY`.
  - Optional: set `VITE_GOOGLE_MAPS_MAP_ID` when using Advanced Markers/custom styling.

Solar v1 (Provider Workbench First)
- Intended belief:
  - Providers trust TradeScout estimates as transparent pre-quote guidance, not opaque lead spam.
- Intended behavior:
  - Providers use `/api/solar/provider/estimate` for scoped project triage.
  - Public users receive non-binding local ranges via `/api/public/solar/price-range` and are routed back through Scout for next steps.
- Psychological principles used:
  - Explainability (show assumptions and confidence), authority gating (role + feature flag), trust-preserving restraint (no direct contact unlock).
- Risks prevented:
  - Authority bypass, false precision claims, and accidental discovery-to-contact leakage.

- Required env for Solar v1:
  - `FEATURE_SOLAR_V1=true` to enable endpoints.
  - `FEATURE_SOLAR_GOOGLE_PROVIDER=true` only when you are ready to stage external provider integration.
  - `GOOGLE_SOLAR_API_KEY` (server-only secret, never expose in client env).
  - Optional assumptions: `SOLAR_DEFAULT_COST_PER_WATT_USD`, `SOLAR_DEFAULT_ELECTRIC_RATE_USD`.

- What this does not change:
  - No change to claims-first signup.
  - No change to Trust/CVS exposure logic.
  - No change to Discovery -> Scout -> Intent -> Decision Card -> Contact gating.
