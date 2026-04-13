# Law Reality Matrix (Runtime-First)

Date: 2026-04-09  
Scope: TradeScout platform law reconciliation against current runtime behavior.

## Method

- Canonical law statements were collected from:
  - `AGENTS.md`
  - `docs/TRADESCOUT_PRODUCT_AND_COPY_LAW.md`
  - `docs/reference/DOCTRINE.md`
  - `docs/ARCHITECTURE.md`
  - `docs/SCOUT_CONTRACT.md`
- Runtime truth was evaluated from server routes, services, and tests.
- Status legend:
  - `ENFORCED` = hard runtime guard exists.
  - `PARTIAL` = mixed enforcement or bypass/fallback exists.
  - `DRIFTED` = current implementation contradicts declared law.

## Matrix

| Law Statement | Status | Runtime Evidence | Notes |
|---|---|---|---|
| Visibility does not equal access | ENFORCED | `server/routes.ts:20986`, `server/routes.ts:21105` | Global community actions are blocked (`GLOBAL_READ_ONLY`) outside local county context. |
| All contact is gated: Intent -> Decision Card -> Contact | ENFORCED | `server/routes/business-contact.ts:80`, `server/social-features.ts:663`, `server/routes.ts:12548` | Multiple contact surfaces enforce request-first or authority-gated contact. |
| Claims-first signup; verification adaptive/contextual | PARTIAL | `server/utils/onboardingService.ts:72`, `server/routes/contractor-signup.ts:68` | Intent-first onboarding exists; broader claims-first posture is not uniformly codified as one runtime contract. |
| Counties are operational containers (`county_metrics`, `county_entities`, `county_notes`) | ENFORCED | `migrations/0038_county_intelligence_containers.sql:2`, `server/routes/admin.ts:750`, `server/routes/admin.ts:919` | Canonical county tables exist and have active read/write paths. |
| Admin/UI never computes intelligence; jobs precompute snapshots | PARTIAL | `server/routes/admin.ts:506`, `server/services/marketSignalsSnapshotJob.ts:1`, `server/routes.ts:1147` | County demand + activation readiness now read from precomputed snapshots; other market-signal surfaces still include read-time derivation and remain transitional. |
| Trust/CVS governs exposure | PARTIAL | `server/services/unifiedScoutRouter.ts:398`, `server/services/scoutTrustIntegration.ts:128`, `server/routes/direct-connect.ts:82` | Trust filtering exists, but permissive defaults and environment bypasses weaken strict governance. |
| No pay-to-play | ENFORCED | `server/routes.ts:19188`, `docs/INTERACTION_CONTRACT.md:32` | Paid boost endpoint returns `410 PAID_RANKING_DISABLED`. |
| No lead selling | PARTIAL | `server/publicLandingHtml.ts:108`, `server/routes.ts:12497` | Copy and contracts are aligned; runtime anti-pattern risk remains where request/conversation flows can be interpreted as lead-like without stronger policy tests. |
| Read-only global community view allowed; global action is not | ENFORCED | `server/routes.ts:20133`, `server/routes.ts:20986` | Global read path exists; write interactions are county-gated. |
| Scout is the only bridge from discovery to action | DRIFTED | `docs/ARCHITECTURE.md:17`, `server/social-features.ts:132`, `server/routes.ts:12497` | Architecture marks Scout as optional advisory; non-Scout direct action routes exist. |
| AI + SEO ingestion precedes feature expansion | PARTIAL | `server/routes/admin.ts:2857`, `server/routes/admin.ts:3003`, `server/services/crawlerScheduler.ts:522` | Ingestion/snapshot jobs exist, but this precedence is process-level and not enforced as a runtime release gate. |
| Never remove features; fix and harden | PARTIAL | `docs/INTERACTION_CONTRACT.md:36`, `server/routes.ts:19188` | Some old paths are intentionally disabled (good hardening), but "never remove" is not mechanically enforceable without policy exceptions. |
| Repo is TradeScout-only (no MealScout/Trader's Corner import) | DRIFTED | `client/src/components/RevenueDisclosureSection.tsx:48` | Live copy still contains MealScout references and requires TradeScout-only rewrite. |

## Test Reality

- Executed targeted suite:
  - `npm test -- server/tests/d3-messaging-authority.test.ts server/tests/acceptance-realignment.test.ts server/tests/scoutTrustIntegration.routing.test.ts`
- Result:
  - `server/tests/scoutTrustIntegration.routing.test.ts` passed.
  - `server/tests/d3-messaging-authority.test.ts` skipped by env guard (`RUN_INTEGRATION_TESTS`, `TEST_DATABASE_URL`).
  - `server/tests/acceptance-realignment.test.ts` skipped without `TEST_DATABASE_URL`.
- Implication: critical gating contracts are present but not always exercised in normal local/CI runs.

## Bottom Line

Current law docs are directionally useful, but not fully truthful as strict runtime contracts.  
The highest-confidence current truths are contact gating, county container model, global read/local action split, and pay-to-play disablement.  
Primary drift is around Scout-bridge absolutism, strict precompute-only intelligence reads, and TradeScout-only scope discipline.
