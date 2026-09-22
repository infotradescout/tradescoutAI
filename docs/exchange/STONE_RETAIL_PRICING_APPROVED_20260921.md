# TradeScout stone retail — Drive prices approved and matched

## Objective
Use the homeowner prices already in the owner's Drive for TradeScout-owned Exchange stone listings. Preserve JW as the separate supplier, public retail price visibility, and the Pensacola, Florida city-only discovery exclusion. Deliver buyer inquiries/calls, not merely staged records.

## Owner decision — supersedes the previous price blocker
The assistant asked whether TradeScout should use the homeowner-price column found in Drive or a different retail schedule. The owner answered: "in the drive". This selects the existing homeowner column; it is not another generic continuation request. Do not ask for the same price approval again or carry forward "zero approved prices" from earlier checkpoints.

## Base branch/commit
Repository: infotradescout/tradescoutAI.
Branch: exchange/tradescout-stone-retail-20260921.
PR: 690, still draft.
Resumed from 853a911c923e7d8430a9c1ae6b8606ed3ffc2260.

## Current branch/commit
Price-data commit: 7b5073a2cd0caf234bf87a0c04660dd8da2204aa.
This handoff is a checkpoint-only successor. Application/importer code was not changed in this pricing slice.

## Verified completed work
- Fresh connector read and XLSX export of JW Stone Homeowner Pricing, spreadsheet 1RAA-HwtiMUNpRarEWukgOuMMmozpsORpMDoiLWYEYNs. Tab Homeowner Pricing; exact source D2:D120, header Homeowner Single Slab $/Sq. Ft. (+50%). Source modified 2026-09-18T17:06:46.420Z.
- Matched all 119 unique material names to the canonical catalog IDs; converted exact dollar values to integer cents without rounding or an added multiplier.
- Committed the full authorized price snapshot to scripts/data/exchange-stone-homeowner-approval-20260921.json. Git blob 95e11ca37218b1f7faf710c6cc0c8a51b20e389f matches the locally validated bytes.
- Generated standard importer arrays for all 119 approved prices and the 85-photo first batch. The 34 other materials retain approved prices but remain held for photo review/recovery.
- Existing importer input validation accepts all 85 selected first-batch entries with zero price holds. All 85 prepared media hashes were rechecked and images fully decoded. This did not repeat geological/photo-composition review or establish current stock.

## Files changed
Source-controlled: scripts/data/exchange-stone-homeowner-approval-20260921.json and this handoff.
Private package: approved-prices.ALL-119.PRIVATE.json; approved-prices.PRIVATE.json (85); approved-prices.MEDIA-HOLD-34.PRIVATE.json; publication-catalog.READY-85.PRIVATE.json; homeowner-price-source-snapshot.PRIVATE.json; media-holds.PRIVATE.json; updated README and execution receipt. Existing 85 media files are unchanged.

## Tests/evidence already run
- Exact 119-name/ID match, uniqueness, positive exact-cent values, square-foot unit and full snapshot-to-array round trip: passed.
- Existing selectStoneImportInputs executed with the real 85-item manifest and price array: 85 selected, zero held. The other 34 approved prices are retained in the separate photo-held file.
- 85 existing prepared WebP file SHA-256 values matched and all 85 decoded through Pillow.
- No database connection or write was made. Full application, native importer concurrency, signed publication on the real seller account, browser and release gates were NOT run in this slice. Earlier test counts remain earlier scoped evidence, not new executions.

## Tests/evidence invalidated by later changes
No application source changed. The new price data is independently validated; old receipts stating zero approvals are historical only and no longer describe current authorization. No prior test proves production publication of these newly selected prices.

## Known blockers/risks
Pricing is resolved. Production target/seller/profile/category verification, full application release acceptance and actual publication remain outstanding from the prior checkpoint. No new listings or photos are live from this work.
Per-square-foot rates are copied from column D. Column H whole-slab totals are reference-size amounts; they were not converted into a fixed price for an unidentified physical slab. No inventory counts, installation inclusion, free delivery or supplier affiliation claims were invented. This authorization is the checked snapshot, not automatic approval of future Drive changes.

## External side effects and retry safety
Only the isolated branch, private local pricing files and evidence changed. No main merge, deployment, production DB write, public media upload, Drive source edit, JW portal/fabricator-price edit, customer contact or infrastructure creation.

## Next exact action
Continue verified production configuration and full application/release work using the now-priced first batch. Use --catalog=publication-catalog.READY-85.PRIVATE.json together with --approvals=approved-prices.PRIVATE.json and --media-root=prepared-media for the existing importer. The expected database host/name and exact TradeScout seller/profile still must be verified; first perform its read-only dry run and then the controlled apply after release acceptance.
The repository price snapshot is a compact envelope: expand each prices item with status, unit, approvedBy and approvedAt from the envelope to get the existing importer's standard approval-array format. The private package already includes those exact expanded arrays. Use the ready 85-item manifest for the initial batch; passing the full catalog and all 119 approvals to the current strict importer correctly fails on 34 pending photos. Do not weaken media review to bypass those holds.

## Actions that must NOT be repeated
Do not request this same price approval again. Do not apply another 50% markup, use fabricator column C as the public price, switch the seller to JW, or edit JW pricing. Do not reconstruct the storefront, inquiry transaction, migrations, images or identity set. Do not rerun unchanged schema-only milestones instead of completing the live buyer path. Preserve concurrent branches and do not merge without required release evidence.
