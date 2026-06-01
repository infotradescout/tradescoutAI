# Slice 70 — Direct Connect Mobile Usability Smoke + Post-Fix KPI Check

Date: 2026-06-01  
Status: PARTIAL KPI PASS / MOBILE UX FAIL

## Decision
Close Slice 70 as KPI evidence pass, mobile usability fail.

## Production Evidence
- Build: `1808df640b506584733185b645fa62131a2e9642`
- KPI status: `200`
- `direct_connect_request_started`: `5`
- `direct_connect_home_record_prompt_viewed`: `5`
- Prompt view rate: `100%`

## Mobile Smoke Result
- Mobile smoke: `FAIL`
- Board smoke: `PENDING` (insufficient visual evidence captured in the failed pass screenshot)

## Failure Reason
The mobile Direct Connect screen still leads with process/platform mechanics before clear request creation:
1. Process-first copy appears above request creation.
2. HomeID/Home Record concepts remain too prominent in initial view.
3. Large nav pills appear before core request completion.
4. Core request fields are not obvious enough for normal-user completion flow.
5. Review path remains unclear when disabled.

## What This Proves
1. Analytics event delivery from Slice 68 is fixed.
2. Live UI hierarchy still fails the request-first mobile standard.
3. Next work should be UX simplification, not more KPI-only work.

## Next P1
Slice 73 — Direct Connect Mobile Composer Simplification.
