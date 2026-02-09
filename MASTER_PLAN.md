# TradeScout Master Plan

This document is the single execution plan for production hardening and sustainability.
All other roadmap/checklist/audit/status plan docs are deprecated and removed.

## Success Definition
TradeScout reliably delivers **Connection Without Compromise**: verified people connect to verified pros through Scout/Decision Card intent gates without spam or contact bypass.

## Platform Laws (Non-Negotiable)
- Awareness does not grant authority.
- Contact must stay gated: Intent -> Decision Card -> Contact.
- Claims-first signup with adaptive verification.
- County intelligence writes only to `county_metrics`, `county_entities`, `county_notes`.
- No pay-to-play and no lead selling.
- Read-only global community view is allowed; global action is not.
- Scout is the only bridge from discovery to action.
- Admin/UI reads precomputed intelligence; no ad-hoc compute in UI.
- Trust/CVS governs exposure.
- AI + SEO ingestion precedes feature expansion.
- Never remove core product capabilities; fix and harden.

## Workstreams (In Order)

### 1) Undeniable Trust Layer (Now)
- Keep blueprint trust aesthetic consistent across public/auth/community/direct-connect/scout surfaces.
- Surface CVS + verification state on all cards/profiles/contact entry points.
- Remove user-facing stubs (`coming soon`, placeholder promise copy) from live surfaces.
- Ensure only verifiable metrics are displayed.

Done when:
- No trust-leak copy appears in live journeys.
- CVS state is visible anywhere a user can decide to connect.

### 2) Authority Model Enforcement (P0)
- Keep Scout + Decision Card as the only contact gate.
- Audit every route and UI action for contact bypass risk.
- Treat any bypass as P0 with immediate block + fix.

Done when:
- All contact entry points enforce intent gating.
- Bot Army trust-leak + gating suites are green.

### 3) Release Gates Before Growth
- Make release-gate checks CI-blocking for:
  - account creation
  - direct connect
  - verification
  - scout routing
- Run Bot Army nightly and fail deploy on trust leaks or gate regressions.

Done when:
- CI blocks merges/deploys for failed gate criteria.

### 4) Observability as Moat
- Complete observability phases: dashboards, alerts, and error semantics.
- Enforce 4xx for user/input problems and 5xx only for server faults.
- Set baselines from real traffic, not guessed thresholds.

Done when:
- Alert thresholds are documented and live.
- 500 errors represent only server-side failures.

### 5) Eliminate Trust-Critical Debt
- Complete secret-history remediation and credential rotation.
- Remove production dependencies on temporary in-memory state.
- Replace placeholder/mock behavior in production paths.

Done when:
- Secrets are removed from history and rotated.
- Critical paths are persistent and durable.

### 6) Direct Connect as Core Surface
- Route every conversion surface into Direct Connect or Scout (no dead-end pages).
- Clarify status and next step at each Direct Connect state.
- Reduce friction and ambiguity in request/decision/contact flow.

Done when:
- All qualifying funnels terminate in DC/Scout actions with explicit next step.

### 7) Deterministic Onboarding
- Keep one consistent onboarding flow.
- Keep role-aware branching without role lock-in.
- Remove optional branches that create decision fatigue.

Done when:
- Median onboarding path is short, deterministic, and conversion-safe.

### 8) Keep Full Feature Set, Reduce Sprawl Risk
- Preserve existing features, but unify navigation and outcomes around trust + verified connection.
- Every feature must map to trust, contact, verification, or county intelligence outcomes.

Done when:
- No primary surface is disconnected from platform outcomes.

### 9) SEO as Launch Gate
- Canonicals must match real routes.
- Verify sitemap submission and discovery before content expansion.
- Monitor indexing and coverage as release criteria.

Done when:
- Sitemap + canonical validations pass for all public pages.

### 10) Operating Metric and Cut Rule
- Operating sentence: **Connection Without Compromise**.
- Any feature that does not improve trusted verified connection outcomes is deferred.

Done when:
- Planning and release decisions reference this metric explicitly.

## Open Implementation Gaps (Tracked)

### Unimplemented APIs / Methods
- `server/routes.ts:906` affiliate settings (501)
- `server/routes.ts:5987` company promotions endpoint intentionally returns empty until implementation is complete
- `server/routes.ts:11340` partnerships (501)
- `server/routes.ts:11422` affiliate click tracking disabled (501)
- `server/routes/admin.ts:1089` admin affiliate payouts (501)
- `server/routes/transactions.ts:8` transactions API (501)
- `server/routes/nationwide.ts:80` method not implemented
- `server/routes/nationwide.ts:99` method not implemented
- `server/routes/nationwide.ts:118` method not implemented
- `server/routes/groups.ts:132` method not implemented
- `server/storage.ts:8492` commission table fallback simulation

### Security Blocker (Hard Stop)
- `npm run audit:secrets-history` currently fails.
- Sensitive files still present in git history:
  - `secrets/db_password.txt`
  - `secrets/gemini_api_key.txt`
  - `secrets/session_secret.txt`
  - `ssl/fullchain.pem`
  - `ssl/privkey.pem`
- Required to clear Workstream 5:
  - rewrite history to remove secret-bearing files from all refs
  - rotate all exposed credentials
  - force-push updated refs

### TODOs in Runtime Paths
- `server/invoicingDocumentsRouter.ts:602`
- `server/routes/admin-control.ts:122`
- `server/routes/admin-control.ts:123`
- `server/routes/admin-tool-discovery.ts:63`
- `server/routes/authority-operations.ts:107`
- `server/routes/authority-operations.ts:136`
- `server/scout/governor.ts:226`
- `server/scout/governor.ts:309`
- `server/utils/verificationTelemetry.ts:56`
- `server/services/countyService.ts:109`
- `server/services/marketplaceService.ts:23`
- `server/routes.ts:9825`
- `server/routes.ts:9835`
- `server/routes.ts:9845`
- `server/routes.ts:9855`
- `server/routes.ts:9865`
- `server/routes.ts:9875`
- `server/routes.ts:9885`
- `server/routes.ts:10968`
- `client/src/scout/ScoutOS.tsx:3450`

### User-Facing Stub/Coming Soon Debt
- Cleared in current branch. Keep `Trust leak scan` in release checks to prevent regression.

### Test Debt Blocking Confidence
- `tests/community-feed.e2e.spec.ts:7` real sign-in helper TODO
- 29 placeholder skipped specs under `tests/agent/*` must be replaced or removed from gate criteria

## Required Checks Before Any Production Deploy
1. Intent-gate audit across Community, Direct Connect, Scout, and profile contact actions.
2. Trust leak scan (`TODO`, `coming soon`, placeholder) on all user-visible routes.
3. Release-gate metrics pass in CI for account, direct connect, verification, scout routing.
4. Bot Army nightly status green with no trust leaks.
5. Observability pass: alert baselines live, 4xx/5xx semantics validated.
6. Security pass: secret-history remediation complete and creds rotated.
7. SEO pass: canonical and sitemap checks complete.

## Execution Rule
Work in strict order from Workstream 1 through 10. Any P0 trust or gating issue preempts all other work.
