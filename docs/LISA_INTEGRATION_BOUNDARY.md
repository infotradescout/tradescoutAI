# LISA Integration Boundary

## Current state
LISA is not yet a live runtime inside TradeScout.

TradeScout now integrates through a bounded runtime interface rather than importing LISA internals
directly into routes or UI.

## Boundary rule
- UI never talks to LISA internals
- Routes never depend on ad hoc LISA files
- TradeScout consumes only `LisaFeedResponse`
- stored truth must be reconcilable when fresher verified signals arrive

## Runtime modes

### `tradescout_local`
- default
- builds a natural-language feed from live TradeScout telemetry
- real sources only:
  - `scout_interactions`
  - `objectives`
  - `observations`
  - `bot_ui_findings`
  - `home_scout_listing_events`
  - in-process bot HTTP metrics

### `json_file`
- reads a real generated LISA JSON artifact from disk
- set:
  - `LISA_RUNTIME_MODE=json_file`
  - `LISA_JSON_PATH=<absolute-or-relative-json-file>`

### `remote`
- reads from a future standalone LISA runtime
- set:
  - `LISA_RUNTIME_MODE=remote`
  - `LISA_REMOTE_URL=<http(s)://...>`

## Current integration points
- runtime: `server/services/lisaRuntime.ts`
- contract: `shared/lisa.ts`
- admin route: `/api/admin/observability/lisa-feed`
- admin UI: `/admin/observability`

## Why this exists
- keeps LISA proprietary logic out of general app surfaces
- allows TradeScout to ship today without pretending LISA is live
- gives a clean swap point once the real LISA engine is ready
- preserves a future truth-maintenance model where stale findings can be superseded cleanly

## Truth maintenance requirement
LISA integration is not complete until stored findings can be updated when reality changes.

That means future persisted findings must support:
- freshness
- truth status
- supersession
- provenance

Current live feed integration is step one. Persistent reconciliation is the next step.

## Recommended next step
When you are ready to plug in real LISA output, do one of these:

1. `json_file`
- have LISA emit a canonical JSON findings file
- point `LISA_JSON_PATH` at it

2. `remote`
- run LISA as its own service
- expose a narrow feed endpoint
- point `LISA_REMOTE_URL` at it

Do not import full LISA internals directly into random TradeScout routes or client code.
