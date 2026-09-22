# TradeScout retail stone — labels do not block publication

## Objective
Publish TradeScout-owned stone listings using the approved Drive homeowner rates, generating real buyer interest/calls while keeping JW the separate supplier. Labels are not blockers. Cropping is optional when useful, not an additional publication gate.

## Base branch/commit
Repository: infotradescout/tradescoutAI
Branch: exchange/tradescout-stone-retail-20260921
Resumed from d826aabc4e10865eb9717222557d05a483838102 (Drive prices approved).
PR 690 remains draft. Do not restart storefront, inquiry, migration or price-approval work.

## Current branch/commit
Photo policy/data commit: 8ba3c6e1b5a48f42e7060d2fd3b9e95c9285f0a0.
This document is its checkpoint-only successor; PR metadata records the resulting head.
Canonical decision: scripts/data/exchange-stone-photo-policy-20260922.json.
Exact Git blob verified against local bytes: d5758c9666df41fd618dad50b5e3924b13285cb8.

## Verified completed work
Owner explicitly said: "labels arent a blocker, pics can be cropped if needed".
Removed all nine label-only holds from the actual private publication manifest, not just the status summary.
Also cleared the two previously acknowledged presentation errors: Honey Onyx is a freestanding slab photograph; Namib Carrera is a usable material-reference photograph with a bystander at the edge. Cropping is optional.
Prepared 11 additional WebP files from original source bytes, matching all 11 prior source hashes. Existing 85 prepared files and their review metadata were preserved. Encoding followed the existing max-2048/no-enlargement, quality-90, metadata-stripped pipeline. No crops, retouching, object removal or stone-color/veining adjustments were performed.
Current counts: 119 unchanged approved prices; 96 complete price/photo input pairs; zero label holds; 23 unretrieved originals. No defect is established for those 23 missing files.

## Files changed
Repository: the photo-policy JSON plus this handoff.
Private publication package: publication-catalog.PRIVATE.json, publication-catalog.READY-96.PRIVATE.json, approved-prices.PRIVATE.json (96), approved-prices.PHOTO-MISSING-23.PRIVATE.json, media-holds.PRIVATE.json, updated photo-review results, 11 added prepared-media files, README and validation receipt.
All-119 approved price array remains byte-identical. Old READY-85 inputs/review decisions are retained under history, not current import instructions.

## Tests/evidence already run
Executed the existing importer input validator on the actual new READY-96 catalog and 96-entry price array: 96 selected, zero price holds. The imported engine file matched existing Git blob acd4ec7efbfa4d1b3e6732c7a64c8b51a1fe5cc2.
All 96 files fully decoded and matched their immutable hashes; existing validateStoneMedia accepted format, dimensions, frame count and stripped metadata. Total prepared bytes: 62,307,874.
Verified 119 unique canonical material names/IDs, all 119 prices matching the already-authorized compact snapshot, and preservation of all 85 prior media entries/files. The identity module matched existing Git blob a2d016020ef64b98bed85ca12ae7cbd3c5c86ee3.
This is actual publication-input/media validation, not a database dry run, full application test or deployment.

Exact SHA-256 of current private inputs:
- publication-catalog.READY-96.PRIVATE.json: 4c22f83cf93a730a2b0187aa18889e4f8ea6f98ad31b8ffd3cb990771b5ac77c
- approved-prices.PRIVATE.json: b73dc5f82d519c5b584e8a70382a489ba0fadeb8ff61f1138f363c55739b7f67
- approved-prices.ALL-119.PRIVATE.json: 92044602ae37b8a97204689f29889bb5dd86634048c67f9615df3ce57e949845
- media-holds.PRIVATE.json: 5a1292e834555adb541e2d540c7fd12384f66687958707c9cd0b64f5f26f792d

## Changed but unverified work
The expanded 96-item batch has not been applied to any database or public object store. Application/runtime code is unchanged by this slice. Existing full-application, actual PostgreSQL import/inquiry concurrency, current integrated browser and minimum-release acceptance remain incomplete as documented in earlier handoffs.

## Tests/evidence invalidated by later changes
Earlier 85-input validation does not describe the expanded batch; the new 96-input validation replaces it for publication preparation. No runtime-code tests were invalidated by this data/policy-only change. Do not re-count historical tests as new executions.

## Known blockers/risks
23 source photos are still unretrieved; do not describe these as bad photos or unapproved prices.
The source asset map assigns identical photo bytes to Matarazzo and Matarazzo Zucchi. This is recorded as shared material-reference provenance, not proof of two exact physical slabs or quantities. Do not infer geological identity from appearance, inventory or stock from image reuse. Exact material/slab selection remains to be confirmed before purchase.
Verify the actual running production database and exact TradeScout seller/profile/category before any apply. Complete existing release checks; this correction is not a waiver of database/authority integrity.
TradeScout/JW separation and the Pensacola-city-only selected/account-market rule remain unchanged. No physical geolocation/search-engine guarantee was added.

## External side effects and retry safety
Only this isolated feature branch/PR and local publication files changed. No production deployment, main merge, database mutation, public media upload, Drive edit, JW price change, customer contact or new infrastructure. Zero new live listings from this work.
Original source archive, prior 85 prepared files and approved prices are retained. The existing importer still defaults to read-only and requires a verified target and exact nonempty dry-run plan for apply.

## Next exact action
Use publication-catalog.READY-96.PRIVATE.json with approved-prices.PRIVATE.json and media-root=prepared-media from the updated private package. Verify production seller/database configuration, complete application/release acceptance, then run the real operator dry run and controlled apply for this complete subset. Recover 23 missing originals separately. Pricing and labels are resolved owner decisions, not pending questions.

## Actions that must NOT be repeated
Do not reinstate label, ordinary yard background or optional-crop holds. Do not ask again for the approved Drive price schedule. Do not rebuild completed storefront, inquiry logic or migrations. Do not let unresolved originals prevent the complete 96-item subset from progressing through release. Do not claim these prepared inputs are live listings or proven Facebook outperformance.
