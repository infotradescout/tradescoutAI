# Architecture and Canonical Ownership

## Operating envelope and topology

JW Stone 2.0 is a standalone public React route inside the existing TradeScout application. It consumes the checked-in canonical JW inventory projection, local browser state, safe URL state, and the existing Direct Connect component. A dedicated server HTML helper owns marketplace metadata. No new service, database table, migration, authentication mode, deployment target, or custom domain is introduced.

The route is selected after custom-domain routing but before AppShell profile and application routes. This protects the mapped-domain experience and prevents global shell assumptions from shaping the standalone marketplace.

## Feature/module owners, directories, interfaces, and dependency direction

- `client/src/features/jw-stone/` owns catalog projection, visual color classification, URL state, wishlist state, marketplace components, and focused tests.
- `client/src/pages/JWStoneMarketplace.tsx` owns the lazy page boundary only.
- `client/src/App.tsx` and `client/src/AppRoutes.tsx` own reachability while preserving route priority.
- `client/src/data/jwStoneInventory.ts` and `shared/jwStonePresentation.ts` remain canonical inventory and public-name sources; the feature depends on them and does not mutate them.
- `client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx` and `directConnectMaterial.ts` retain canonical contact handoff behavior. Any extension must be optional and backward compatible.
- `server/publicJwStoneMarketplaceHtml.ts` owns route-specific HTML metadata; `server/index.ts` registers only the explicit public route.
- `scripts/generate-sitemap.mjs` owns sitemap inclusion.

Dependencies point from the marketplace feature toward canonical inventory, presentation, and Direct Connect contracts. Existing profile renderers never depend on the marketplace feature.

## Reuse, create, migration, and deployment decisions

Reuse real JW identity assets, inventory images, safe public-name helpers, shared UI primitives, and Direct Connect infrastructure. Create a new marketplace presentation and state layer because the old wholesaler profile grammar violates the separate-experience requirement.

Visual color direction is a new explicit feature classification derived from supplied imagery and kept separate from verified geological facts. Verified origin is a nullable typed extension in the marketplace projection until a canonical source field is supplied.

No database or presentation migration is allowed. No main merge, Render deploy, DNS change, or production mutation is part of the build. Rollback before release is branch closure; after a separately authorized release it is a normal application commit revert because the feature owns no persistent server data.
