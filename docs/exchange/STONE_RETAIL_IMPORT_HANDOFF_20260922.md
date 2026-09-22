# TradeScout retail stone — reviewed importer and prepared media, not deployed

## Resume point
Repository: infotradescout/tradescoutAI. Branch: exchange/tradescout-stone-retail-20260921. PR 690 remains draft.
Resumed from e474ce4a365a4bbe480820998ea5af1ae0f12cff after actual storefront/discovery integration.
Current implementation/test commit: 4c83b51d724d5a5ec319e59b4d78a78182b770f6. This document is a checkpoint-only successor.
Preserve the prior storefront, buyer screen, atomic inquiry and registered migrations. Their prior evidence is in STONE_RETAIL_FUNNEL_HANDOFF_20260921.md; do not rebuild them.

## Implemented
- scripts/import-exchange-stone.ts is an operator-only import, not another contact API. It uses the existing 119 canonical material identities, publication signer/validator, public-copy sanitizer and canonical exposure predicate.
- Explicit approval records are the only source of selling prices. Cents, sqft/slab units and exact-slab requirements are validated. No supplier cost formula, placeholder price, stock count, free delivery, or price approval was inferred.
- Real image bytes are fully decoded, checked against reviewed SHA-256, stripped metadata requirements and material-specific immutable paths. Neutral photos go into the existing public_media_objects table; public records do not contain supplier URLs or economics.
- Default mode is a read-only dry run. Apply requires an exact reviewed nonempty plan fingerprint, expected host/database, the existing configured TradeScout seller and exact published TradeScout profile, active category and current exposure authority. No seller setting/profile is created or guessed.
- Selected photos and marketplace rows are inserted/read back in a single serializable transaction. A conflicting existing listing/photo stops the operation rather than being overwritten. Replaying an identical committed plan leaves records unchanged. An uncertain COMMIT is never labeled success.
- Added the importer to the existing release bundle and kept the native Sharp decoder external; Sharp is already declared in runtime/package.json. This is source integration, not evidence that the whole release build passed.

## Exact source hashes
| File | Git blob |
| --- | --- |
| scripts/lib/exchange-stone-import.mjs | acd4ec7efbfa4d1b3e6732c7a64c8b51a1fe5cc2 |
| scripts/import-exchange-stone.ts | 915ef8f0b1a4267fc1d15d800f112a3b780f30a8 |
| scripts/exchange-stone-import.test.mjs | 03c41f347af18e29e55ae505f04b21c638a00076 |
| build-server.mjs | ef92054ae7c83c034ab62648dab422060fe154d3 |
All four match the locally tested bytes. Canonical 119-item identity module also matched a2d016020ef64b98bed85ca12ae7cbd3c5c86ee3.

## Actual media work
Recovered 96 original photos matched the prior source hashes. All 96 were visually reviewed on eight contact sheets, with closer label inspection where needed. Prepared 85 quality-90 WebP files, maximum 2048x2048 without enlargement, with metadata stripped and no content removal. All 85 outputs fully decoded and matched their new hashes (56,238,600 bytes total).
Eleven images are held: nine for visible supplier/manufacturer-label review or replacement, Namib Carrera for a bystander/marketing-composition issue, and Honey Onyx because the image shows an installed display rather than a slab. Twenty-three catalog materials still lack recovered original photos.
The private continuation package contains the 119-item publication manifest, 85 media files, per-photo review records and an EMPTY approved-prices array. This is not a live catalog or proof of current slab inventory. Supplier economics are not included in the new publication package.

## Verification actually run
NODE_PATH=$(npm root -g) node --test scripts/exchange-stone-import.test.mjs
Result: 26 passed, 0 failed, 0 skipped. Tests execute the actual import engine with native local SQLite commit/rollback through an explicit translation adapter, synthetic seller/signature adapters and real Sharp encoding/decoding. PostgreSQL serializable/advisory locks, canonical signer layout and full operator CLI dependencies are not executed by these tests; canonical CLI wiring is source-checked.
TypeScript entrypoint syntax transpilation and node --check for the MJS files passed. No full application typecheck/build or npm run gate:minimum-release was run.
Actual manifest validation against the exact canonical identity module: 119 identities matched, 85 real output images decoded/hash-matched, zero approved rows, 119 held for price approval, zero live writes. This is input validation, not a production database import.
Earlier 75/34 checks and 23 PostgreSQL schema assertions are prior evidence; they were not repeated or counted as new work here.

## Configuration findings and limits
Read-only checks of neondb and lss_release_20260905_422912c581f6 on the known Neon production branch found no matching seller setting/category/TradeScout profile and zero retail rows. Neither was established as the currently running Render application's actual database target. Do NOT present these observations as proof of a production outage or create configuration there speculatively.
Current production service reference: srv-d4rivgm3jp1c7391th0g, tradescoutAI, My Workspace tea-d191jph5pdvs73drglkg, main auto-deploy enabled. No deployment was triggered and no environment variables were changed.
Publication signing retains SESSION_SECRET compatibility with the current reader. Rotation invalidates signatures; do not silently overwrite old rows to re-sign. Buyer metrics remain on their separate STONE_METRICS_SECRET.
Pensacola city-only selected/account-market discovery remains the existing behavior. This continuation does not add physical-IP geolocation, bypass unknown-market selection for crawlers, or guarantee external search-result exclusion.

## Next exact action
Resolve the actual running service database and exact TradeScout seller/profile/category, then configure only the verified target through existing authority. Obtain explicit retail price approval and validate an approved subset against the prepared manifest/media. Run the real native importer transaction and complete Exchange feed -> detail -> sign-in -> inquiry -> seller inbox journey at the exact candidate, including parallel retries. Complete full release checks before merge, apply or public import.
Source execution: npx tsx scripts/import-exchange-stone.ts with --catalog, --approvals, --media-root, --expected-host, --expected-database, --seller-user-id and --profile-id, each as --name=value. Production execution requires the built dist/release/import-exchange-stone.mjs via the existing release launcher. First run without --apply; the apply invocation must repeat identical documents/configuration and add --apply --expected-plan=<dry-run fingerprint>.
Do not infer approval from continuation messages. Zero approved prices and zero live listings/photos remain. Finish the 11 review holds/23 recoveries separately; they need not block an explicitly approved complete subset.

## Side effects
Only this isolated branch, checkpoint and local media/evidence changed. No main merge, deployment, persistent DB write, public photo upload, seller setting change, supplier price change, customer contact, workflow, or new service. No actual buyer-call/Facebook performance claim is supported yet.
