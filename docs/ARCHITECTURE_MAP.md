Tech stack
- Language: TypeScript/JavaScript (Node.js) — project uses `type: module` and `.ts` server files.
- Server framework: Express (see `server/index.ts`).
- Client: React + Vite (client build is produced by `vite build`, served from `dist/public`).
- Database: PostgreSQL via Drizzle ORM (`shared/schema.ts`, `drizzle.config.ts`).
- Auth: `passport` (local and OAuth strategies) and `express-session` stored in Postgres via `connect-pg-simple` (`server/auth.ts`).
- Payments: Stripe integrations present (`server/payment-service.ts`, `server/community-builder-payment-service.ts`, `server/platform-support-payment-service.ts`).
- Background jobs: scheduler/crawler (`server/services/crawlerScheduler`) and cron-like timers in `server/index.ts` (daily birthday notifications); `node-cron` is a dependency.

Hosting / build/run commands
- Local development: `npm run dev` (runs `tsx` to start `server/index.ts` with `NODE_ENV=development`).
- Build: `npm run build` (runs `vite build` then `node build-server.mjs`).
- Start production: `npm start` (runs `node dist/index.js`).
- Drizzle migrations: `npm run db:push` / `npm run db:migrate` (drizzle-kit + migrations in `./migrations/`).

Folder map (top-level)
- `server/` — Express server entrypoints, route handlers, services, auth, storage helpers (primary server logic).
- `client/` or `src/` — front-end React/Vite source (search for `client` or `src` in repo root; build output goes to `dist/public`).
- `shared/` — cross-cut code shared between server and client (important: `shared/schema.ts`, `shared/roles`, `shared/profile`).
- `migrations/` — SQL migration files applied by Drizzle (many numbered migrations present).
- `scripts/` — build, utility, and verification scripts used by npm scripts.
- `deploy.*`, `Dockerfile`, `k8s-deployment.yaml`, `render.yaml` — deployment artifacts and hints.

Key entry points
- Server start: `server/index.ts` (main boot sequence, Sentry, Vite dev setup, static serving, public page rendering).
- Route registration: `server/routes.ts` (calls `registerRoutes(app)` and mounts many sub-routers in `server/routes/`).
- Database schema: `shared/schema.ts` (Drizzle `pgTable` definitions).
- Drizzle config: `drizzle.config.ts` (points to `shared/schema.ts` and `./migrations`).

Auth (how login/session works)
- Sessions: `express-session` with `connect-pg-simple` storing sessions in the `sessions` table (configured in `server/auth.ts::getSession`). Cookie name is `tradescout.sid`.
- Local login: Passport Local strategy (email + password) implemented in `server/auth.ts` (passwords verified via bcrypt and `storage.getUserByEmail`).
- Social/OAuth: Facebook strategy is registered when `FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET` and `FACEBOOK_CALLBACK_URL` are set (`server/auth.ts`). Google strategy also referenced in routes (`passport-google-oauth20` is installed and referenced in `server/routes.ts`).
- User serialization: `passport.serializeUser` stores `user.id` in session; `deserializeUser` loads user via `storage.getUser`.

Payments
- Stripe is used: `stripe` is constructed conditionally when `STRIPE_SECRET_KEY` exists (see `server/routes.ts` top-level and `server/payment-service.ts`). Webhook handling and integration code reside in `server/community-builder-payment-service.ts` and `server/platform-support-payment-service.ts`.

Maps
- Google Maps / marker clustering references exist in dependencies (`@googlemaps/markerclusterer`) and map-related tooling may be in client code. No single canonical server map module was discovered in the server root; check client-side map components under the front-end source.

Background jobs / cron
- A crawler scheduler exists (`server/services/crawlerScheduler`) and is enabled with `SCHEDULER_ENABLED=true`.
- `server/index.ts` also contains an interval that checks once a minute and runs birthday notifications at 09:00 daily via `notificationService.processBirthdayNotifications()`.

External APIs & where keys configured
- Database: `DATABASE_URL` — used by `drizzle.config.ts` and the server DB connection (`server/db.ts`).
- Session secret: `SESSION_SECRET` — required for sessions (`server/auth.ts`).
- Stripe: `STRIPE_SECRET_KEY` — used when present by `server/payment-service.ts`.
- Facebook OAuth: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`/`FACEBOOK_CLIENT_SECRET`, `FACEBOOK_CALLBACK_URL` (`server/auth.ts`).
- Google OAuth: env vars referenced in `server/routes.ts` / passport Google strategy if present.
- Sentry: `SENTRY_DSN` (`server/index.ts`).
- Public URL / app base: `PUBLIC_WEB_URL` / `APP_URL` / `APP_BASE_URL` fallback used in `server/routes.ts` (`getPublicBaseUrlFromRequest`).
