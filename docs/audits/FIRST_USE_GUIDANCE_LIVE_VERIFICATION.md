# First-Use Guidance Live Verification (Slice 35 + Slice 36 Follow-up)

Date: 2026-05-30

Status: PASS (startup fallback repaired/cleared)

## Scope
Live verification for:
- deployed build hash
- startup fallback behavior on core routes
- first-use guidance surface visibility where route access allows

No feature changes were introduced.

## Build hash proof
- Host: `https://www.thetradescout.com`
- Header now: `x-tradescout-build: 061a0739ad6e3d42831075893aaf61a17329e369`
- Result: PASS (`47d69add` or newer confirmed)

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

## Why Slice 35 looked blocked earlier
The previous check relied on raw `body.textContent`, which includes text from hidden fallback DOM and style tags.
That produced a false blocker signal even though the app shell had mounted.

## Guidance surface notes
- `/direct-connect`: Direct Connect guidance visible
- `/scout`: Scout guidance visible
- `/homes`: unauthenticated redirect to `/pre-scout-setup?mode=signin&next=%2Fhomes` (expected gate)
- `/` resolves to `/landing`; launcher verification should target the intended app route after auth/path selection

## Decision
Startup fallback blocker is cleared.
Guidance live verification should continue with auth-aware route checks for `/homes` and launcher path targeting.
