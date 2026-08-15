# API and Integration Contract — Spatial Studio 1.4.0

## Interfaces and consumers

The 3D studio reads checked-in JW catalog data and same-origin imagery; it introduces no inventory API. The visualizer accepts typed scene/design props and emits bounded design changes. Browser persistence and safe-share encoding use the validated planner model rather than raw component state.

The only mutation path is the existing TradeScout Direct Connect/request flow. Opening the request drawer sends nothing. On explicit submit, the existing endpoint receives its current contact/job fields plus a backward-compatible, human-readable stone-design summary containing safe stone identity, measurements, surface applications, texture direction/crop/scale, and optional fabrication features. It includes no price, cost, source count, or availability promise.

## Errors and degradation

Texture fetch errors, decoder errors, WebGL context loss, local-storage failure, invalid share input, and Direct Connect errors remain isolated. Rendering may fall back to the measured accessible summary without switching inventory source or inventing a preview. Storage failure retains current-session state. Share-copy failure exposes selectable text. Inquiry retry/idempotency remains owned by Direct Connect; the studio never retries or duplicates submission.

## Freshness and exit path

No new third-party data service, API key, telemetry claim, or variable-cost integration is introduced. Same-origin image paths rejoin from the current catalog on load. Removing the visualizer leaves the existing measured planner and request handoff intact; removing safe share leaves local save and deliberate send intact.
