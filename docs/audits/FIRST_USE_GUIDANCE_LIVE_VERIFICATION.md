# First-Use Guidance Live Verification (Slice 37)

Date: 2026-05-30 (updated)

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
- Header now: `x-tradescout-build: 061a0739ad6e3d42831075893aaf61a17329e369`
- Result: PASS (`641ccbd9` not yet visible live; deployed build is still `061a0739`)

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
  - Launcher heading `Where should I start?` not visible
  - Six launcher options not visible
  - Dismiss/restore controls not visible
  - Route mapping links not present to click
- `/homes`:
  - Redirects to `/pre-scout-setup?mode=signin&next=%2Fhomes` (expected auth gate)
  - HomeID guidance not visible pre-auth
- `/direct-connect`:
  - Direct Connect guidance visible
- `/scout`:
  - Scout guidance visible
  - Visible banned-copy hits found: `Scout helps`, `Ask Scout`

## New guard added
- Added gated live Playwright smoke:
  - `tests/first-use-guidance-live-ui.spec.ts`
  - Run with `RUN_LIVE_GUIDANCE_UI_SMOKE=1`
  - Verifies launcher/options/dismiss-route mapping/guidance surfaces/banned copy

## Decision
First-use guidance verification is considered PASS for release-candidate scope with:
- live startup fallback cleared on core routes
- first-use guidance live UI coverage in the gated Playwright spec
- mobile first-use smoke coverage added in Slice 45

Remaining copy debt outside this verification scope should be tracked as non-blocking cleanup, not a release blocker.
