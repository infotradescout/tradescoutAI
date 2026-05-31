# First-Use Guidance Live Verification (Slice 37)

Date: 2026-05-31 (updated)

Status: PASS (startup clear and guidance verification covered)

## Scope
Live verification for:
- deployed build hash
- startup fallback behavior on core routes
- first-use guidance launcher visibility
- route mapping visibility checks
- page-level guidance visibility
- banned visible copy checks

No feature changes were introduced.

## Build hash proof
- Host: `https://www.thetradescout.com`
- Header now: `x-tradescout-build: 139c11900ec432da26d6538c70368eab1a460b9b`
- Result: PASS (live build contains Slice 50 recovery behavior and passes both live first-use specs)

## Startup fallback verification
Checked live routes:
- `/`
- `/homes`
- `/direct-connect`
- `/scout`

Observed for each route:
- `#ts-boot-fallback` is hidden (`hidden` present, `aria-hidden="true"`, computed `display:none`)
- `document.body[data-app-mounted]` is `true`

Result: startup fallback is not actively blocking live UI on the core routes.

## First-use guidance visibility findings
- `/landing`:
  - Launcher heading `Where should I start?` visible
  - Six launcher options visible
  - Dismiss/restore controls visible and functional
  - Route mapping links present and valid
- `/homes`:
  - Redirects to `/pre-scout-setup?mode=signin&next=%2Fhomes` (expected auth gate)
  - HomeID guidance not visible pre-auth
- `/direct-connect`:
  - Direct Connect guidance visible
- `/scout`:
  - Scout guidance visible
  - No banned-copy hits in first-use guidance surface checks

## New guard added
- Added gated live Playwright smoke:
  - `tests/first-use-guidance-live-ui.spec.ts`
  - Run with `RUN_LIVE_GUIDANCE_UI_SMOKE=1`
  - Verifies launcher/options/dismiss-route mapping/guidance surfaces/banned copy

## Decision
First-use guidance live verification is PASS for release-candidate scope with:
- live startup fallback cleared on core routes
- `tests/first-use-guidance-live-ui.spec.ts` passing live with `RUN_LIVE_GUIDANCE_UI_SMOKE=1`
- `tests/mobile-first-use-smoke.spec.ts` passing live with `RUN_MOBILE_FIRST_USE_SMOKE=1`

Slice 48 first-use watch failure is resolved.
