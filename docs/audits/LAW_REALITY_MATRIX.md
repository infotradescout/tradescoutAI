# Law Reality Matrix (Runtime-First)

Date: 2026-04-13  
Scope: TradeScout platform law reconciliation against current runtime behavior.

## Classification Contract

Every law statement is tagged with exactly one of:
- `enforced`
- `policy_target`
- `temporary_exception`

Any `temporary_exception` must include owner, rationale, and removal date.

## Matrix

| Law Statement | Classification | Runtime Evidence | Notes |
|---|---|---|---|
| Visibility does not equal access | enforced | `server/routes.ts:20986`, `server/routes.ts:21105` | Global community actions are blocked outside local county interaction scope. |
| All contact is gated: Intent -> Decision Card -> Contact | enforced | `server/routes/business-contact.ts:80`, `server/social-features.ts:663`, `server/routes.ts:12548` | Contact and escalation flows route through authority/intent gating. |
| Claims-first signup; verification is adaptive/contextual | policy_target | `server/utils/onboardingService.ts:72`, `server/routes/contractor-signup.ts:68` | Intent-first onboarding exists, but end-to-end claims contract is not uniformly enforced across all entry paths. |
| Counties are operational containers (`county_metrics`, `county_entities`, `county_notes`) | enforced | `migrations/0038_county_intelligence_containers.sql:2`, `server/routes/admin.ts:750`, `server/routes/admin.ts:919` | Canonical county intelligence tables and write paths are active. |
| Target contract: Admin/UI reads precomputed intelligence (read-time derivation only as documented exception) | policy_target | `server/services/marketSignalsSnapshotJob.ts:1`, `server/routes/admin.ts:506`, `server/routes.ts:1147` | Snapshot-backed reads are in place for major surfaces; remaining derived/read-time paths still need explicit deprecation tracking. |
| Discovery Observatory Wave 1 classifies current public business/profile facts at admin read time | temporary_exception | `server/services/discoveryObservatoryService.ts`, `docs/audits/LAW_EXCEPTIONS_LEDGER.md` (`EXC-2026-08-09-001`) | Owner: TradeScout Platform Engineering. Rationale: the admin-only observatory needs an honest current baseline while the scheduled public-entity intelligence snapshot is built; it reads no contact fields and grants no access or ranking power. Removal date: 2026-09-30. |
| SEO directory snapshot build uses a bounded in-process source scan | temporary_exception | `server/services/seoDirectoryScopeSnapshotJob.ts`, `docs/audits/LAW_EXCEPTIONS_LEDGER.md` (`EXC-2026-08-23-001`) | Owner: TradeScout platform owner. Rationale: D1 needs one exact governed precomputed crawl graph now; the job caps source assignments at 350,000 and aborts before replacement on overflow, preserving the last complete snapshot rather than publishing partial truth. Replace with a paginated or database-native snapshot pipeline. Removal date: 2026-09-30. |
| Trust/CVS governs exposure | policy_target | `server/services/unifiedScoutRouter.ts:398`, `server/services/scoutTrustIntegration.ts:128`, `server/routes/direct-connect.ts:82` | Trust filtering is active, but permissive fallback/bypass posture still needs stronger release guards. |
| No pay-to-play | enforced | `server/routes.ts:19188` | Paid boost/ranking path is explicitly disabled (`410 PAID_RANKING_DISABLED`). |
| No lead selling | policy_target | `server/publicLandingHtml.ts:108`, `server/routes.ts:12497` | Product copy and routing are aligned; we still need stronger automated contract tests around lead-like edge behavior. |
| Read-only global community view allowed; global action is not | enforced | `server/routes.ts:20133`, `server/routes.ts:20986` | Global read exists; write interactions are county-local gated. |
| Scout is the primary guided bridge from discovery to action; non-Scout paths must preserve law invariants | policy_target | `server/routes/scout.ts:2337`, `server/social-features.ts:132`, `server/routes.ts:12497` | Hybrid execution exists today; invariants need broader contract-test coverage on non-Scout action paths. |
| AI + SEO ingestion precedes feature expansion | policy_target | `server/services/crawlerScheduler.ts:522`, `server/services/seoDirectoryScopeSnapshotJob.ts:1`, `server/services/seoPublicationPruneJob.ts:1` | Ingestion jobs exist and run, but this is not yet a hard release gate. |
| Never remove features; fix and harden | policy_target | `server/routes.ts:19188`, `docs/INTERACTION_CONTRACT.md:36` | Behavior is mostly harden/redirect rather than remove, but this remains a governance/process contract. |
| Repo is TradeScout-only (no MealScout/Trader's Corner asset or copy import) | enforced | `AGENTS.md`, `client/src/components/RevenueDisclosureSection.tsx`, `rg \"MealScout|Trader's Corner\" client/src server` | Current production user-facing copy is TradeScout-only; cross-brand mentions in audit history docs remain archival context only. |

## Temporary Exceptions

Current `temporary_exception` entries:

- `EXC-2026-08-09-001` — Discovery Observatory Wave 1 public-entity classification. Owner: TradeScout Platform Engineering. Rationale: bounded admin-only bridge to a scheduled snapshot. Removal date: 2026-09-30.
- `EXC-2026-08-23-001` — Bounded in-process SEO directory snapshot source scan. Owner: TradeScout platform owner. Rationale: preserve the last complete governed crawl snapshot while failing closed on capacity overflow. Removal date: 2026-09-30.

If new temporary exceptions are introduced, they must be logged in:
- `docs/audits/LAW_EXCEPTIONS_LEDGER.md`

## Verification Notes

- SEO contract baseline now includes static sitemap and sitemap index integrity checks:
  - `server/tests/sitemap-contracts.test.ts`
- Law-contract critical suites remain required and must not be skipped in protected-branch CI.
