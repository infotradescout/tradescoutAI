# TradeScout Admin OS v2 — insight workspaces

## Owner outcome

The remaining insight surfaces still behaved like separate dashboards. Business Onboarding Telemetry used stacked metric cards, Discovery Observatory spread one evidence chain across many nested cards, and Scout Resilience exposed a provider-specific diagnostic dashboard instead of a direct operating view.

The required outcome is one Admin OS workbench where operators can inspect real state, see what is unavailable, and use existing authority without creating duplicate mutation paths.

## Native workspaces in this release

- Business Onboarding Health
- Discovery Observatory
- Scout Resilience

All three use the shared Admin OS v2 workspace primitives and are registered as native surfaces.

## Business Onboarding Health

The workspace preserves the existing read authority:

- `GET /api/admin/business-onboarding/telemetry?days=...`

It presents:

- Businesses currently in setup
- Complete, in-progress, and not-started module states
- Lookback selection
- One row for each required setup module
- Transition velocity by module
- Recent stored transitions with source and account identifier

The workspace remains read-only. It creates no onboarding state, completion event, profile, verification, payout record, or discoverability decision.

## Discovery Observatory

The workspace preserves the existing authorities:

- `GET /api/admin/discovery-observatory?windowDays=...`
- `POST /api/admin/discovery-observatory/observations`

It is divided into:

- Evidence Chain
- Operating Gaps
- Observations
- Queries & Surfaces
- Experiments

The customer evidence chain keeps its explicit denominator, unknown/unavailable count, source freshness, and quality checks. Outside-source hints remain hints and never become causal attribution.

Manual observation capture keeps the current evidence fields, timestamps, precision, freshness boundary, entity slug, cited URL, location, device, and operator-manual provenance. Recording an observation does not change a public page, profile discovery setting, request route, or business ownership.

The experiment queue remains proposed-only. Tests must be predeclared before any result is counted.

## Scout Resilience

The workspace preserves the existing read authorities:

- `GET /api/scout/admin/system-status`
- `GET /api/scout/admin/analytics`

It remains Super Admin-only and refreshes every fifteen seconds. It presents:

- Service state and uptime
- Primary-provider state
- Cooldown state
- Query and fallback totals
- Recorded fallback reasons
- Server, crawler, cache, database, and provider-cache state

The workspace does not add a repair, reset, provider-switch, cache-clear, or configuration write path.

## Honest unavailable states

A failed or missing insight source remains unavailable. It is not converted into:

- Zero onboarding friction
- Zero unknown discovery evidence
- Healthy Scout service state
- Zero fallback activity
- Successful source freshness

## Preserved boundaries

This release does not change:

- Admin roles or permission middleware
- Business onboarding state or completion rules
- Public discoverability rules
- Outside-source attribution rules
- Direct Connect or Start a Request behavior
- Business ownership or profile ownership
- Verification requirements
- Scout response behavior
- Provider selection or fallback rules
- Partner records
- HomeID records
- Stone Core or inventory
- Marketplace approval records
- Finance records

## Release proof

Release requires:

- The three tools to be registered as native Admin OS v2 surfaces
- Existing endpoint strings to remain present
- Discovery observation capture to remain the only write in this group
- Onboarding and Scout Resilience to remain read-only
- Production client and server bundle completion
- Schema preflight with no critical drift
- Production service startup
- Authenticated desktop and mobile review before claiming final visual approval
