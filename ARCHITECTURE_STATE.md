# TradeScout Architecture State (Truth Only)

Last Verified: 2026-03-19
Owner: Execution Layer
Status: Active Reality Snapshot

## Exists (Verified)
- Monorepo with `client/` and `server/` layers.
- Gating and routing enforcement lives in:
  - `server/routes.ts`
  - `server/routes/scout.ts`
  - `server/routes/nationwide.ts`
- Trust/CVS and exposure logic present in server-side flows and tests.
- County-level routing and snapshot model are represented in current system docs and contracts.
- Release verification command path exists and ran green in latest cycle:
  - `npm run verify:release`
- Authority/trust/theme/audit scripts exist and pass in latest validated run.

## Partially Built
- Dashboard instrumentation is present but not yet minimalized to only action KPIs in one canonical authority view.
- Route logic is functionally complete but concentrated in large files; decomposition is incomplete.
- Funnel activation telemetry exists in artifacts/tests, but campaign-level source-to-result logging is not yet standardized in one locked log.

## Broken or At Risk
- Documentation is fragmented across many files; execution memory is diluted.
- Large route surfaces increase regression risk and make audits slower.
- Lint warnings remain in several active files (not release-blocking, but quality debt).
- Activation loop from external distribution (for example Facebook source segmentation -> funnel path -> outcome logging -> taxonomy update) is not yet enforced as an operating contract.

## Constraints (Do Not Violate)
- Do not bypass Intent -> Decision Card -> Contact.
- Do not write ad-hoc county intelligence fields.
- Do not bypass Trust/CVS for exposure logic.
- Do not move intelligence computation into admin UI surfaces.

## Current Truth Gaps
- No single canonical `ACTIVATION_LOG.md` existed before this cycle.
- No single locked patch queue existed before this cycle.
- No single locked signal taxonomy existed before this cycle.
