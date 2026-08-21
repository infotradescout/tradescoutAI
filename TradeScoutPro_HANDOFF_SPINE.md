# TradeScoutPro Handoff Spine

## App Identity

TradeScoutPro is the production TradeScout web application. It is a React + Express + Postgres product for local trade discovery, Scout-guided action routing, Direct Connect work requests, HomeID/property memory, business/provider profiles, county intelligence, marketplace/procurement surfaces, and admin/operator controls.

Canonical app/repo identity:

- App name: TradeScoutPro
- Product brand: TradeScout
- Primary production host decision: Render Web Service, as documented in `PRODUCTION.md` and `render.yaml`
- Main client entry/router: `client/src/AppRoutes.tsx`
- Main server entry: `server/index.ts`
- Main server route registrar: `server/routes.ts`
- Main schema file: `shared/schema.ts`

## What This App Is

- A local-first trust and action platform for homeowners, providers, businesses, community operators, and admins.
- A Scout-first app surface where authenticated users are routed through discovery, local context, and next actions.
- A governed Direct Connect request lane where contact remains gated through intent, decision, and contact permission paths.
- A HomeID/property memory layer for home records, documents, schedules, work history, and linked requests.
- A county-aware operating system where county metrics, entities, notes, observations, and snapshots carry local intelligence.
- A production Express API with Drizzle/Postgres persistence, React client routes, role-aware access control, object/file storage, audits, and release gates.

## What This App Is Not

- It is not a lead-selling system or pay-to-play contractor marketplace.
- It is not an ungated contact directory; visibility does not equal access.
- It is not a generic AI chat app; Scout is a guided bridge from discovery to governed action.
- It is not a place to add fake contractors, fake analytics, generated sample records, or demo production data.
- It is not a rewrite target; cleanup should preserve current routes, roles, permissions, trust flags, and business logic.
- It is not currently a Google Drive archival app; no Drive client usage was found in the current repo scan.

## Core User Flows

- Public visitor: lands on marketing/SEO/public directory pages, explores public profiles/trade/county/city pages, then starts account creation or claim flow.
- Signup/onboarding: user creates an account, verifies basics, resolves role/onboarding requirements, then lands on the post-onboarding route.
- Scout-first landing: completed regular users route to Scout for local snapshot, search/action routing, recent activity, and next-step guidance.
- Direct Connect request: requester creates a governed work request, optional attachments are uploaded through private object storage, eligibility/gates determine contractor visibility, and contact remains gated.
- Contractor/provider opportunity: provider profile/trade/county state controls which opportunities are visible and which actions are allowed.
- HomeID loop: user maintains home records, documents, maintenance schedules, completed work memory, and linked Direct Connect context.
- Business claim/profile: businesses can be found, claimed, profiled, verified, and exposed through governed profile/contact flows.
- Admin/operator review: staff/admin users monitor users, Direct Connect, county coverage, imports, observability, audit logs, verification, procurement, and intelligence surfaces.
- Marketplace/procurement: users and operators manage marketplace listings, procurement workspaces/orders/files/proofs, and supplier/fulfillment states where enabled.
- Public SEO/intelligence: server renders public profile, business, trade, county, city, dataset, and exchange HTML routes for crawler/search surfaces.

## Entry Routes / Pages

- `/` — root landing router in `client/src/AppRoutes.tsx`; public users go to `/landing`, authenticated users route through post-onboarding logic.
- `/landing`, `/create-account`, `/login`, `/verify-email`, `/check-email`, `/address-verification` — public/auth/onboarding entry surfaces.
- `/scout` — primary authenticated Scout surface.
- `/direct-connect` and Direct Connect share/info pages — governed request/action lane.
- `/homes` — HomeID/home records surface.
- `/business/:slug`, `/business-profile/*`, `/claim-my-business` — business profile and claim surfaces.
- `/contractors`, `/find-contractors`, `/contractor-profile`, `/contractor-dashboard` — provider discovery/profile/dashboard surfaces.
- `/admin/*` — admin/operator surfaces registered across `client/src/admin/adminTools.tsx`, `client/src/AppRoutes.tsx`, and server admin routes.
- `/county/*`, `/city/*`, `/trade/*`, `/best/*`, `/datasets/*`, `/u/:slug`, `/p/:slug`, `/exchange/*` — public SEO/rendered routes handled in `server/index.ts`.
- `/api/*` — Express API routes registered in `server/routes.ts`, `server/routes/*`, and `server/invoicingDocumentsRouter.ts`.

## Server Route Groups / API Groups

- Auth/session/user: local login/register/logout, OAuth providers, profile setup, onboarding, trusted devices, preferences, role updates, and user export/deactivation/delete routes in `server/routes.ts` and `server/auth.ts`.
- Scout: `/api/scout/*`, Scout v2/enhanced routes, Scout home snapshot, Scout analytics, Scout recommendations, Scout knowledge/admin routes, and Scout ops/admin routers.
- Direct Connect: `/api/direct-connect/*` in `server/routes/direct-connect.ts`, including request lifecycle, provider visibility, attachments, contact gates, HomeID linkage, outcomes, and admin/operator paths.
- HomeID/property/vehicles: `server/routes/homes.ts`, `server/routes/property-programs.ts`, `server/routes/vehicles.ts`, and related schema/service files.
- Business/provider/profile/claim/contact: business profile, business claim, business contact, contractor/provider search, requirements, standing, profile booking, public profile rendering, and verification document flows.
- County/local intelligence: counties, states, trades, observations, county metrics/entities/notes, geographic coverage, tradepartner county pages, Cumulus/observability/intelligence snapshots.
- Admin/operator: `server/routes/admin.ts`, `server/routes/admin/*`, mission control, authority operations, observability, UI issues, device security, user controls, audit logs, provisioning, imports, and knowledge upload.
- Marketplace/procurement/exchange: marketplace listings/inquiries/favorites/reports, procurement workspaces/orders/files/proofs, Grunt/partner fulfillment, exchange public routes, metals routes, and trade deals.
- Community/HOA/groups/foundation: community posts/groups/vaults/causes, HOA records/votes/documents/vendors, foundation/support ledger, and moderation/reputation tables.
- Payments/finance/affiliate: Stripe/payment services, invoices/documents router, affiliate accounts/payouts/referrals/share links, wallet/accounts/transactions, accounting/finance pages.
- Public metadata/SEO: public config, proof metrics, profile/business/trade/county/city/dataset/exchange HTML routes, sitemap generation, robots/static public assets.
- Object/file storage: `/api/objects/upload`, `/api/objects/upload-private`, local fallback PUT routes, R2 signed URLs, object storage ACL helpers, and authenticated download routes.

## Main Data / Storage Model

- Database: Postgres/Neon via `server/db.ts`, Drizzle schema in `shared/schema.ts`, migrations in `migrations/`, and deploy migration command in `render.yaml`.
- Auth/core identity: `sessions`, `users`, `userProfiles`, `trustedDevices`, `profiles`, role enums, onboarding/profile preference tables.
- County intelligence: `states`, `counties`, `countyNotes`, `countyMetrics`, `countyEntities`, `observations`, `observationSources`, `businessCounties`, `tradepartnerCountyObservationSnapshots`.
- Provider/business: `businesses`, `businessExternalRefs`, `businessSuggestions`, `contractors`, `providerDeclarations`, `providerEligibilities`, `providerLocalStats`, `contractorTrades`, `contractorCounties`, `businessVerifications`, `verificationDocuments`.
- Contact/trust/governance: `contactPermissions`, `decisionCards`, `trustSnapshots`, `contactPermissionEvents`, `contentReports`, `moderationVotes`, `moderationScores`, `userReputation`.
- Direct Connect/action work: `objectives`, `objectiveEvents`, `workRequests`, `workRequestEvents`, `workRequestAssignments`, Direct Connect ledger/workspace tables from migrations/services, and request attachments stored as object keys.
- Scout memory: `scoutInteractions`, `scoutMemory`, `scoutConversations`, `snapshots`, local Scout cache/manual files, and generated Scout reports.
- Home/property/vehicle: `userHomes`, `userHomeRecords`, `userHomeAppliances`, `userHomeDocuments`, `homeMaintenanceSchedules`, `homeProjects`, `propertyPrograms`, `propertyDocuments`, `propertyReadinessSnapshots`, `propertySellReadinessSnapshots`, `propertyHomefaxSnapshots`, `userVehicles`, `userVehicleDocuments`.
- Marketplace/procurement: `marketplaceCategories`, `marketplaceListings`, `marketplaceInquiries`, `marketplaceFavorites`, `marketplaceReports`, procurement order/file/proof tables near the bottom of `shared/schema.ts`, commercial project tables, metals snapshots/portfolio tables.
- Community/HOA/groups: `communityPosts`, `communityGroups`, `groupMembers`, `homeownerAssociations`, `hoaDocuments`, `hoaMembers`, `hoaVotes`, `hoaServiceRequests`, vault/cause ledger tables.
- Finance/affiliate/admin logs: `affiliateAccounts`, `affiliatePayouts`, `affiliateShareLinks`, `affiliateTrafficEvents`, `walletAccounts`, `walletTransactions`, `events`, `adminAuditLog`, `dataAccessLogs`, `errorReports`, observability/crawler/bot tables.
- File storage: R2 signed URLs when configured; local fallback paths are `./public/uploads` and `./private/uploads`; admin knowledge upload uses `uploads/scout-knowledge/`; commercial verification/project files use `/uploads/...` paths; public static assets live in `client/public/` and `public/`.

## External Integrations

- Neon/Postgres: `DATABASE_URL`, `TEST_DATABASE_URL`, Drizzle migrations and schema.
- Stripe: `STRIPE_SECRET_KEY`, payment/checkout/finance/procurement flows.
- Cloudflare R2/S3-compatible object storage: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`.
- Google Cloud Storage/Replit object sidecar: `server/objectStorage.ts` uses `@google-cloud/storage` and Replit sidecar signing for object URLs.
- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`.
- Google Maps/Places: `TRADESCOUT_GOOGLE_MAPS_API_KEY`, `VITE_GOOGLE_MAPS_MAP_ID`, Google Places import/preview paths.
- Google Gemini/Vertex: `GEMINI_API_KEY`, `GOOGLE_PROJECT_ID`, `GOOGLE_VERTEX_LOCATION`, model config/fallback providers.
- Facebook OAuth: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CALLBACK_URL`; disabled on Render by default via `DISABLE_FACEBOOK_AUTH=true`.
- Brevo/email: `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `EMAIL_MODE`.
- Sentry: `SENTRY_DSN`.
- Redis: `REDIS_URL` for optional cross-instance counters/fanout.
- Render: `render.yaml` is the canonical production target.
- Docker/Kubernetes/Vercel artifacts exist but `PRODUCTION.md` says they are not the default production path.

## Deployment / Runtime Assumptions

- Node.js 20 is the expected runtime.
- Production starts from Docker `CMD ["node", "dist/index.js"]`; `npm start` is the equivalent native command.
- Production build command is `npm run build`, which generates sitemaps, builds the Vite client, and bundles the server.
- Render Docker runs `npm run db:migrate && npm run db:verify:required` in pre-deploy; `RUNTIME_MIGRATIONS_MODE=off` remains production law. The image must retain the migration runner/config/dependency set — see `docs/DEPLOYMENT_TARGET.md`.
- `DATABASE_URL` and `SESSION_SECRET` are required in production startup.
- `server/index.ts` sets `trust proxy`, Helmet, CORS, compression, request IDs, bot read-only guard, landing headers, and canonical host redirects.
- Scheduler is controlled by `SCHEDULER_ENABLED`, `SCHEDULER_LEADER_ONLY`, and `SCHEDULER_LEADER_LOCK_ID`.
- If `TEST_DATABASE_URL` is absent, deterministic verify lanes can pass while DB-backed strict release lanes are skipped by design.
- DB-backed shipping confidence requires `npm run verify:release` or equivalent strict lanes with a disposable test DB.
- Public app pages depend on `dist/public`; missing client build output can leave the production server API-only.

## Known Danger Zones

- Contact gating: do not bypass Intent -> Decision Card -> Contact, and do not expose requester/provider contact details through public/profile/search paths.
- Trust/CVS and verification: do not weaken verification flags, trust snapshots, address/identity/business verification, or exposure logic.
- Direct Connect: request lifecycle, attachment access, provider visibility, contact release, dispatch ledger/workspaces, and HomeID linkage are production-safety sensitive.
- County intelligence: county metrics/entities/notes/observations are operational containers; avoid ad-hoc county fields or read-time-only intelligence without owner/removal date.
- Auth/roles/admin: role hierarchy, admin impersonation, user controls, protected admin users, and privileged-action audit logging are sensitive.
- Payments/payouts/affiliate/wallet: do not add payout behavior, payment state transitions, pricing changes, or wallet mutation behavior during cleanup.
- Runtime migrations: production deploy expects pre-deploy migrations and `RUNTIME_MIGRATIONS_MODE=off`; changing migration order or runtime migration behavior is risky.
- Object/file storage: private object keys, attachment download routes, local fallback paths, and verification documents must preserve authentication and ownership checks.
- Public SEO/static assets: sitemap files can drift from build generation; do not commit unrelated sitemap drift.
- External execution: do not enable live connector/provider execution, external imports, crawler behavior, or AI auto-fix/write behavior during handoff cleanup.
- Cross-brand scope: TradeScout copy and assets must remain TradeScout-only unless an explicit documented exception exists.

## Validation Commands

- Fast typecheck: `npm run check`
- Fast deterministic verify: `npm run verify`
- Build: `npm run build`
- Unit/contract run: `npm run test:run`
- Direct Connect gate regression: `npm run test:direct-connect:gates`
- Direct Connect DB gate suite: `npm run test:direct-connect:gates:db`
- Strict no-skip DB lane: `npm run test:run:no-skips`
- DB-backed verify: `npm run verify:db`
- Local release gates: `npm run test:release-gates:local`
- Pre-ship combined lane: `npm run verify:release`
- Deployment migration: `npm run db:migrate` (recovery after watermark trap: `npm run db:migrate:fill-gaps`; see `docs/runbooks/DB_MIGRATE_FILL_GAPS.md`)
- Scale readiness: `npm run check:scale-readiness`

## Developer Onboarding Checklist

- Read `README.md`, `README_START_HERE.md`, `PRODUCTION.md`, `docs/CONFIG_AND_DEPLOYMENT.md`, and this handoff spine.
- Confirm current branch, latest commits, and working tree with `git log --oneline -5` and `git status --short`.
- Do not touch existing sitemap drift unless the task is specifically sitemap/build output cleanup.
- Install dependencies with `npm install`.
- Copy `.env.example` to `.env` and set at least `DATABASE_URL` and `SESSION_SECRET` for local runtime.
- Set `TEST_DATABASE_URL` only to a disposable test database before DB-backed lanes.
- Start local dev with `npm run dev` and check `/api/health` or `/api/scout/health`.
- Run `npm run check` before changing code and `npm run verify` before handoff/cleanup completion.
- For DB/schema work, inspect `shared/schema.ts`, `migrations/`, `drizzle.config.ts`, `scripts/db-migrate-safe.mjs`, and document deploy order.
- For contact/Direct Connect/trust changes, run Direct Connect gate suites and inspect platform-law guards before committing.
- For UI cleanup, preserve routes, roles, user-facing product concepts, pricing, verification, trust, and contact-gating behavior.

## Next Cleanup Tickets

1. Create a docs index that maps existing production docs to owner/use case without changing product behavior.
2. Add a read-only artifact inventory for `artifacts/`, `test-results/`, `playwright-report/`, and `logs/`, excluding live uploads and production backups.
3. Document route-group ownership for the largest API groups in `server/routes.ts` and `server/routes/direct-connect.ts`.
4. Normalize validation lane docs so deterministic, DB-backed, and release-gate commands have one canonical table.
5. Add a storage retention runbook for generated reports, smoke artifacts, and local test outputs without deleting or moving files automatically.
6. Document Direct Connect gate invariants in one operator-facing page linked from this spine.
7. Map admin/operator surfaces to route files and required roles without changing permissions.
8. Audit local upload fallback paths against production R2 configuration and document expected ownership/access checks.
9. Add a migration deploy-order checklist for schema changes that includes test DB bootstrap impact.
10. Create a cleanup-only issue template that requires “behavior preserved” and “no new feature” assertions.

## Handoff Rule

Any future cleanup should preserve current behavior, platform-law invariants, route names, role names, product concepts, verification/trust flags, contact gates, pricing/payment behavior, and production deployment order.
