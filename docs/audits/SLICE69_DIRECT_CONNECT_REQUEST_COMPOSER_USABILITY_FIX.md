# Slice 69 — Direct Connect Request Composer Usability Fix

Date: 2026-05-31

## Goal
Make Direct Connect clearly usable without HomeID/Home Record by prioritizing request inputs first and keeping Home Record as optional enrichment.

## Problem
The request composer visually prioritized Home Record structure before core request details, making the flow feel blocked by optional home-data setup.

## Changes
File:
- `client/src/pages/direct-connect/DirectConnectShell.tsx`

What changed:
1. Kept core request fields first:
   - request intent chips
   - request type
   - detail questions
   - request photos
2. Moved Home Record to a compact optional module after core request inputs.
3. Added a compact CTA row:
   - `Use saved home details`
   - `Create a home record`
   - `Skip for now`
4. Added optional expansion (`Show options` / `Hide options`) for detailed Home Record controls.
5. Hid advanced technical field from default flow:
   - removed default `Existing component ID (optional)` input
6. Preserved existing non-blocking skip behavior and analytics event flow.

## Preserved Behavior
- Users can create/review a request without selecting/creating/linking Home Record.
- Home Record link/create/skip logic remains available.
- `direct_connect_request_started` tracking remains.
- Prompt/link/create/skip/submitted-after-skip analytics remain.
- Contact-gate/lifecycle behavior unchanged.

## Tests
Updated:
- `server/tests/direct-connect-home-record-link-prompt.contract.test.ts`

Coverage includes:
- Home Record module is optional and compact.
- Core request labels appear before Home Record controls.
- Advanced component ID field is no longer in default flow.
- Prompt-view and submit-after-skip instrumentation remains present.

## Validation
- `npm run check`: PASS
- `npm run test`: PASS
- `npm run build`: PASS

## Next Recommended P1
After deploy, run a fresh staff-authenticated KPI pull to verify:
- `direct_connect_home_record_prompt_viewed > 0` when `direct_connect_request_started > 0`
- then decide whether next step is CTA interaction tuning or next funnel bottleneck.

