# Exchange CSV + photos batch import

Status: implementation candidate, not released. This revision replaces the
browser-only import path in PR #653. The original single-listing form remains
unchanged; all creation still uses the existing authenticated Exchange endpoint.

## User workflow

One CSV row is one listing. Select the CSV and JPG/PNG/WebP photos together, or
select a folder. For listing_id CAB001, automatic matching uses CAB001_01.jpg,
CAB001_02.jpg, etc., sorted numerically. Alternatively, the images column contains
exact filenames separated by | in display order. Relative paths disambiguate
same-named files in different folders. The first matched photo is the main image.

The preview reports malformed CSV, missing and ambiguous photos, duplicate IDs,
unknown columns and invalid fields. Unmatched files require explicit exclusion.
Limits remain 100 listings, 8 photos/listing, 10 MB/photo, 500 MB photos total,
and 1 MB CSV. Existing category-specific photo minimums still apply.

Required base columns: listing_id,title,description,price,category,condition,city,
state,zip_code,county. Optional: images,price_type,location_visibility,will_ship,
shipping_cost,brand,model. Category accepts a current Exchange category name or ID.
Use numeric prices, two-letter states and text-formatted ZIP codes.

Category-specific templates derive their spec_* columns from SELL_CATEGORY_FIELDS.
Examples: spec_dimensions, spec_delivery_option, spec_powers_on, spec_provenance,
spec_handoff, spec_proof, spec_make, spec_model, spec_year and spec_mileage.
An optional specifications column accepts a flat JSON object with simple values.
Reserved identity/authority fields cannot be supplied through specification
columns. Conflicting fields and invalid numeric values are errors. Explicit
attestations accept true or false; they are never invented or auto-accepted.
The existing validateExchangeCategoryListing function validates each prepared row
before upload. This does not change any category, JW Stone, membership or contact
policy. Category-specific detail and photo checks are not an authorization grant.

## Recovery and duplicate protection

Before uploading, the importer reads the authenticated seller's complete
/api/marketplace/my-listings response (all statuses, not the public browse feed).
It rejects malformed records, another seller's records, or existing duplicate
import IDs. A SHA-256 fingerprint covers the original listing payload and the
ordered hashes of the actual photo bytes, not filenames or generated upload URLs.
Object-key ordering, import-ID casing and equivalent money formatting do not
change the fingerprint. Price/detail/photo changes using an existing ID are
conflicts, not silent overwrites. Legacy imported rows with no fingerprint are
flagged for manual review, not blindly recreated.

All existing-key conflicts are checked before the first photo upload. Rows already
imported with the same fingerprint are skipped, even in a fresh browser. A failed
or ambiguous POST is reconciled once against the seller's saved records. A matching
record is confirmed and processing continues. A changed record is a conflict. An
unconfirmed result pauses the import; there is no blind POST retry in the run.
A verification response without an actual listing record is never called success.

The database migration adds a unique partial index over seller_id and normalized
specifications.externalListingId. It includes all statuses and prevents duplicate
inserts for the same seller/key even when clients race. Separate sellers can reuse
an ID, and ordinary non-imported listings are unaffected. No rows are deleted or
merged by the migration; pre-existing duplicate keys cause migration failure and
require an explicit cleanup decision. The migration is appended to the Drizzle
journal without changing any historical entry.

Web Locks are an optional optimization to avoid redundant same-browser uploads,
not the correctness mechanism. The new UI does not depend on localStorage.
The previous exchangeBatchRunner module remains only for the earlier focused
regression tests; it is not used by the batch screen anymore.

## Boundaries

This is create-only, sequential browser orchestration, not an atomic batch or a
background job. Users keep the tab open or reselect the CSV/photos to resume.
Finished listings stay saved. Uploads abandoned before listing creation still use
existing object-storage retention; this change does not add orphan cleanup.
There is no ZIP ingestion or remote-image fetching.

Uniqueness applies while a listing retains its import identity. Deliberately
changing/removing an import ID or deleting the listing removes that matching
identity; there is no immutable import ledger or deletion tombstone in this
revision. The fingerprint refers to the original import, not subsequent manual
edits. Reimporting does not overwrite those edits. Legacy imports without a
fingerprint require review. Cross-device concurrent HTTP/browser behavior still
requires the release tests below; database uniqueness alone is not end-to-end proof.

## Executed verification

- Node 22.16.0: node --experimental-strip-types --test
  tests/exchange-batch-recovery.test.mjs — 37 tests passed, zero failed/skipped.
- Strict isolated TypeScript checking: tsc --noEmit --strict --target ES2022
  --module esnext --moduleResolution bundler shared/exchangeBatchRecovery.ts
  shared/exchangeBatchDetails.ts — passed.
- TypeScript transpileModule ES2022/ESNext/react-jsx on the revised batch screen —
  zero syntax/transpilation diagnostics. This is not application-wide typechecking.
- PostgreSQL 17.11 in the existing isolated TradeScout migration-proof project:
  exact index expression verified on a temporary fixture table in pg_temp only.
  Same-seller/case/whitespace duplicates across statuses were rejected; another
  seller could reuse the key; ordinary/null/blank-key records were allowed; the
  original row was unchanged; a failed multi-row INSERT left no partial writes.
  Index reported indisunique=true and indisvalid=true. The fixture used ON COMMIT
  DROP. No production schema, data, branch or settings were changed.
- The original 142-entry journal was reconstructed from the fetched source and
  verified byte-for-byte against Git blob e780efcff903ea74430a4e3511abf9fdf458316d
  before appending entry 142. Historical migration ordering and timestamps are intact.

The earlier 26-test parser/legacy-runner report is from the prior revision; those
26 tests were not rerun in this revision. They must not be added to the new run's
37-test count or represented as current integration proof.

## Remaining release gates

The remote workstation still returned no connected devices. The sandbox cannot
resolve GitHub to obtain/install the full application dependencies. The connected
Neon proof database was usable for isolated SQL tests; this does not substitute
for the application's signed-in browser/API/object-storage flow.

Before merge/release: reconcile with current main, run the exact-commit
npm run gate:minimum-release, full build/typecheck/lint, original regressions and
signed-in end-to-end tests. Apply the registered migration through the normal
release path and verify its presence on the deployment target. Check existing-key
collisions before deployment: the non-concurrent unique index takes a table lock.
Do not weaken release gates or bypass an index-creation failure.

Required end-to-end cases: two actual test listings with multiple photos; image
order, seller and county correctness; category denial before upload; verification
and moderation behavior; rate limits; interrupted upload; a lost successful POST
response; refresh/new browser; two concurrent clients; account change; a legacy
import; a changed photo with the same filename; and the unchanged single-listing
flow. No production fixture listings were created in this session.
