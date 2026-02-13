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

## HomeScout Program (Zillow Replacement, No Pay Gate)

HomeScout is the real estate portal (`/real-estate-marketplace`) that replaces Zillow end-to-end while preserving TradeScout platform laws:
- No pay-to-play, no lead selling, no ranking by payment.
- Awareness does not grant authority; all contact is gated: Intent -> Decision Card -> Contact.
- County is the operational container; county intelligence rollups write only to `county_metrics`, `county_entities`, `county_notes`.
- Admin/UI does not compute intelligence; jobs precompute and store snapshots.
- Trust/CVS governs exposure.

### HS-0) Definitions (Lock-In)
- Inventory sources: MLS/IDX if available, plus non-MLS (agent submissions, FSBO, builders, public records, partner sites).
- Canonical listing: source-attributed record with freshness, dedupe, and audit trail.
- Exposure policy: show listings and agents based on Trust/CVS, verification, and anti-fraud checks, never payment.

Done when:
- Data-source policy and exposure policy are written and referenced in code reviews.

### HS-1) Inventory Ingestion (P0)
- Build ingestion pipeline(s) that normalize listings into a single schema:
  - Required fields: location (county/state), address/geo (as allowed), beds/baths/sqft/lot, price, status, source, updatedAt.
  - Store source attribution + observedAt timestamps.
  - Dedupe across feeds (address/parcel/agent + fuzzy match).
- Add import jobs with idempotency + advisory locks so multi-instance does not duplicate work.
- Create basic abuse handling: report listing, takedown workflow, and source disable switch.

Done when:
- One county can be fully populated from at least one source end-to-end.
- Re-ingesting the same feed is idempotent and does not inflate counts.

### HS-2) Search, Filters, and Performance (P0)
- HomeScout search supports Zillow-class filters (price/beds/baths/type/status/keywords/DOM) and returns results in < 1s p95 for a seeded county.
- Use DB-first filtering with indexed query paths; no in-memory scanning for large result sets.
- Add substring-search indexes (pg_trgm) and/or FTS where needed; keep limits bounded and rate limited.

Done when:
- Load test for HomeScout search passes with stable p95 under expected concurrency.

### HS-3) Listing Pages That Answer the Full Question (P0)
- Listing detail page includes:
  - structured facts, photos/docs, price history, status timeline, map/county context
  - comps and market context are precomputed in jobs (not computed in UI)
- County rollups (inventory count, median price, DOM, price drops) are written to `county_metrics`.

Done when:
- At least one county path has: browse -> listing detail -> precomputed context -> gated contact.

### HS-4) Contact, Offers, and Showings (P0)
- Every contact entry point routes through Scout/Decision Card:
  - buyer intent (tour, offer, questions) -> Decision Card -> gated contact with agent/seller/builder
- Maintain the existing authority-gates audits as release blockers.

Done when:
- No direct “call/email/message” bypass exists from HomeScout surfaces.

### HS-5) Trust, Verification, and Anti-Fraud (P0)
- Agent verification: license + brokerage + identity where required.
- FSBO verification: proof-of-ownership or equivalent evidence tiering.
- Dedupe + spam prevention: rate limits, submission review, and abuse scoring.

Done when:
- Fraud and duplicate listings are suppressed by policy without manual firefighting.

### HS-6) Alerts and Distribution (P1)
- Saved searches + alerts (email/push) for:
  - new listings, price drops, status changes, open houses (where known)
- “Local-first” discovery: county-specific feeds and summaries.

Done when:
- Users can create alerts and reliably receive updates for at least one county.

### HS-7) SEO as a Gate (P0)
- Canonicals match real routes; sitemap includes HomeScout county + listing pages.
- Indexing coverage is monitored and treated as a release criterion for expansion.

Done when:
- HomeScout pages are discoverable and stable under crawl without trust leaks or thin content.

## Open Implementation Gaps (Tracked)

### How We Track Gaps (Source Of Truth)
- `npm run audit:http-semantics` (4xx vs 5xx correctness)
- `npm run audit:authority-gates` (Intent -> Decision Card -> Contact)
- `npm run audit:trust-leaks` (no stub/placeholder promise copy)
- `npm run audit:production-debt` (no in-memory critical dependencies)
- Release Gates workflow (e2e + guardrails) must be green before deploy

### Security Status (Workstream 5)
- Secrets-history remediation is complete as of **Feb 13, 2026**.
- `npm run audit:secrets-history` must stay green in CI.

### User-Facing Stub/Coming Soon Debt
- Cleared in current branch. Keep `Trust leak scan` in release checks to prevent regression.

### Test Debt Blocking Confidence
- Placeholder agent stub specs under `tests/agent/*` removed (they were skipped and not product coverage).

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
