# JW Stone Baton Rouge-to-Panama City network evidence

Date: 2026-08-22

Baseline: `8a560de9cb65ee82134d35a46b3137b3d42b31cf`

## Intent lock

- "Panama" is implemented as Panama City, Florida, with one continuous market corridor: Baton Rouge, Northshore, New Orleans, Mississippi Gulf Coast, Mobile/Baldwin, Pensacola, Emerald Coast, and Panama City.
- The requested population is stone fabricators, material suppliers, and installers. A business may cover more than one role.
- The work prepares useful TradeScout profiles plus internal JW Stone and BidRock routing. It does not claim partnerships, endorsements, verification, licensing, ratings, or reviews.
- JW Stone remains the existing anchor. The dataset intentionally excludes it so the import cannot create a duplicate.

## Canonical owners reused

- CSV parsing and staging: `scripts/import/stage-business-csv.ts`.
- Business dedupe and merge: `scripts/import/merge-staged-businesses.ts`.
- Business and county records: existing `businesses` and `business_counties` owners.
- Discovery and profile surfaces: existing Businesses workspace, `/business/:slug`, and `/u/:slug` routes.
- Ownership: existing claimed/unclaimed profile model and claim flow.
- Contact: existing Intent -> Decision Card -> Contact boundary. No contact or CRM owner was added.

## Dataset proof

- Artifact: `scripts/import/datasets/stone-corridor-baton-rouge-to-panama-city-2026-08-22.csv`.
- 51 unique official-source location profiles: Louisiana 18, Mississippi 3, Alabama 8, Florida 22.
- Role coverage overlaps by design: 40 fabricators, 43 installers, 42 suppliers.
- Market coverage: Baton Rouge 10, Northshore 2, New Orleans 6, Mississippi Gulf Coast 3, Mobile/Baldwin 8, Pensacola 8, Emerald Coast 9, Panama City 5.
- Acquisition priority: 36 tier 1 and 15 tier 2.
- JW Stone fit: 28 buyer-and-supply candidates, 14 buyer candidates, 8 supply-partner candidates, and 1 adjacent-trade candidate.
- BidRock fit: 28 fabricator/installer/supplier, 9 fabricator/installer, 6 installer/supplier, and 8 supplier candidates.
- Every row includes an official source URL, source-check date, street location, state, ZIP, county name/FIPS, trade roles, corridor market, and internal target routing.

## Import safety

- New helper `scripts/import/business-profile-fields.ts` maps researched tagline, description, street, city, state, and ZIP into public profile fields with normalization and length limits.
- Source provenance and JW Stone/BidRock segmentation are stored in `importExtras`; they are not promoted as public claims.
- New draft records receive the researched public fields through the existing merge pipeline.
- Existing unclaimed records receive only missing fields.
- Claimed records keep owner-authored fields; the existing claimed-profile guard remains authoritative.
- Default merge status remains `draft` with public discovery disabled for new records, so preparing or merging records does not make them searchable.
- Imported directory facts explicitly disable public phone/email and official-website exposure; contact remains intent-gated through TradeScout.
- The existing Masonry & Stonework trade owner provides the canonical public discovery slug; fabricator, supplier, and installer distinctions remain in the profile services and internal targeting metadata.

## Counterexample pass

- Multi-location brands are represented as location profiles and remain distinct because the canonical dedupe includes county scope.
- A matching website, phone, or normalized name in the same county routes to the canonical existing record instead of creating a blind duplicate.
- A claimed existing match preserves owner data; the researched row cannot replace it.
- Generic inboxes and public phone numbers are business facts only; no named contact, consent, relationship, or CRM identity is inferred.
- No license, verification, rating, review, or TradeScout-partner field exists in the dataset.
- No JW Stone row exists in the dataset.

## Automated proof

- Focused corridor contract: 1 file, 9 tests passed.
- Corridor plus adjacent import/public-profile contracts: 5 files, 23 tests passed.
- `npm run check`: pass.
- `git diff --check`: pass.
- Full-tree project-index refresh: 3,678 source files, 20,059 symbols, 1,484 components, 11,174 functions/hooks, and 7,517 raw UI elements indexed.
- Project-index doctor: 1,101 existing repository duplicate-owner findings and 5 existing raw-control warnings. The tracked baseline had 1,104 errors and 5 warnings; this work adds no finding that names the new corridor helper, contract, or symbols.
- Minimum-release gate: reproducible `npm ci`, TypeScript, production build, 139/139 core contracts, and 15/15 discovery-performance contracts passed.
- Production build: pass, including 559 JavaScript bundle references, 13 HTML asset references, and the server bundle.
- Minimum-release database compatibility step: not runnable because this workspace has no `TEST_DATABASE_URL`. A production database was not substituted for the required disposable migration proof.

## Production activation boundary

The user approved the exact public-release option on 2026-08-22. Outreach remains outside this release.

The production release uses the canonical staging records with the exact dataset and a unique release batch:

1. The first deployment stages all 51 source rows and applies the guarded merge in one database transaction.
2. New records remain draft and non-discoverable while the deployment log exposes all 51 non-contact decisions for audit.
3. The activation phase runs only after the draft decision audit passes.

The approval authorizes the exact repository push, merge, existing-service deployment, draft import, audit, and public activation described here. It does not authorize outreach or creation of another service.

The approved production implementation uses the existing TradeScout bootstrap and staging records in two phases:

1. The first `main` deployment stages all 51 rows, makes only safe claimed/unclaimed matches, and creates new records as drafts.
2. The deployment log records all 51 decisions without exposing private contact data.
3. Only after that audit passes, `STONE_CORRIDOR_RELEASE_PHASE=active` performs the public activation on a second deployment.
4. Claimed and suspended records remain owner-controlled. A recorded activation marker prevents later manual deactivation from being reversed by a future boot.
5. `STONE_CORRIDOR_RELEASE_PHASE=rollback` restores each release-owned record's pre-release status and discovery setting. New release records return to draft.
6. A transaction-scoped PostgreSQL advisory lock prevents overlapping Render boots from creating duplicate records.

## Release proof

Local code, dataset, typecheck, build, and non-database contract proof are complete. Disposable-database proof, exact implementation commit, remote draft import, push/merge/deploy, production build identity, and public activation remain pending. No release or production-data completion is claimed.
