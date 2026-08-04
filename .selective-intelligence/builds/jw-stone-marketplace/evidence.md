# Build Evidence: jw-stone-marketplace

Verdict: implementation in progress on `jw-stone/marketplace-end-user-reset`; owner local preview required before merge

## Authorized correction

The product owner voided the customer-path guide. `/jw-stone` is catalog-first with proportional Learn about stone. Lock version `1.2.0`.

## Implemented correction

- Removed `CustomerPathGuide`, `customerPathGuidance`, buyer URL UI, and path-guide SI requirements.
- Page order: header → hero → First Cut → Current Inventory → Learn about stone → footer → overlays.
- Legacy `?buyer=` ignored and not serialized.
- Public HTML/metadata retitled to Stone Discovery with learn summary instead of audience guidance theater.

## Remaining proof

- Focused unit/contract tests on the reset branch.
- Desktop and mobile local preview of `/jw-stone` with screenshots under `artifacts/jw-stone-2/`.
- Owner GO before draft PR merge to `main`.
