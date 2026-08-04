# Data Contract

## Entities, relationships, constraints, indexes, and canonical ownership

The canonical inventory entity is the existing `JwStoneInventoryStone`. JW Stone 2.0 creates a route-local read-only catalog projection with canonical slug, safe public name, images, image finish associations, supported finishes, material status, source-count evidence, anonymous flag, editorial visual color direction, and nullable verified origin. The reconciled marketplace projection preserves all 433 supplied source images as 148 presentation groups while leaving the existing JW profile projection unchanged.

Origin has the contract `{ country, verified: true, source }` or `null`. Only the verified form can render or produce a filter option. Current production inventory projects `null` for every record.

First Cut placeholders are static presentation positions, not catalog entities. They have no inventory ID, stone slug, product metadata, filter membership, storage eligibility, or contact payload.

The wishlist storage envelope is `{ version: 1, ids: string[] }`. IDs are stable canonical slugs of eligible named stones, deduplicated and bounded. Display facts are always rejoined from the current canonical catalog rather than duplicated in storage.

Learn-about-stone topics are static presentation records: title, plain text, and an HTTPS source URL on `usenaturalstone.org` or `www.naturalstoneinstitute.org`. They never alter catalog identity, filters, ordering, availability, contact, or wishlist eligibility. Customer-path guidance records and recommendation rails are removed.

## State, concurrency, consistency, ordering, and lifecycle

URL state is the shareable source for optional color, supported filters, and an eligible named-stone detail. Legacy `buyer` query values are ignored and never serialized. Every field parses and serializes independently. The browser history API preserves back and forward behavior. Invalid values are removed without discarding unrelated valid state or hiding the catalog.

Wishlist updates use functional client state and best-effort local storage. A storage event from another tab may reconcile against canonical eligible IDs; malformed or stale values are ignored. The current catalog determines ordering and display identity, while the wishlist preserves a bounded user-selected ID order where safe.

Source image order remains authoritative. Source counts are presented as source evidence, never a promise of current availability. Editorial color classifications may change through a reviewed source update without changing canonical stone identity.

## Classification, retention, deletion propagation, backup, restore, and migrations

Wishlist data is local, non-sensitive selection preference and contains no contact information, price, or duplicated inventory facts. It persists until the visitor removes or clears it, browser storage is cleared, or the version becomes unsupported. Removed catalog IDs disappear safely on read and the cleaned envelope is written when possible.

No server backup or restore contract is introduced because the feature stores no new server data. The existing Direct Connect system continues to own inquiry retention and deletion. There are no database migrations. A production inventory change requires re-running catalog integrity, color coverage, origin, anonymous-label, and wishlist reconciliation tests.
