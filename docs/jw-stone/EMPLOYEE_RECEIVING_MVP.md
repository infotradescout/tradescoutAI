# JW Stone employee receiving MVP

Status: PR #655 is an implementation branch, not a production release. Receiving writes default off. No live employee assignments, inventory rows, Drive files, or production environment variables were changed in this implementation. Creation of an isolated validation service is not deployment of the JW Stone application.

## Employee workflow

An authorized employee signing into the existing JW Stone website gets the receiving workspace. The workspace can close back to the site and reopen from the employee button, even with no public arrivals.

Photograph or select up to eight images and enter material name/family/type, lot label, slab quantity, length, width, thickness, finish, yard/rack location, selling price, optional bundle rate/minimum, optional landed cost, and internal notes. Length and width accept inches or millimeters; thickness is explicitly millimeters. Rates are per square foot or per slab, stored as integer cents. Employees enter measurements and material identity; the application does not infer measurements from photos.

Receive & publish writes one physical inventory record and explicitly selects New Arrivals. The website displays the lot photos, dimensions, quantity and finish, with selling prices in a separate authorized-member response. No second listing-entry step is required by the implementation. A phone-to-live-site round trip remains unverified.

## Manual access

`JW_STONE_EMPLOYEE_USER_IDS` is a comma- or whitespace-separated list of approved immutable authenticated user IDs. Do not use email addresses, profile-account IDs, company names, or a self-selected employee label. No employee accounts were assumed or assigned.

The linked JW Stone business owner and platform super/head administrators retain management access. Ordinary JW Stone business membership does not grant receiving access. Every receiving mutation checks authority before allocating photo buffers. This does not grant BidRock seller, auction or general inventory-delegation authority.

Employee receipt history includes internal information. Public inventory and member selling-price projections exclude landed cost, internal notes and rack locations. Private responses use no-store caching.

## Recoverable local drafts

`jwStoneReceivingDraftStore.ts` stores form fields, original File objects and a frozen submission receipt in IndexedDB, keyed by authenticated employee ID on this browser origin. It does not sync across devices, browser profiles or JW Stone domains. Browser storage is not an encrypted vault: shared-device operators must protect the browser profile, and drafts can contain internal notes and cost information.

The receiving form debounces editing saves and reports when its local write completes. An incomplete local save is not presented as saved. Before any network mutation, the exact receipt UUID and photo bytes must commit locally. After an interrupted upload, reload restores that exact submission for retry rather than generating another lot ID. On a definitive success, a versioned clear removes the local payload. A failed local clear retains the original idempotent submission; it must not create new stock on retry.

All draft writes use a revision comparison in one IndexedDB transaction. Another tab cannot silently overwrite a newer revision. Clearing retains a versioned tombstone to prevent stale tabs resurrecting old photos. Storage errors preserve the existing record and report the failure. An employee can discard an unsubmitted draft after confirmation, but cannot discard an ambiguous already-submitted receipt as though it never reached the server.

A saved local draft is not an offline upload queue or a guarantee against browser eviction, cleared site data, private-mode cleanup or device loss. Publishing still requires connectivity. Server-side pending receipts remain private if source uploads fail. Cross-device recovery and manager repair of abandoned pending server receipts are not implemented.

## Storage and enablement

Required server configuration:

- `JW_STONE_RECEIVING_ENABLED=true` only after acceptance checks and release approval.
- `JW_STONE_RECEIVING_DRIVE_FOLDER_ID`: a writable private receiving subfolder directly beneath the existing JW Stone source root, resolved from `JW_STONE_DRIVE_FOLDER_ID` or the existing shared default.
- Existing Drive application credentials with real write access. A separately connected Drive account or read-only refresh token does not prove the application can write.
- Existing server object storage capable of writing and serving the JW Stone receiving-photo prefix.

The source-folder check rejects public/domain sharing. Named user/group permissions still need operator review. Never loosen Drive sharing or commit credentials to enable receiving.

The service creates a private inventory draft, reserves durable Drive IDs, writes normalized source JPEGs and an immutable private receipt manifest, uploads sanitized public JPEG copies, then publishes transactionally. The private manifest includes costs and cannot be served through the public photo route. Images accept JPEG, PNG or WebP; at most eight files, 10 MB each, with a 60-megapixel decode cap. JPEG outputs are oriented, resized to at most 2400 pixels and re-encoded without copying metadata.

No database migration is introduced. Existing migration-owned Stone Core tables must pass schema checks. Do not use schema push to bypass migrations.

## Inventory and pricing limits

Separate records are required for different size, finish or price groups. This workspace supports receiving and receipt history, not remaining-stock corrections, stock decrement, returns or a complete warehouse-management workflow. The history quantity is labeled as slabs received, not represented as a current remaining-stock count.

Existing administrative inventory controls remain separate and do not write corrections through to immutable receiving receipts. Automatic reconciliation of later Drive edits/deletions is not implemented. Existing inventory freshness policy, currently 45 days, remains unchanged.

Received lots carry explicit lot prices. Arrival inquiries remain available. Checkout integration for these prices is not implemented; cart review rejects substituting an unrelated catalog-name rate. Existing catalog/workbook pricing is not overwritten.

## Verification ledger — September 12, 2026

Previously reported: 28 focused shared-contract and mocked-service tests passed on the initial implementation. Those are not live integration proof and were not rerun as a full suite after the recovery changes.

Executed during the recovery continuation:

- 12 new draft validation tests passed locally on Node 22.16.0. They check employee-key validation, allowed fields, real File requirements, count/size limits, invalid revisions, unsupported storage, and conflict messaging. They do not execute actual IndexedDB transactions.
- Draft-store and receiving-workspace TS/TSX passed syntax transpilation. This is not a full project typecheck.
- The standalone browser-proof script passed JavaScript syntax checking.
- Local Chromium navigation was blocked with `ERR_BLOCKED_BY_ADMINISTRATOR`, so no local browser-recovery pass is claimed.
- GitHub Actions run `34710335734`, head `0412be77fc51d38ab61eb992d899bf24cd8bad59`, ended both `receiving-browser` and `application-checks` jobs in failure with empty step lists and no assigned runner. No browser, typecheck, regression or build step executed. The root cause was not available through the connector.
- The isolated Render validation deployment could not be read back; its status request returned 404. It supplies no build or deployment proof.

Commands committed for repeatable checks:

```sh
node --experimental-strip-types --experimental-vm-modules --test \
  scripts/jw-stone-receiving.test.mjs \
  scripts/jw-stone-receiving-service.test.mjs \
  scripts/jw-stone-receiving-draft.test.mjs
npx playwright install --with-deps chromium
node scripts/jw-stone-receiving-draft.browser.mjs
npm run check
npm run build
```

`.github/workflows/jw-stone-receiving-proof.yml` runs the focused and browser checks separately from full application checks. It has read-only repository permission, does not persist checkout credentials, receives no production secrets, and does not deploy. Failed application steps are aggregated into a failed job rather than hidden by continue-on-error.

The browser script bundles the actual React receiving component with test-only authentication/API adapters. It exercises local form/photo recovery, failed-upload reload/retry, revision conflicts, account-key separation and a denied-member fixture. Even a passing run is not proof of live authentication, camera hardware, Drive/S3 writes or production database behavior.

## Release gates

Keep receiving disabled until full repository checks pass, the required JW Stone browser preview is reviewed, and a real authorized phone-camera -> application Drive/storage -> website submission succeeds in an approved isolated environment. Verify assigned/unassigned accounts, revocation, reload/retry, duplicate prevention, exact price units and internal-cost exclusion. Test the actual JW Stone custom-domain session as well as the canonical site.

Do not merge to main without the required owner release approval. Stock corrections, source reconciliation and received-lot checkout remain unfinished. Disabling receiving stops new intake; it does not delete receipts or unpublish existing stock.
