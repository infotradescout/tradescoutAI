# Slice 74 — Direct Connect Home Record Collapse + Saved Home Label Cleanup

Date: 2026-06-01  
Status: PASS

## Goal
Finish mobile request-composer usability by making Home Record truly optional/secondary and removing internal/test-looking saved-home labels from normal UI.

## Root Cause
Home Record was still expanded in live mobile smoke and contained duplicated controls, while saved-home labels could expose generated/test-looking values that reduce trust.

## Fix Summary
1. Kept Home Record collapsed by default with compact optional copy.
2. Showed Home Record action controls only after explicit user expansion.
3. Removed redundant "How should this request use home details?" selector flow.
4. Rendered saved-home dropdown only for the explicit link-existing path.
5. Added saved-home label cleanup priority:
   - nickname/name/title (if not generated-looking)
   - address
   - city/state
   - fallback `My home` / `Saved home`
6. Removed internal QA copy from user-facing UI.
7. Preserved optional skip behavior and existing Home Record + funnel analytics wiring.

## Files
- `client/src/pages/direct-connect/DirectConnectShell.tsx`
- `server/tests/direct-connect-home-record-link-prompt.contract.test.ts`
- `docs/audits/TRADESCOUT_PRODUCTION_READINESS_CLOSEOUT.md`

## Validation
- `npm run check` PASS
- `npm run test` PASS
- `npm run build` PASS

## Next
Run fresh staff-browser production mobile + board smoke on `/direct-connect` and confirm Slice 74 visual pass criteria before moving to the next funnel KPI pull.
