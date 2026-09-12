# Exchange batch listings: CSV + labeled photos

Status: implementation candidate; not released. Base: 99e9971cbdf02982b80fa1faa7f18aeb45a17224.

## User workflow

The existing listing form gains One listing and Batch upload CSV + photos modes.
The original form is retained byte-for-byte at marketplace-listing-single.tsx.
Users select a CSV and multiple photos (or a folder), inspect per-row previews,
resolve validation issues, explicitly exclude unmatched files if appropriate,
and submit all rows with one action. Processing is sequential, not an atomic
all-or-nothing database transaction. Successful rows remain saved if later rows stop.

One CSV row is one listing. listing_id is the seller's stable import identifier:

- CAB001 -> CAB001_01.jpg, CAB001_02.jpg, CAB001_03.jpg
- TOOL002 -> TOOL002_01.jpg, TOOL002_02.jpg

Automatic matching is anchored to the full ID and sorts numbers numerically.
Alternatively, images contains exact filenames separated by | in display order.
Explicit relative paths disambiguate same-named files in different folders.
IDs and filenames match case-insensitively. The first matched photo is the main image.

Required columns: listing_id,title,description,price,category,condition,city,state,zip_code,county.
Optional columns: images,price_type,location_visibility,will_ship,shipping_cost,brand,model.
The screen downloads a header-only CSV template and the current category list.
Use current category names/IDs, plain numeric prices and text-formatted ZIP codes.
Location visibility defaults to meetup_only; shipping defaults to false.
Auctions and category-specific structured details still use the individual form.

Initial limits: 100 listings; 8 photos/listing; JPG/PNG/WebP; 10 MB/photo;
500 MB photos/batch; 1 MB CSV. These are client guardrails, not new server quotas.
No ZIP extraction or remote image URL ingestion is introduced.

## Creation, access and interruption behavior

The UI reuses uploadObject and POST /api/marketplace/listings. It never inserts
into storage directly, uses an admin import endpoint, or changes access policies.
CSV columns cannot supply sellerId, status, approval or permission fields.
The authenticated user's ID is passed the same way as the original single form;
server authorization, validation and moderation remain authoritative.
No JW Stone pricing, membership, Drive ingestion or access rules are changed.

All CSV/photo validation completes before uploads or listing creation begin.
Photos for a row upload before its create request. Failures stop the run rather
than submitting a partially photographed row or repeatedly hitting a failed API.
A Web Lock serializes import runs for the same seller across this browser's tabs.
A localStorage receipt is written BEFORE each creation request. Confirmed IDs
are remembered and skipped on repeated imports in this browser. Unknown results
remain marked submitting, pause the run, and are never blindly retried.
An HTTP-success response without a listing ID is not recorded as success.

IMPORTANT LIMITATION: local receipts are not server-side idempotency. They do not
prevent duplicates across devices, cleared storage or other listing-creation
paths. Changed rows do not update existing listings. Unknown results require
reconciliation against the seller's actual listings, not a new ID to bypass the
receipt. This implementation does not expose a receipt-reset button.
Uploads completed before cancellation/failure use existing object-storage
retention; this change does not add orphan cleanup. No background job is claimed.

## Verification performed on the added source

- node --experimental-strip-types --test tests/exchange-batch-import.test.mjs
  PASS: 26 tests, 0 failures (Node 22.16.0).
- tsc --noEmit --strict --target ES2022 --module esnext --moduleResolution bundler
  shared/exchangeBatchImport.ts shared/exchangeBatchRunner.ts
  PASS: isolated strict checking of both shared modules.
- TypeScript transpileModule with ES2022/ESNext/react-jsx on both new TSX pages:
  PASS: syntax/transpilation only, NOT application-wide React typechecking.

Not executed: npm run gate:minimum-release, full application build/typecheck,
format/lint suite, authenticated browser/API/database integration, actual object
storage upload, county-path publication, moderation/verification response tests,
mobile folder picker/accessibility proof, or production deployment checks.
The authorized remote workstation was unavailable; the local sandbox could run
isolated source tests but could not fetch/install the full repository dependencies.
Do not treat these focused checks as release evidence for the entire application.
No GitHub Actions workflow, release gate, branch protection or deployment setting
has been added or weakened.

## Required before release

Run the repository's exact-commit minimum release gate and full app checks. Prove
at least two real test listings with multiple photos on a non-production account,
correct image order and seller/county ownership, normal pending review behavior,
verification denial without false success, rate-limit recovery, interrupted
uploads, ambiguous create responses, browser reload, cross-tab exclusion and
single-listing regression. Confirm server upload validation and creation-response
shape. Remove non-production fixtures after verification. Server-backed import
receipts/reconciliation are needed before advertising cross-device safe retries.
