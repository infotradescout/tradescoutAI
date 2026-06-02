# Slice 87 - Direct Connect Liquidity Baseline v1

Date: 2026-06-02
Status: PASS (strategy baseline)

## Decision
Direct Connect needs a liquidity baseline before county launch is treated as proven.

This slice defines the first live demand/supply proof gate. It does not change product behavior, routing, ranking, contact gates, or analytics implementation.

Current launch posture:
- Local hardening: PASS
- Launch Gate v1 doctrine: PASS
- Production board visual proof: PARTIAL PASS
- Live KPI pull: DEFERRED
- Liquidity proof: NOT YET ESTABLISHED

## Scope
TradeScout Direct Connect only.

In scope:
- requester activation target
- contractor activation target
- first-county proof requirements
- completed-outcome definition
- county launch go/no-go threshold

Out of scope:
- MealScout
- Direct Connect UX redesign
- paid placement or ranking logic
- contact-gate changes
- staff KPI auth/session handling
- sitemap drift

## Doctrine Status
Law classifications:
- Visibility does not equal access: enforced
- Intent -> Decision Card -> Contact: enforced
- Home Record optionality: enforced
- No pay-to-play / no lead selling: enforced
- Counties as operational containers: policy_target for live liquidity launch measurement
- Trust/CVS governs exposure: policy_target for future volume-based exposure tuning

No temporary exception is introduced by this slice.

## Minimum Requester Activation Target
Minimum first-county requester proof:
- At least `10` real requester-started Direct Connect requests in the target county.
- At least `5` requests reach review.
- At least `3` requests are submitted.
- At least `2` submitted requests become visible to eligible contractors.

Required measured events:
- `direct_connect_request_started`
- `direct_connect_request_review_opened`
- `direct_connect_request_submitted`
- `direct_connect_request_visible_to_contractors`

Pass interpretation:
- Requester activation exists only when real users can start, review, and submit requests without Home Record being required.

## Minimum Contractor Activation Target
Minimum first-county contractor proof:
- At least `5` eligible contractors/providers have access to the target county request surface.
- At least `2` contractors view or receive routed/visible request opportunities.
- At least `1` contractor starts an action on a visible Direct Connect request.

Required measured event:
- `direct_connect_contractor_action_started`

Pass interpretation:
- Contractor activation exists only when eligible contractors can see and act on real requests without receiving requester contact details before gate release.

## First County Proof Requirements
The first county launch should be considered provisionally liquid only when all are true:

1. Requester path proof:
   - Real requester request-start, review-opened, and submitted events exist in the county launch window.

2. Contractor path proof:
   - At least one submitted request becomes visible to eligible contractors.
   - At least one eligible contractor starts an action.

3. Board integrity proof:
   - No preview/test/HomeID draft artifacts appear as normal live demand.
   - Requester and contractor cards use human-readable copy.
   - No raw enum/internal copy appears in live board cards.

4. Contact-gate proof:
   - No requester or contractor direct contact details are visible before gate release.
   - Contact release remains tied to the governed decision path.

5. Home Record optionality proof:
   - Basic request submission does not require Home Record selection or HomeID linking.

## Real Completed Outcome Definition
A real completed Direct Connect outcome requires all of the following:

- A requester-submitted Direct Connect request.
- Eligible contractor visibility or assignment.
- Contractor action or response.
- Contact-gated progression where contact is released only after the governed decision path.
- A final lifecycle state of completed, pending outcome resolved, or an equivalent auditable closure state.
- No evidence that routing was driven by paid, featured, subscription, or ranking advantage fields.

Not counted as a completed outcome:
- draft-only requests
- HomeID preview drafts
- internal QA/test/smoke requests
- requests with no contractor-visible path
- contractor actions that bypass contact gate doctrine
- requests completed only by admin/test mutation without explicit audit context

## County Launch Go/No-Go Threshold
Launch can move from local-ready to county-proven when the target county has:

- Requester activation: PASS
- Contractor activation: PASS
- Board integrity: PASS
- Contact gate: PASS
- Home Record optionality: PASS
- No pay-to-play influence: PASS
- At least `1` real completed outcome, or `3` submitted requests with eligible contractor visibility and documented follow-up state.

No-go conditions:
- Any contact detail leakage before gate release.
- Any paid/featured/subscription field controlling request visibility or action access.
- Any preview/test/HomeID draft artifact appearing as normal live demand.
- Home Record required for basic request submission.
- Contractor-visible board cards are not inspectable or are not human-readable.
- All funnel traffic remains zero after a controlled county smoke.

## Measurement Gap Check
Current known measurement stack includes:
- `direct_connect_request_started`
- `direct_connect_home_record_prompt_viewed`
- `direct_connect_request_review_opened`
- `direct_connect_request_submitted`
- `direct_connect_request_visible_to_contractors`
- `direct_connect_contractor_action_started`

No new analytics event is required by this baseline yet.

Potential future measurement gap:
- county-scoped liquidity reporting may need a staff-safe breakdown by county once production volume exists.

Decision:
- Do not add code in Slice 87.
- Revisit county breakdown only after live staff KPI access is restored or a controlled county smoke proves missing attribution.

## Next Recommended P1
Recommended next gate:
- Slice 88 - Direct Connect First County Liquidity Proof Runbook

Purpose:
- Define the exact operator steps for a controlled first-county requester/contractor smoke that produces real liquidity evidence without weakening auth, contact gates, or routing doctrine.

Alternative if staff/auth is restored first:
- Reopen the proof path through the existing staff KPI smoke runner and record county/funnel counts if available.

## Final Decision
Slice 87 is a docs-only PASS.

Direct Connect now has a launch liquidity baseline:
- what minimum requester demand means
- what minimum contractor supply means
- what first-county proof requires
- what counts as a real completed outcome
- when the county launch gate is go/no-go

No code change was required.
