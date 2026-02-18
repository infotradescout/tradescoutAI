# Observation Contract (Phase 0A)

Adapters must output canonical observations only.

## Adapter Interface

Defined in `server/ingestion/types.ts`:

- `ObservationAdapter`
- `ObservationAdapterContext`
- `ObservationAdapterResult`

Each adapter:

- Accepts county/state and optional cursor.
- Returns `Observation[]` in canonical format.
- Returns `nextCursor` when available.

## Rules

- Adapters do not write to `county_metrics`, `county_entities`, or `county_notes`.
- Adapters do not create county-specific schemas.
- Adapters only normalize source records into canonical observations.
- Persistence/dedupe/health tracking is handled by the ingestion runner (`runObservationAdapter`).

## Persistence Path

`server/ingestion/runObservationsIngestion.ts`:

- Loads prior cursor from `observation_sources`.
- Calls adapter.
- Inserts into `observations` with dedupe (`on conflict do nothing`).
- Updates `observation_sources` cursor + health.
