# Slice 67 — Staff-Authenticated Live KPI Pull + Funnel Decision

Date: 2026-05-31

## Scope
- Measurement and decision only.
- No Direct Connect UX redesign.
- No HomeID behavior change.
- No contact-gate doctrine change.

## Reference Commits
- Slice 64: `b2296620`
- Slice 65: `a84a5c0d`
- Slice 66: `52c29813`
- Slice 67 (this update): `e93d7884`

## Live Build Verification
- Endpoint checked: `GET /api/health`
- Result: `200`
- Build header:
  - `x-tradescout-build: 52c29813b57e1d561302449dd53d6bb18c7e62a1`
- Decision:
  - Deployment lag blocker is cleared (`52c29813+` is live).

## KPI Endpoint Access Verification
- Endpoint: `GET /api/analytics/product-kpi/summary`
- Unauthenticated check result: `403` (staff-gated as expected)
- Staff-authenticated pull result: `200`

Measurement window:
- from: `2026-05-24T19:22:32.690Z`
- to: `2026-05-31T19:22:32.690Z`
- total events: `5`

## Required Funnel Fields
- `direct_connect_request_started`: `5`
- `direct_connect_home_record_prompt_viewed`: `0`
- `direct_connect_home_record_link_selected`: `0`
- `direct_connect_home_record_create_selected`: `0`
- `direct_connect_home_record_skipped`: `0`
- `direct_connect_request_submitted_after_home_record_skip`: `0`
- `direct_connect_homeid_link_selected`: `0`
- `direct_connect_homeid_created_from_request`: `0`
- `direct_connect_homeid_updated_from_request`: `0`

Breakdowns:
- `bySurface`: `unknown: 5`
- `byUserState`: `unknown: 5`

Derived rates:
- prompt view rate: `0 / 5 = 0%`
- link/select rate from prompt viewed: not measurable (`prompt_viewed = 0`)
- create rate from prompt viewed: not measurable (`prompt_viewed = 0`)
- skip rate from prompt viewed: not measurable (`prompt_viewed = 0`)
- submit-after-skip rate from skipped: not measurable (`skipped = 0`)
- abandonment after prompt: not inferable (`prompt_viewed = 0`)

## Decision Outcome
Status: **PASS (decision-ready)**

Final decision:
1. Production deployment and staff-auth KPI access are confirmed.
2. `direct_connect_request_started > 0` while `direct_connect_home_record_prompt_viewed = 0`.
3. This indicates a production visibility/tracking gap for the Home Record prompt in the real request-start flow.

## Next P1 (Narrow)
- Slice 68: **Direct Connect Home Record Prompt Production Visibility Fix**
- Do not redesign CTA/copy yet.
- Fix render coverage and/or prompt-view event firing in production request-start paths first.

## Validation
- `npm run check`: PASS
- `npm run test`: PASS
- `npm run build`: PASS
