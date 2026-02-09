# TradeScout Production Readiness Checks (Current Sprint)

Run these in order. If any check fails, stop and log the step number so we can fix it before continuing.

## 1. Blueprint/Auth Surface Integrity

1. Open `/create-account` on desktop.
2. Scroll to bottom of page.
3. Confirm:
- Background reads as subtle blueprint layer, not overpowering UI.
- You can spot real blueprint details (dimension arrows, measurement text, title block) on inspection.
- No large empty dead zone below primary auth content.
- Top nav, right rail, and bottom nav stay visually stable.

## 2. Community Message Is Intent-Gated

1. Open a community post with CTA buttons.
2. Click `Message`.
3. Confirm:
- A `DecisionCard` appears before any conversation opens.
- Proceed path opens `ContactOutcomeModal`.
- Modal states contact is intent-gated and authority-confirmed.
4. Click confirm in modal.
5. Confirm user lands in messaging thread only after modal confirmation.

## 3. Scout Recommendation Contact Is Intent-Gated

1. Open a Scout recommendation card that supports contact.
2. Trigger contact.
3. Confirm:
- `ContactOutcomeModal` appears.
- Request goes to `/api/social/conversations/start`.
- Contact is blocked when policy confidence is below threshold.

## 4. Direct Connect Still Works as Established Contact Path

1. Create/route a Direct Connect request.
2. Accept assignment as provider.
3. Confirm:
- Conversation is created only after assignment acceptance.
- Thread messaging works in `/messages` for that accepted engagement.

## 5. Legacy Conversation Creation Is Blocked (Backdoor Check)

Use authenticated session/cookie and verify these return authority-gate errors:

1. `POST /api/conversations`
2. `POST /api/conversations/:id/messages`

Expected payload includes:
- `reasonCode: MISSING_AUTHORITY_GATE`
- Message directing caller to `/api/social/conversations/start`.

## 6. Community CTA Authority Check Fails Safe

1. Temporarily force `/api/scout/cta-check` failure (dev stub/network fault).
2. Reload community CTA surface.
3. Confirm:
- CTA does not fail open to direct action.
- UI degrades to `Ask Scout first`.

## 6b. No Messaging Dead Ends

1. Open `/conversations` with no conversations.
2. Open legacy `/chat` with no conversations.
3. Confirm both empty states offer governed actions:
- `Direct Connect`
- `Ask Scout`

## 7. Trust Signals Visible on Core Surfaces

1. Contractor cards show CVS state (score or pending).
2. Public profile shows verification status + trust strip.
3. Business profile shows trust badges.
4. Direct Connect shell shows authority/intent badges.

## 8. Build/Type Safety Gate

Run:

```bash
npm run check
```

Expected:
- TypeScript check passes with zero errors.

## 8b. Observability Baselines Visible

1. Open `/admin-observability`.
2. Confirm `Alert Baselines` panel is present.
3. Confirm it shows:
- HTTP baseline 5xx rate and delta trigger.
- DB pool p95 acquire latency baseline.
- Scheduler per-job p95 duration and avg rows baselines.
4. Confirm these values refresh with dashboard polling (15s cycle).

## 9. Automated Release Gates (CI)

The following now run as required CI checks in `.github/workflows/release-gates.yml`:

1. Account creation gate:
- `tests/journeys/auth_buttons_present.spec.ts`
2. Direct Connect gate:
- `tests/direct-connect.e2e.spec.ts`
3. Verification gate:
- `tests/address-verification.smoke.spec.ts`
4. Scout routing gate:
- `tests/scout-routing.e2e.spec.ts`

Metrics artifact:
- `artifacts/release-gate-metrics.json` (uploaded by CI as `release-gate-metrics`)

## 10. Trust Debt Hard Blockers

CI workflow:
- `.github/workflows/trust-debt.yml`

Required outcomes:
1. `npm run audit:production-debt` passes.
2. `npm run audit:secrets-history` passes.

Current blocker status:
- Git history still contains previously committed secret-bearing file paths:
`secrets/db_password.txt`, `secrets/gemini_api_key.txt`, `secrets/session_secret.txt`, `ssl/fullchain.pem`, `ssl/privkey.pem`.
- Production is not "done done" until history is rewritten and all exposed credentials are rotated.

## 11. Deterministic Onboarding (Fast Path)

1. Open `/create-account`.
2. Confirm the flow is minimal:
- Required fields only (email, password, name, phone, terms).
- Single `Primary focus` selector (`I need help`, `I offer services`, `I do both`).
- No giant multi-role checklist.
3. Complete signup and confirm redirect order:
- `/create-account` -> `/pre-scout-setup` -> `/scout?onboarding=true`
4. In `/pre-scout-setup`, confirm first-pass requirements are deterministic:
- Presence type required.
- County required.
- Business name required only when representing a business.
- Optional profile details deferred.
5. Confirm you can still adjust role/profile details later in profile settings.
6. Confirm route consistency for incomplete profiles:
- Sign in with a user where `profileVersion <= 0`.
- Attempt to open `/`, `/scout`, `/community`, `/conversations`.
- Expected: redirect to `/pre-scout-setup` until setup is completed.

## 12. Discovery Contact Is Scout-Gated (No Search-to-Message Bypass)

1. Open the social discovery surface.
2. Search for a verified member and choose intent from modal.
3. Confirm:
- Action routes to Scout (`/scout?prompt=...`) instead of directly creating a thread.
- Messaging thread is only created after Scout/Decision Card authority allows it.
