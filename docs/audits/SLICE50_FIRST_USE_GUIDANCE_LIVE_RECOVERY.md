# Slice 50 — First-Use Guidance Live Recovery

## Decision
- Result: **PASS**
- Recovery target: `/landing` first-use launcher visibility and live smoke stability
- Build verified live: `2140fa54b32ef8fe214eda836bb479c2261364ed`
- Date (America/Chicago): 2026-05-30

## Live Verification

### Build Header
- Endpoint: `GET /api/health`
- Status: `200`
- Header: `x-tradescout-build: 2140fa54b32ef8fe214eda836bb479c2261364ed`

### Live Specs
- `tests/first-use-guidance-live-ui.spec.ts` with `RUN_LIVE_GUIDANCE_UI_SMOKE=1` -> PASS
- `tests/mobile-first-use-smoke.spec.ts` with `RUN_MOBILE_FIRST_USE_SMOKE=1` -> PASS

## What was fixed
- Reset live smoke browser state to fresh-user conditions (cookies + local/session storage clear).
- Accepted auth-gated `/pre-scout-setup?next=...` redirects as valid route mapping for unauthenticated flows.
- Scoped banned-copy checks to the first-use guidance surface to prevent unrelated page-content false failures.
- Added stable first-use surface markers used by smoke assertions.

## Release Watch Status
- Slice 48 watch failure on first-use visibility is resolved.
- First-use guidance live UI: PASS.
- Mobile first-use smoke: PASS.
