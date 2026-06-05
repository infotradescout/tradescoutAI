# TradeScoutPro Codebase Patterns Overview

Source of truth: `TradeScoutPro_HANDOFF_SPINE.md`.

This overview describes current repo patterns for handoff. It is not an architecture proposal and does not authorize rewrites.

## Current Stack

- Frontend: React, TypeScript, Vite, Wouter routing, TanStack Query-style API access patterns, Tailwind/design-system CSS.
- Backend: Express, TypeScript, Node.js 20, bundled to `dist/index.js`.
- Database: Postgres/Neon through Drizzle ORM, with schema in `shared/schema.ts` and migrations in `migrations/`.
- Auth/session: Express session/auth code in `server/auth.ts` and auth/user routes in `server/routes.ts`.
- Storage: R2/S3-compatible signed URLs when configured, local public/private upload fallback paths, Google Cloud Storage/Replit object storage helpers, and DB-stored object keys/file URLs.
- Validation: TypeScript check, Vitest, Playwright/release gates, DB-backed strict lanes, and many custom audit/guard scripts.
- Deployment: Render is canonical through `render.yaml`; Docker/Kubernetes/Vercel artifacts exist but are not the default production path.

## Client Entry Pattern

- Main router: `client/src/AppRoutes.tsx`.
- Root routing sends public users toward `/landing` and authenticated users through post-onboarding routing.
- Post-onboarding logic lives in `client/src/lib/postOnboardingRoute.ts`.
- Scout is the default completed-user landing surface.
- Pages are lazy-loaded by domain in `client/src/AppRoutes.tsx`.
- Admin tools are also organized through `client/src/admin/adminTools.tsx` and admin page files under `client/src/pages/admin-*`.
- Shared UI/components live under `client/src/components`, `client/src/components/ui`, shells, hooks, and domain folders such as `client/src/scout`.

## Server Entry Pattern

- Main server entry: `server/index.ts`.
- Server startup loads `dotenv/config`, configures Express middleware, security headers, CORS, compression, request IDs, bot read-only guard, landing headers, canonical host redirects, routes, static/public HTML fallbacks, scheduler behavior, and graceful shutdown.
- Main route registrar: `server/routes.ts`.
- Additional routers live under `server/routes/*`, `server/routes/admin/*`, and `server/invoicingDocumentsRouter.ts`.
- Production starts from `dist/index.js` after `npm run build`.
- Startup requires `DATABASE_URL` and `SESSION_SECRET` in production.

## Route / API Organization Pattern

- `server/routes.ts` is the large central registrar and also owns many auth, user, public, admin, provider, object upload, map, and legacy route groups.
- Domain routers live in `server/routes/`, including Direct Connect, homes, procurement, identity verification, objectives, observability, admin, business profile/claim/contact, commercial directory, groups, HOA, Scout, and public metadata.
- Public SEO/rendered HTML routes are registered in `server/index.ts` for profile, business, trade, city, county, best, dataset, exchange, and share-token paths.
- Client routes are concentrated in `client/src/AppRoutes.tsx`, with lazy-loaded page components under `client/src/pages`.
- Do not rename or reorder routes during cleanup unless explicitly approved and separately validated.

## Schema / Data Pattern

- Canonical schema file: `shared/schema.ts`.
- Migration files live in `migrations/`; Drizzle journal lives in `migrations/meta/_journal.json`.
- DB config lives in `drizzle.config.ts`.
- Runtime DB connection lives in `server/db.ts`, using `TEST_DATABASE_URL` during tests and `DATABASE_URL` outside tests.
- Test DB bootstrap lives in `scripts/bootstrap-test-db.mjs`.
- Major data domains include auth/users, roles/profiles, counties, businesses/providers, trust/contact gates, Direct Connect work requests, Scout memory, HomeID/property/vehicles, marketplace/procurement, community/HOA, admin/audit/observability, payments/wallet/affiliate, and uploaded document/object references.
- Schema changes require deploy-order documentation and DB-backed validation.

## Test / Validation Pattern

- `npm run check` runs TypeScript.
- `npm run verify` runs typecheck, deterministic tests, and custom audits/guards.
- If `TEST_DATABASE_URL` is present, verify routes into stricter DB-backed behavior through `scripts/verify-tests.mjs`.
- `npm run test:run:no-skips` is the strict DB-backed no-skip lane.
- `npm run verify:db` wraps verify with test DB bootstrap.
- `npm run test:release-gates:local` runs local release gates with DB/test server setup.
- `npm run verify:release` is the recommended pre-ship combined lane.
- Contract tests are common for docs, route registration, platform-law guards, UI contracts, and behavior invariants.

## Deployment Pattern

- Canonical production target: Render Web Service in `render.yaml`.
- Render runs `npm run db:migrate` before `npm start`.
- Render sets `RUNTIME_MIGRATIONS_MODE=off`.
- Build command: `npm run build`.
- Start command: `npm start`.
- Dockerfile builds client/server assets and includes runtime server, migrations, data, and docs.
- Public app pages require `dist/public`; missing build output can make production API-only.

## Danger Zones

- Contact gating and Direct Connect safety.
- Trust/CVS, verification, claims-first signup, and exposure logic.
- Auth, roles, admin permissions, impersonation, protected admin users, and audit logging.
- Payments, payouts, wallet, affiliate payout behavior, pricing, and checkout.
- Runtime migrations, schema, migration journal, and deploy order.
- Upload/storage ACLs, private object keys, verification documents, and attachment download routes.
- Public SEO/static artifacts, especially sitemap drift.
- External connector execution, crawler/import execution, and AI auto-fix/write paths.
- Cross-brand references: production copy and docs must remain TradeScout-only unless explicitly approved.

## Known Inconsistencies To Verify Before Changing

- Some docs and scripts describe both deterministic and DB-backed validation lanes; confirm which lane the task requires before claiming release confidence.
- Render is canonical, while Docker/Kubernetes/Vercel artifacts still exist for experimentation.
- `server/routes.ts` is large and mixed-domain; route ownership should be documented before any route cleanup.
- Some upload paths use R2/object-key storage while older or admin paths use local `/uploads/...` file URLs; verify the active flow before changing storage docs or code.
- Public sitemap files can drift after build/generation; do not stage them unless the task owns sitemap output.
- Generated artifacts under `artifacts/`, `test-results/`, `playwright-report/`, and `logs/` can change during validation; do not commit them unless explicitly requested.
- Admin/operator pages span `client/src/pages/admin-*`, `client/src/admin/adminTools.tsx`, and multiple server route files; verify role requirements before documenting or editing.
- External integrations are controlled by env flags/keys; do not enable live external behavior during cleanup.
