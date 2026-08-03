# Data Contract

## Entities, relationships, constraints, indexes, and canonical ownership

The canonical inventory entity is the existing `JwStoneInventoryStone`. JW Stone 2.0 creates a route-local read-only catalog projection with canonical slug, safe public name, images, image finish associations, supported finishes, material status, source-count evidence, anonymous flag, editorial visual color direction, and nullable verified origin. The reconciled marketplace projection preserves all 433 supplied source images as 148 presentation groups while leaving the existing JW profile projection unchanged.

Origin has the contract `{ country, verified: true, source }` or `null`. Only the verified form can render or produce a filter option. Current production inventory projects `null` for every record.

First Cut placeholders are static presentation positions, not catalog entities. They have no inventory ID, stone slug, product metadata, filter membership, storage eligibility, or contact payload.

The wishlist storage envelope is `{ version: 1, ids: string[] }`. IDs are stable canonical slugs of eligible named stones, deduplicated and bounded. Display facts are always rejoined from the current canonical catalog rather than duplicated in storage.

Each customer-path guidance record owns an audience label, short source-attributed decision support, a source URL, and an ordered list of named catalog slugs with an evidence-safe recommendation reason. A validator rejects missing, anonymous, duplicate, or unreviewed slugs. Guidance and recommendations are presentation data only: they never alter catalog identity, filters, ordering, availability, contact, or wishlist eligibility.

## Customer-path knowledge and item evidence

| Path | Exact knowledge source and permitted summary | Item rule and visible reason |
| --- | --- | --- |
| Fabricators | Use Natural Stone, `https://usenaturalstone.org/stone-fabricators-wish-knew-good/`: review actual slabs and proposed layout because natural variation affects vein and seam placement. Use Natural Stone, `https://usenaturalstone.org/bookmatching/`: a mirrored layout requires sequential slabs and layout approval before cutting. | Deterministic “More documented selections”: named + public material + explicit finish + recorded source counts + at least two supplied images; canonical order; maximum six. Reason: those four evidence types are documented, not that a stone is better, suitable, or available. |
| Builders & Developers | Use Natural Stone, `https://usenaturalstone.org/a-beginners_guide_stone_selection/`: a small sample cannot represent a whole slab and actual slabs should be reviewed. Natural Stone Institute testing, `https://www.naturalstoneinstitute.org/resources/natural-stone-testing-services/`: project-specific performance decisions need appropriate testing rather than visual inference. | Deterministic “More source records to review”: named + recorded source counts + at least four supplied images; order by supplied image count then canonical order; maximum six. Reason: more supplied views and recorded source evidence exist; counts are historical evidence, never live quantity or project readiness. |
| Architects & Designers | Use Natural Stone, `https://usenaturalstone.org/bookmatching/`: sequential slab, edge-loss, seam, and mock-up review matter for mirrored layouts. Use Natural Stone, `https://usenaturalstone.org/how-to-add-value-to-your-project-with-natural-stone/`: finish changes the surface's tone and appearance. | Exact owner-curated JW Stone Picks slugs: `blue-dunes`, `cristallo`, `gold-macaubas`, `rhino-white`, `taj-mahal`, `titanium`; maximum six. Reason: JW Stone curated the selection; only supplied views, explicit finish, material, and source evidence may accompany it. |
| Homeowners | Natural Stone Institute, `https://www.naturalstoneinstitute.org/consumers/care/`: use neutral cleaner; acidic cleaners can etch calcareous stone; sealing does not make stone stain-proof. Use Natural Stone, `https://usenaturalstone.org/a-beginners_guide_stone_selection/`: compare actual slabs because small samples do not show full variation. | The same six owner-curated JW Stone Picks as a “starting edit,” not an audience preference claim; maximum six. Reason: JW Stone curated the selection and the images provide a manageable place to begin. |

The implementation must expose every external source as a normal safe link and keep general natural-stone guidance separate from product-specific claims. Engineered quartz receives no stone-specific care or performance claim without manufacturer documentation.

## State, concurrency, consistency, ordering, and lifecycle

URL state is the shareable source for an optional customer path, optional color, supported filters, and an eligible named-stone detail. Every field parses and serializes independently. The browser history API preserves back and forward behavior. Invalid values are removed without discarding unrelated valid state, hiding the catalog, or inventing a customer path.

Wishlist updates use functional client state and best-effort local storage. A storage event from another tab may reconcile against canonical eligible IDs; malformed or stale values are ignored. The current catalog determines ordering and display identity, while the wishlist preserves a bounded user-selected ID order where safe.

Source image order remains authoritative. Source counts are presented as source evidence, never a promise of current availability. Editorial color classifications may change through a reviewed source update without changing canonical stone identity.

## Classification, retention, deletion propagation, backup, restore, and migrations

Wishlist data is local, non-sensitive selection preference and contains no contact information, price, or duplicated inventory facts. It persists until the visitor removes or clears it, browser storage is cleared, or the version becomes unsupported. Removed catalog IDs disappear safely on read and the cleaned envelope is written when possible.

No server backup or restore contract is introduced because the feature stores no new server data. The existing Direct Connect system continues to own inquiry retention and deletion. There are no database migrations. A production inventory change requires re-running catalog integrity, color coverage, origin, anonymous-label, and wishlist reconciliation tests.
