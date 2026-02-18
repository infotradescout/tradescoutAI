What is missing, broken, or risky (provable from the code)
- Startup requires `DATABASE_URL` and `SESSION_SECRET` in production. If these are absent, startup exits (see `server/index.ts` and `drizzle.config.ts`). This is a common operational failure point.
- The app will serve the client only when `dist/public` exists. If you build but do not deploy `dist/public`, the server falls back to API-only and client pages 404 (`server/index.ts`).
- OAuth providers require callback URLs and secret env vars; `server/auth.ts` throws if `FACEBOOK_CALLBACK_URL` is not set when enabling Facebook strategy.
- Large schema surface: `shared/schema.ts` defines hundreds of tables. This increases migration/maintenance risk — migrations are present but require care (`./migrations/`).

Partially implemented / disabled code (explicit in repo)
- `WebSocketManager` import is disabled and commented: routes.ts contains a comment `DISABLED: WebSocketManager is not instantiated, using Socket.io messaging service instead`.
- Some affiliate-related tables appear commented out in `shared/schema.ts` (near line ~7950) indicating planned-but-disabled models.

Dead code or unused components (evidence-based)
- Several server scripts in `scripts/` and `tools/` appear verification/audit-only; they are not harmful but increase cognitive load. Specific dead code can't be fully enumerated without runtime usage data; search shows commented-out schema fragments in `shared/schema.ts`.

Security / data integrity risks
- Session cookie configuration: in development `secure` is relaxed; ensure `NODE_ENV=production` and `SESSION_SECRET` are correct in production to avoid session replay risks (`server/auth.ts`).
- Email verification gating and onboarding checks are in place (`server/routes.ts` and `server/auth.ts`), but if `email_verification_required` site setting is misconfigured it could allow unverified accounts active access (site settings are runtime-driven via DB).
- Large numbers of third-party integrations (Stripe, Google/Facebook, Sentry, various cloud storage SDKs) mean multiple secrets; missing or misconfigured webhooks (Stripe) can cause silent accounting problems.

Operational risks
- Background scheduler is disabled by default and only enabled via `SCHEDULER_ENABLED=true` — forgetting to enable it will stop background caching and jobs (`server/index.ts`).
- Migrations directory exists, but production deployment must ensure `db:push` or proper migration run; otherwise SQL queries expecting migrated columns will fail.

UX/consistency risks
- Server-side rendering for public pages is implemented, but client routing is a SPA — mismatches between server-rendered meta and client state are possible if the client and server builds are out of sync.

What is unclear / needs confirmation (and where to check)
- Full list of API routes and public client routes: `server/routes.ts` registers many routers; inspect `server/routes/` to enumerate endpoints.
- Map usage and API keys appear to be client-side — check the front-end source (client or `src/`) for Google Maps components and API key usage.
