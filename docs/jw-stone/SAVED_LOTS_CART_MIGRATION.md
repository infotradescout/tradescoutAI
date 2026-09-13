# Saved inventory lots and safe cart migration

Implementation continuation for PR #655, built from branch head `94ceaf222cae4199f34bf64be42874a651e43e59`. This document supersedes the earlier limitations about received-lot favorites and legacy-cart overflow. It does not declare a production release.

## Changes

- Saved stones now includes exact physical inventory lots alongside the existing catalog favorites. The header count and confirmed clear action include both groups. Lot favorites persist only the public lot ID and material name: no price, stock count, image URL, rack location, cost, or internal notes.
- The saved-lot section rechecks all current published JW inventory, not only the selected New Arrivals subset. A dedicated no-store public endpoint reuses the existing public inventory projection and validates the JW business linkage. It does not confer employee or member-price access.
- A missing listing remains saved as a reference; the UI says not currently listed rather than asserting it was sold. Failed or unfinished inventory refreshes show unknown status and do not render stale pricing as current.
- Listed saved lots use the existing member-gated arrival price/cart controls. Opening the cart closes the saved-stones panel, avoiding two simultaneously active side panels.
- Both the arrival-card inquiry and the saved-lot inquiry retain the exact physical inventory ID in an editable Direct Connect message. The old arrival callback resolved through the named catalog and could lose the lot identity entirely.
- Copy all exports catalog names and physical lot IDs to the clipboard after an explicit click. A selectable text fallback is provided when clipboard access fails. Existing email delivery still supports catalog stones only; the UI labels that scope explicitly. No emails are sent automatically.
- Legacy carts previously supported 100 selections, but their migration normalized down to 50. Storage/migration now preserves all 100, including changes and reloads. The creation cap and server review cap remain 50. Larger saved carts have labeled batches; review, subtotal, and inquiry use only the chosen batch. No other batch is silently quoted or included in the request.
- Cart and saved-lot mutations do not replace unreadable/future-version storage envelopes. Failed writes retain a visible in-memory list and report that it is not durable.
- A fresh cart inquiry mounts a fresh request panel rather than reusing an edited message from another cart batch.

## Validation in this continuation

50 focused checks passed locally on Node 22.16.0, zero failures and zero skips:

```sh
node --experimental-strip-types --experimental-vm-modules --test \
  scripts/jw-stone-saved-lots-and-cart-migration.test.mjs \
  scripts/jw-stone-saved-lots-ui.test.mjs
```

The first file has 33 checks for the actual contract/store modules and the receiving route with mocked storage and service ports. The second has 17 checks executing the actual component functions and event handlers with mocked React, query, UI, clipboard, and API dependencies. These are not a DOM/browser proof, full application build, real database/storage proof, or email delivery proof. The UI harness uses the repository's TypeScript development dependency.

A strict standalone TypeScript check passed for the cart contract, cart store, and saved-lot store. The 12 changed/new implementation TS/TSX modules passed syntax transpilation. The existing complete repository suites and older targeted suites were not rerun in this isolated local checkout.

The proof workflow includes both new test files without weakening its existing receiving-browser or full-application gates. Local Chromium navigation failed with `ERR_BLOCKED_BY_ADMINISTRATOR`; that restriction was not bypassed. The connected remote computer did not accept the connectivity check. A full repository clone was unavailable because this runtime could not resolve the GitHub host. GitHub connector reads/writes remained available.

## Remaining limits

These browser-local favorites are scoped to the browser origin, not a server account. They do not sync across devices or between custom domains. The existing catalog and new lot favorites each support up to 50 items. Sequential cross-tab updates are tested; localStorage is not transactional across simultaneous tab writes. No concurrency guarantee beyond the tested behavior is claimed.

Lot favorites are not sent by the existing catalog-email endpoint. Clipboard export includes them, and each exact lot can be used in an editable inquiry. No live messages were sent during this continuation.

Payment checkout, reservation creation, delivery/timing calculation, employee stock correction/decrement controls, server-draft repair, and automatic reconciliation of later Drive changes remain unfinished. Actual employee assignments, production storage credentials, feature activation, supported-phone receiving, and full application build/browser verification remain release gates. No live employee access, inventory, Drive files, or receiving configuration is changed by this continuation.
