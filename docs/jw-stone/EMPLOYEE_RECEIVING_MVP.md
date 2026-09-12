# JW Stone employee receiving MVP

Status: implementation branch, not a production release. Receiving writes are disabled unless explicitly configured. No live employee assignments, inventory rows, Drive files, or production environment variables were changed while developing this branch.

## Employee workflow

Sign into the existing JW Stone website. An authorized employee sees the receiving workspace automatically and can close it to browse the site. The employee button remains available even when there are no public arrivals.

Photograph or select up to eight images and enter material name/family/type, lot label, slab quantity, length, width, thickness, finish, yard/rack location, selling price, optional bundle rate and minimum quantity, optional landed cost, and internal notes. Length and width accept inches or millimeters; thickness is explicitly millimeters. Prices are per square foot or per slab, with integer-cent storage. Measurements and material identity are entered by the employee, not guessed from photos.

Receive & publish saves one physical inventory record and explicitly marks it for New Arrivals. Images, dimensions, quantity, finish, and authorized selling prices are displayed on the site without a second listing-entry step. Every image can be viewed from the arrival card. Successful receiving invalidates the site's inventory query; its new JW-only endpoint has no-store caching and visible pages also refresh periodically.

## Manual access

Set `JW_STONE_EMPLOYEE_USER_IDS` to a comma- or whitespace-separated list of approved immutable authenticated user IDs. These are user IDs, not emails, profile-account IDs, company names, or a self-selected employee label. No employee IDs are supplied by the application or assumed from membership.

The linked JW Stone business owner and platform super/head administrators retain management access. An ordinary JW Stone business member does not gain receiving access. Every receiving request checks server-side authorization before allocating upload buffers. This does not grant BidRock seller access, auction authority, or general inventory delegation.

Member selling prices use the existing JW Stone business-membership access resolver. Public inventory responses do not include prices, internal notes, costs, or rack locations. The separate member response explicitly projects selling-price fields. Receipt history containing internal information is employee-only and private/no-store.

## Storage and enablement

Required server configuration:

- `JW_STONE_RECEIVING_ENABLED=true` only after acceptance checks and release approval.
- `JW_STONE_RECEIVING_DRIVE_FOLDER_ID`: a writable private receiving subfolder directly beneath the existing JW Stone source root. The root is `JW_STONE_DRIVE_FOLDER_ID` or the existing shared default.
- Existing Drive application credentials must actually support writing. A refresh token granted read-only access cannot be upgraded by this code. Validate a real application write, not merely access through a separate connected Drive account.
- Existing server object storage must support the JW Stone public-media prefix and serving the resulting images.

The source-folder check rejects public/domain sharing, but an operator must also review the named user/group grants. Do not loosen Drive sharing to make receiving work. No credentials belong in Git or client configuration.

For a new lot, the service creates a private inventory draft, durably reserves Drive identifiers, writes normalized source JPEGs and an immutable private receipt manifest, uploads sanitized public JPEG copies, and only then publishes the inventory position. The manifest contains internal cost information and is never served by the photo route. Images are decoded, oriented, resized to at most 2400 pixels, and re-encoded as JPEG without copying metadata. Supported input formats are JPEG, PNG, and WebP, with eight files maximum, 10 MB per file, and a 60-megapixel decode cap.

No database migration is introduced. The existing stone schema must already pass its critical-schema check. Do not use schema push to bypass migrations.

## Retry and first-release boundaries

A receipt UUID, exact payload fingerprint, durable source-file IDs, and a business/lot advisory lock protect same-submission retries. A failed source upload leaves a private draft. A failed final publication transaction rolls back publication. Duplicate lot labels are input errors so the employee can correct the entry rather than remain trapped in retry mode.

Closing the workspace retains the current form and photo selection. Transient access-check errors do not discard an already-open form. This is not an offline queue: a reload, logout, browser termination, or device change loses the local photo payload. Server drafts remain private and may need manager recovery. Browser navigation warnings are not a substitute for persistent draft recovery.

Use a separate record for each size/finish/price group. The first workspace supports receiving and recent-receipt history, not a complete correction, stock-decrement, returns, or warehouse-management workflow. Existing administrative inventory tools remain separate and do not yet write corrections through to these immutable Drive receipts. Automatic reconciliation of later Drive edits/deletions is not implemented.

The existing platform inventory freshness policy is preserved, currently 45 days. This branch does not redefine physical availability or renewal policy.

New receiving lots have lot-specific prices. Their arrival inquiry remains available; checkout integration for these lot prices is not implemented. Existing cart review explicitly rejects using a catalog-name price for a receiving lot rather than silently quoting the wrong rate. Existing catalog/workbook pricing is not overwritten.

## Checks performed on September 12, 2026

Using Node 22.16.0:

```sh
node --experimental-strip-types --experimental-vm-modules --test \
  scripts/jw-stone-receiving.test.mjs \
  scripts/jw-stone-receiving-service.test.mjs
```

Result: 28 passed, zero failed or skipped. The shared contract tests validate numeric fields, price units, exact money conversion, identity matching, public photo paths, and price-field separation. Service tests exercise the actual service module with mocked PostgreSQL, image decoding, and storage: employee access, missing business linkage, upload/publication order, lost responses, changed-payload retries, failed uploads, rollback, lock contention, duplicate labels, and invalid input. They are not live database/storage or browser tests.

The standalone shared TypeScript module passed strict type checking. Eight local TS/TSX modules passed syntax transpilation. A full repository typecheck, lint/build, current regression suite, real image decode, browser preview, production credentials, and live upload were not verified in this session.

## Acceptance before activation

Run the full repository checks and the JW Stone preview required by the lane-isolation rule. Obtain release approval before merging to the production branch.

Verify an assigned employee signing in on each supported JW Stone domain, an unassigned business member, an anonymous viewer, and access revocation. Confirm the employee lands in receiving, the buyer cannot upload/read receipts, and no internal cost is present in public or member API payloads.

With approved test inventory in an isolated environment, complete a real phone-camera submission, verify every displayed photo and entered measurement/price, and check the private Drive originals and manifest. Test a lost response, interrupted source upload, retry, duplicate label, and final database failure against real services. Check the native dialog on supported phones and confirm CORS behavior where cross-origin API mode is configured.

Keep `JW_STONE_RECEIVING_ENABLED` off until these checks pass. Disabling it stops new intake; it does not delete existing receipts or unpublish previously received stock.
