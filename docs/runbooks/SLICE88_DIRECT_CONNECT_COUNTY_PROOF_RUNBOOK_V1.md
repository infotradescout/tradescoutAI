# Slice 88 - Direct Connect County Proof Runbook v1

Date: 2026-06-02
Status: PASS (runbook baseline)

## Purpose
This runbook defines how to prove Direct Connect liquidity in the first county without weakening contact gates, staff auth, routing doctrine, or no-pay-to-play rules.

Target outcome:
- Real requester demand exists.
- Eligible contractor supply exists.
- At least one county path can move from request to contractor action to auditable outcome.
- Contact remains gated until the governed decision path allows release.

## Scope
TradeScout Direct Connect only.

In scope:
- first proof county selection
- minimum provider density by trade
- request seeding method
- manual response monitoring
- completed-outcome capture
- weekly county launch scorecard

Out of scope:
- MealScout
- paid placement or ranking advantage
- contact-gate doctrine changes
- staff KPI auth bypass
- Direct Connect UI redesign
- sitemap drift

## Doctrine Guardrails
Law classifications:
- Visibility does not equal access: enforced
- Intent -> Decision Card -> Contact: enforced
- No pay-to-play / no lead selling: enforced
- Home Record optionality: enforced
- Counties as operational containers: policy_target for this runbook
- Trust/CVS governs exposure: policy_target for future tuning after live data exists

No temporary exception is introduced.

## First Proof County
Selected county:
- Escambia County, Florida

Operating label:
- Pensacola / Escambia County

Reason:
- Existing Direct Connect product work and route defaults repeatedly center Pensacola/Escambia.
- It is the clearest first county for a controlled proof run before expanding the launch gate.

County proof is not transferable to another county until that county independently meets the same runbook thresholds.

## Minimum Provider Density By Trade
Before a county proof run starts, seed or confirm eligible provider coverage for at least these categories:

- General handyman / small repairs: `3` eligible providers
- Roofing / exterior leak response: `2` eligible providers
- Plumbing: `2` eligible providers
- Electrical: `2` eligible providers
- HVAC: `2` eligible providers
- Cleaning / turnover / property care: `2` eligible providers
- Property management / tenant issue support: `2` eligible providers

Minimum total:
- At least `5` eligible contractors/providers in the county.
- At least `3` trades represented.
- At least `2` providers available for the first seeded request category.

Provider eligibility checklist:
- Provider is tied to the target county/service area.
- Provider can receive or view Direct Connect opportunities.
- Provider is not surfaced through paid, featured, subscription, or ranking advantage logic.
- Provider contact is not exposed to requester before the contact gate.
- Requester contact is not exposed to provider before the contact gate.

## Request Seeding Method
Seed only realistic, non-fake requester scenarios.

Allowed seed types:
- Operator-controlled real test request clearly identified in internal notes.
- Real requester request with consent to use it for county proof tracking.
- Internal smoke request that is excluded from public proof metrics unless explicitly marked as controlled smoke.

Do not count:
- HomeID preview drafts.
- `[hidden]` test artifacts.
- QA-only cards visible as live demand.
- Requests with fabricated completion outcomes.

Minimum seed set:
- `3` submitted requests in the target county.
- At least `2` different trade categories.
- At least `1` request with photos or clear scope details.
- At least `1` request that reaches contractor visibility.

Required requester path:
1. Start request.
2. Open review.
3. Submit request.
4. Confirm Home Record was optional.
5. Confirm request is visible only through legitimate routing/assignment.

Tracked events:
- `direct_connect_request_started`
- `direct_connect_request_review_opened`
- `direct_connect_request_submitted`
- `direct_connect_request_visible_to_contractors`

## Manual Response Monitoring
Monitor daily during the proof window.

Proof window:
- Minimum `7` calendar days.
- Extend to `14` days if no contractor action occurs.

Daily checks:
- New submitted requests.
- Contractor-visible assignments.
- Contractor action starts.
- Contact gate state.
- Requester-facing status copy.
- Contractor-facing card copy.
- Notifications delivered without contact leakage.

Escalate immediately if:
- Direct contact details appear before gate release.
- Preview/test/HomeID draft artifacts appear as live demand.
- Paid/featured/subscription fields affect visibility.
- Contractor cards show raw enum/internal copy.
- A contractor can access an unauthorized request.

Tracked event:
- `direct_connect_contractor_action_started`

## Completed-Outcome Capture
A completed outcome is valid only when it has an auditable lifecycle trail.

Required evidence:
- Request ID.
- County.
- Trade/category.
- Requester submission timestamp.
- Contractor visibility/assignment timestamp.
- Contractor action timestamp.
- Contact gate state transition, if contact was released.
- Final lifecycle state.
- Notes confirming no contact leakage and no paid/ranking influence.

Outcome states that can count:
- Completed.
- Pending outcome resolved.
- Contractor response accepted with documented follow-up state.

Outcome states that do not count:
- Draft.
- Submitted with no contractor visibility.
- Contractor-visible but no contractor action.
- Admin-only completion without audit context.
- Any path that bypassed contact gate doctrine.

## Weekly County Launch Scorecard
Create one weekly scorecard entry per target county.

Required fields:
- County:
- Week:
- Request starts:
- Review opened:
- Requests submitted:
- Contractor-visible requests:
- Contractor actions started:
- Contact-gate approvals/releases:
- Completed outcomes:
- Preview/test artifact incidents:
- Contact leakage incidents:
- Paid/ranking influence incidents:
- Home Record required incidents:
- Notes:
- Decision:

Scorecard decision values:
- `GO`: all go/no-go thresholds met.
- `WATCH`: activation exists, but completed outcome or contractor action remains thin.
- `NO-GO`: any blocker condition occurred or activation is absent.
- `DEFERRED`: proof cannot be completed because live data/auth/session access is unavailable.

## Go/No-Go Threshold
County proof can move to `GO` only when:

- Requester activation: PASS
- Contractor activation: PASS
- Board integrity: PASS
- Contact gate: PASS
- Home Record optionality: PASS
- No pay-to-play influence: PASS
- At least `1` real completed outcome, or `3` submitted requests with eligible contractor visibility and documented follow-up state.

Immediate `NO-GO` conditions:
- Any contact detail leakage before gate release.
- Any preview/test artifact visible as normal live demand.
- Any paid/featured/subscription field controlling request visibility or action access.
- Home Record required for basic request submission.
- Contractor action path unavailable for eligible providers.
- Requester or contractor card copy is not human-readable.

## Operator Checklist
Before proof run:
- Confirm selected county and provider coverage.
- Confirm at least `5` eligible providers.
- Confirm no staff cookie/session material is stored in docs or artifacts.
- Confirm Direct Connect local validation remains green.

During proof run:
- Submit controlled realistic requests.
- Verify contractor visibility.
- Monitor contractor actions daily.
- Record contact gate transitions.
- Record status/card copy issues.

After proof run:
- Produce weekly county launch scorecard.
- Decide `GO`, `WATCH`, `NO-GO`, or `DEFERRED`.
- If `GO`, document the exact county proof evidence before expanding.

## Measurement Gap Watch
No code change is required by this runbook yet.

Watch for these possible gaps:
- No county-scoped funnel breakdown available.
- Contractor visibility exists but cannot be tied to county in staff-safe reporting.
- Completed outcome lacks an auditable lifecycle state.
- Trust Ledger does not capture a meaningful proof point for routed visibility or contact release.

If any of those gaps block the proof run, open a narrow implementation slice for the missing measurement or audit point only.

## Final Decision
Slice 88 is a docs/runbook PASS.

The first county proof process is now defined:
- Escambia County is the initial operating target.
- Provider density requirements are explicit.
- Request seeding is controlled and non-fake.
- Response monitoring is daily.
- Completed outcomes require auditable evidence.
- Weekly launch scorecard determines county go/no-go.
