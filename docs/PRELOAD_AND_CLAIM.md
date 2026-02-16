# Preload + Claim Pipeline

Date: 2026-02-16

## Goal

Support free-first preloaded listings that are claimable by real owners, without overwriting claimed business data on future imports.

## Data Model

### Canonical listings (`businesses`)
- `claim_status`:
  - `unclaimed` (directory listing, no owner attached)
  - `claimed` (owned/claimed profile)
- `sources` (`jsonb[]`): ingestion source lineage, e.g. `["csv_import", "county_registry"]`

### Staging (`listing_import_staging`)
- Raw import rows are staged first.
- Merge job deterministically dedupes and promotes into canonical `businesses`.

## Import Commands

### 1) Stage CSV rows

```bash
npm run import:stage -- --file=./data/imports/providers.csv --source=county_registry --batch=la_tangipahoa_2026_02
```

Options:
- `--file` required
- `--source` optional, defaults `csv_import`
- `--batch` optional, defaults timestamped batch id
- `--delimiter` optional: `comma` (default), `tab`, `pipe`

### 2) Merge staged rows

```bash
npm run import:merge -- --batch=la_tangipahoa_2026_02
```

Options:
- `--batch` required
- `--limit` optional (default `500`)
- `--dryRun=true` optional to preview behavior without writes

## Deterministic Dedupe Rules (in order)

1. `website + county` match
2. `phone + county` match
3. `name + county` match
4. else create new unclaimed listing

Rows with duplicate `dedupe_key` inside a batch are marked `skipped_duplicate`.

## Field Priority / Merge Safety

### Claimed listings
- Never overwrite claimed profile fields from imports.
- Only append import `source` lineage.

### Unclaimed listings
- Merge only missing fields:
  - phone
  - email
  - website
  - services/trade categories
- Keep existing values if already present.

## Claim Flow

User flow:
1. User finds listing in signup claim search (`/create-account` claim panel).
2. User verifies ownership by matching email/phone.
3. System transitions listing:
   - `owner_user_id` set
   - `claim_status` set to `claimed`
4. User is routed into business-owner setup/verification steps.

## Files

- Schema: `shared/schema.ts`
- Migration: `migrations/0042_preload_claim_pipeline.sql`
- Staging script: `scripts/import/stage-business-csv.ts`
- Merge script: `scripts/import/merge-staged-businesses.ts`
- CLI helpers: `scripts/import/utils.ts`
- Claim search API: `server/routes.ts` (`/api/business-claim/search`)
- Claim transition: `server/storage.ts` (`claimUnclaimedBusinessForUser`)
