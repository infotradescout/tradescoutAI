# Drift Guards (Operational)

Date: 2026-04-09  
Purpose: Stop law drift by adding explicit technical and process gates.

## Guardrail Categories

## 1) Law-to-Code Contract Mapping

Create a maintained map:

- `LAW_ID_CONTACT_GATING` -> `server/social-features.ts`, `server/routes/business-contact.ts`, `server/routes.ts` marketplace conversation flow.
- `LAW_ID_COUNTY_CONTAINERS` -> county metrics/entity/note write paths.
- `LAW_ID_TRUST_EXPOSURE` -> trust snapshots job + trust filtering + direct-connect gating.
- `LAW_ID_GLOBAL_READ_ONLY` -> community global scope read and local interaction blocks.
- `LAW_ID_NO_PAY_TO_PLAY` -> disabled boost endpoint + ordering constraints.
- `LAW_ID_JW_PRIVATE_OFFER_GATING` -> `server/routes/jw-stone-express.ts`, `server/routes/admin-jw-stone-offers.ts`, immutable offer events, and JW-only Express identity tables.

Definition: every law must map to at least one runtime enforcement point and at least one test.

## 2) CI Gates (Required)

Require these suites (non-skipped) in protected branches:

1. `server/tests/d3-messaging-authority.test.ts`
2. `server/tests/acceptance-realignment.test.ts`
3. `server/tests/scoutTrustIntegration.routing.test.ts`

Operational requirement:

- Provide `TEST_DATABASE_URL` in CI.
- Set `RUN_INTEGRATION_TESTS=true` for protected-branch runs.

Fail condition:

- Any test suite tagged as "law-contract critical" is skipped.

## 3) Static Drift Checks

Add checks to CI:

1. Brand-scope check:
   - Reject `MealScout` / `Trader's Corner` in production app surfaces (`client/src`, `server/public*`, marketing docs) unless in exceptions file.
2. Trust bypass check:
   - Alert if `DIRECT_CONNECT_DEMO_MODE`, `TRADE_SCOUT_DEMO_MODE`, or `DIRECT_CONNECT_ALLOW_UNVERIFIED` are true in production envs.
   - Enforced by: `npm run guard:prod-bypass` in release gates.
3. Contact gate vocabulary check:
   - Reject new authority gate values outside allowlist (`decision_card`, `scout_recommendation`) without migration + contract update.
4. Positioning scope check:
   - Flag new general-purpose public copy that frames TradeScout as contractor-only or homeowner-only unless the surface is explicitly a contractor campaign, homeowner campaign, trade-specific SEO page, HomeID/HomeScout context, or legacy compatibility surface.
   - Preferred broad framing: local opportunity infrastructure, verified intent, connection, local exchange, people, businesses, providers, and communities.
5. JW Stone private-offer boundary check:
   - Reject any link from JW Express accounts or offers to TradeScout `users` identity.
   - Keep `pending_verification` offers out of operator queues and keep customer contact masked until an audited reveal action.
   - Keep container priority server-owned and private: amount descending, current submission time ascending, immutable offer ID ascending.
   - Reject public offer counts, ranks, competing amounts, auction language, payment capture, reservation claims, or acceptance-as-sale behavior without an explicitly approved contract change.

## 4) Runtime Telemetry Guards

Emit and monitor:

1. `law_guard.contact_bypass_attempt`
2. `law_guard.trust_fallback_used`
3. `law_guard.global_action_blocked`
4. `law_guard.demo_bypass_applied`
5. `law_guard.marketplace_paid_ranking_attempt`

Alert thresholds:

- Any non-zero in production for bypass/demo events.

## 5) Exception Ledger (Required for Temporary Drift)

Maintain `docs/audits/LAW_EXCEPTIONS_LEDGER.md` with:

- law id
- current exception behavior
- owner
- created date
- removal deadline
- linked issue/pr

Rule: no "temporary" exception without deadline.

## 6) Release Checklist (Law Integrity)

Before release:

1. Law-critical tests pass and are not skipped.
2. No unresolved `temporary_exception` items past removal date, and every `policy_target` has an owner and target date in `LAW_REALITY_MATRIX.md`.
3. `LAW_EXCEPTIONS_LEDGER.md` reviewed; no overdue exceptions.
4. Authority config snapshot reviewed:
   - `/api/admin/authority/config`
   - Ensure production bypass toggles are off.

## 7) Ownership Model

- Product Owner: law wording and exception approvals.
- Engineering Owner: enforcement anchors and CI gates.
- Ops Owner: production env and bypass toggle hygiene.
- Review cadence: weekly until all `policy_target` items are actively owned and no `temporary_exception` item is overdue, then monthly.

## First Execution Sprint (Suggested)

1. Fix TradeScout-only copy drift.
2. Enable integration test env in CI to remove law-test skipping.
3. Add static brand-scope and bypass checks.
4. Publish and enforce exception ledger workflow.
