# Observation Model (Phase 0A)

The `observations` table is the canonical intake for county reality signals.

## Canonical Shape

- `occurred_at`: when it happened
- `county_fips`, `state_code`, optional `city`: where it happened
- `geo_json` (optional): point/shape payload (portable JSON)
- `subject_type`, `subject_ref`: what it happened to
- `action_type`: what happened
- `source_type`, `source_ref`: where the fact came from
- `attributes_json`: normalized source payload
- `confidence`: `official | inferred`

## Dedupe + Query Indexes

- Unique dedupe key: `(source_type, source_ref)`
- Query indexes:
- `(county_fips, occurred_at)`
- `(source_type, occurred_at)`
- `(action_type, occurred_at)`

## Source Status Tracking

`observation_sources` stores per-adapter/per-county status:

- `source_type`, `county_fips`, `state_code`
- `last_success_at`, `last_run_at`
- `cursor_json`
- `health_status`
- `error_message`

This keeps adapters replaceable while preserving ingestion health and cursors.
