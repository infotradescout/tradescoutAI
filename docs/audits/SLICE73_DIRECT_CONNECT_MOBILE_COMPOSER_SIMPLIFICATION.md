# Slice 73 — Direct Connect Mobile Composer Simplification

Date: 2026-06-01  
Status: PASS

## Goal
Make the Direct Connect mobile request composer clearly request-first for normal users.

## Root Cause
Mobile `/direct-connect` still surfaced process/HomeID framing and navigation ahead of the core request composer, causing request creation friction despite KPI event health.

## Fix Summary
1. Demoted top process/HomeID guidance cards on mobile request-create path (`post` section).
2. Moved mobile tab-pill navigation below the composer for `post` to avoid pushing request fields down.
3. Added explicit fallback core request fields when intent config is absent:
   - request title
   - request description
   - job location
4. Made Home Record visually secondary by keeping action controls inside collapsed details state.
5. Added clear disabled-review guidance message listing missing required details.
6. Preserved existing Direct Connect and Home Record analytics events.

## Files
- `client/src/pages/direct-connect/DirectConnectShell.tsx`
- `docs/audits/SLICE70_DIRECT_CONNECT_MOBILE_USABILITY_SMOKE_POST_FIX_KPI.md`
- `docs/audits/TRADESCOUT_PRODUCTION_READINESS_CLOSEOUT.md`

## Validation
- `npm run check` PASS
- `npm run test` PASS
- `npm run build` PASS

## Next
After deploy, run staff-auth production mobile + board smoke and then pull Slice 72 funnel KPI to determine the next measured drop-off.
