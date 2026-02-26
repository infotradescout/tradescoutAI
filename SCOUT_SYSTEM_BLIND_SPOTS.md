# Scout System Blind Spots (Current Snapshot)

Generated: 2026-02-24

## Why this exists

You asked what systems might still be overlooked. This document lists concrete potential blind spots after current green verification.

## What is currently green

- `npm run verify` passes end-to-end.
- Scout behavior registry guard passes (`detected=21, entries=21`).
- Scout fallback/LLM-behavior suites pass (message builders, human-feel, evals).

## Potential blind spots still worth hardening

1. **Scout route variant coverage asymmetry**
   - Scout route files found: 13 (`server/routes/scout*.ts`).
   - Explicit Scout server test files found: 2:
     - `server/tests/scout-policy.test.ts`
     - `server/tests/scoutDeterministicIntent.test.ts`
   - Risk: route variants and sidecar endpoints may evolve without equivalent route-level regression tests.

2. **DB-gated / skipped server tests in adjacent authority systems**
   - Multiple server suites are skip-gated or disabled when DB/test env is unavailable.
   - Notable examples:
     - `server/tests/messages-api.test.ts`
     - `server/tests/notifications-api.test.ts`
     - `server/tests/community-feed-api.test.ts`
     - `server/tests/groups-api.test.ts`
     - `server/tests/marketplace-api.test.ts`
     - `server/tests/hoa-api.test.ts`
     - `server/tests/d3-messaging-authority.test.ts`
   - Risk: production-only integration regressions can pass CI if env-dependent suites do not run.

3. **Scout analytics/CTA/check endpoints are wired but lightly validated**
   - Registered in runtime routing:
     - `/api/scout-analytics`
     - `setupScoutCTACheckRoutes(app)`
     - `/api/admin/scout-insights`
   - Risk: behavioral instrumentation and action-quality telemetry can drift without stronger contract tests.

4. **Enhanced Scout path dependency on route orchestration**
   - Core `scout.ts` references enhanced-v4 message path.
   - Risk: confidence/fallback semantics can drift if enhanced path contract changes without matching contract tests.

## Suggested next hardening tranche (practical order)

1. Add route-contract tests for active Scout sidecars:
   - scout analytics, CTA check, admin scout insights payload validation.
2. Add enhanced-v4 confidence fallback regression matrix:
   - low/medium/high confidence behavior + metadata invariants.
3. Add CI profile that runs currently DB-gated authority suites nightly (or pre-release), and publishes a skip delta report.
4. Add route-to-test coverage map for all `server/routes/scout*.ts` files with required test owner.

## Definition of "overlooked" closure

A subsystem is no longer considered overlooked when all are true:
- It has at least one contract test in CI,
- Failure mode is explicitly asserted,
- It is mapped in the route-to-test registry,
- It has a clear owner.
