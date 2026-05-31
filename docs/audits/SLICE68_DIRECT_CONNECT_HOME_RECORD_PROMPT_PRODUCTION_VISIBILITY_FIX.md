# Slice 68 — Direct Connect Home Record Prompt Production Visibility Fix

Date: 2026-05-31

## Goal
Fix the production funnel gap where `direct_connect_request_started` events were present but `direct_connect_home_record_prompt_viewed` remained `0`.

## Trigger Evidence
From Slice 67 staff-authenticated KPI pull:
- `direct_connect_request_started`: `5`
- `direct_connect_home_record_prompt_viewed`: `0`
- Build: `52c29813...`

## Root Cause
`prompt_viewed` relied on render-time effect coverage only.  
In production request-start behavior, users could emit `request_started` without a guaranteed matching `prompt_viewed` emission.

## Fix Applied
File:
- `client/src/pages/direct-connect/DirectConnectShell.tsx`

Changes:
1. Added one-time helper `emitHomeRecordPromptViewed(...)` guarded by `homeRecordPromptViewedRef`.
2. Kept render-time tracking (existing behavior) but routed it through the helper.
3. On first `markRequestStarted(...)`, explicitly trigger:
   - `emitHomeRecordPromptViewed("direct_connect_home_record_prompt_request_start")`
4. Preserved:
   - existing link/create/skip events
   - skip non-blocking behavior
   - existing Direct Connect lifecycle behavior and contact gate doctrine

## Event Behavior After Fix (Expected)
- First request-start interaction now guarantees:
  - `direct_connect_request_started`
  - `direct_connect_home_record_prompt_viewed` (once per page lifecycle)
- Re-renders do not spam `prompt_viewed`.

## Test Coverage
Updated contract coverage in:
- `server/tests/direct-connect-home-record-link-prompt.contract.test.ts`

Checks include:
- prompt-view event function presence
- one-time guard
- request-start path now references prompt-view source:
  - `direct_connect_home_record_prompt_request_start`
- submit-after-skip remains intact

## Validation
- `npm run check`: PASS
- `npm run test`: PASS
- `npm run build`: PASS

## Scope Guard
- No Direct Connect UX redesign.
- No HomeID data contract change.
- No staff-gate weakening.
- No paid placement/ranking changes.

## Next Recommended P1
Run fresh staff-authenticated production KPI pull after this deploy and re-check:
- prompt view rate
- link/create/skip rates from prompt viewed
- submission behavior after skip

