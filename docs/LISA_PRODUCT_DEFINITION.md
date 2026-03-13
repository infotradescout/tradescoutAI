# LISA Product Definition

## What LISA is
LISA is TradeScout's organized truth layer.

Its job is to:
- take verifiable TradeScout actions and observation signals
- normalize them into stable market-state facts
- interpret those facts in natural language
- keep stored conclusions current as reality changes

LISA is not a chatbot, not a UI widget, and not a generic analytics dashboard.

## What LISA is not
- not raw database access
- not direct user or household data export
- not freeform AI narration detached from evidence
- not a source of contact bypasses or gating bypasses
- not a replacement for Scout routing

## Core responsibility
LISA answers three questions:

1. What is true right now
- current market state
- current system state
- current county/category/surface motion

2. Why it is true
- source families
- evidence
- freshness
- confidence/provenance

3. What changed
- whether an older stored conclusion is still valid
- whether a finding is stale, superseded, or suppressed

## Truth maintenance rule
LISA must never allow stale or disproven findings to remain treated as current truth.

That means LISA is not just a feed generator. It is a reconciliation system.

When newer verified signals arrive, LISA must:
- re-evaluate existing findings
- mark stale findings as `stale` or `superseded`
- store the newer finding as the current truth
- preserve provenance so the update path is explainable

## Canonical inputs
LISA should consume normalized signal bundles, not random UI state.

Primary input families:
- `scout_interactions`
- `objectives`
- `observations`
- `home_scout_listing_events`
- `bot_ui_findings`
- persisted crawler/bot visibility telemetry
- trust/CVS-aware exposure facts
- market signal aggregates

## Canonical outputs
LISA outputs organized findings.

Each finding should answer:
- what happened
- why it matters
- how fresh it is
- where it applies
- whether it is still current

Minimum output shape:
- `id`
- `headline`
- `narrative`
- `sourceKind`
- `priority`
- `freshnessMinutes`
- `truthStatus`
- `scopeType`
- `scopeRef`
- `evidence`
- `engineVersion`

## Scope model
LISA findings should be scoped so they can be consumed safely.

Supported scopes:
- `global`
- `county`
- `category`
- `surface`
- `partner`

Examples:
- county truth: `Escambia County HVAC demand accelerated in the last 24 hours`
- category truth: `Luxury resale verification demand is rising`
- surface truth: `HomeScout Listings inventory pressure increased`
- partner truth: `Cumulus-eligible activation readiness is up in Mobile County`

## Stored findings model
LISA should persist findings, not just render them live.

Each stored finding should include:
- finding identity
- scope
- generated timestamp
- freshness
- current truth status
- evidence references
- provenance references
- governance notes
- engine version
- `supersedesId` when a newer finding replaces an older one

## Supersession rules
A newer finding may supersede an older one when:
- it covers the same scope
- it covers the same truth class
- it is based on fresher verified inputs
- it passes governance and minimum-threshold rules

Supersession should not delete history.
It should:
- preserve the older finding
- mark it `superseded`
- point the newer finding back to it

## Staleness rules
A finding becomes `stale` when:
- freshness window expires
- supporting evidence no longer updates
- stronger contrary evidence arrives but not enough to publish a replacement finding

Stale findings must not be treated as active truth in:
- admin dashboards
- partner feeds
- market signal outputs
- future Scout API surfaces

## Suppression rules
LISA must suppress findings when:
- minimum threshold is not met
- evidence is too weak
- scope is too narrow and risks identity leakage
- governance rules block publication

Suppressed findings may still exist internally for evaluation, but they are not publishable truth.

## Consumers
Approved consumers:
- admin observability
- market signals products
- partner dashboards
- future Scout API read surfaces

Disallowed direct consumers:
- raw client components importing LISA internals
- direct partner access to internal scoring chains
- any surface that would expose gated contact paths

## Runtime model
TradeScout should only consume LISA through a bounded runtime contract.

Supported modes:
- `tradescout_local`
- `json_file`
- `remote`

This allows the product to ship now without embedding full LISA internals.

## Relationship to Scout
Scout routes action.
LISA explains truth.

Scout decides:
- what the user should do next
- what route or system should handle the need

LISA determines:
- what the system knows now
- what changed
- what can be stated as governed truth

## Relationship to sellable data
LISA may use internal-only source material to produce externally sellable aggregate truth.

Allowed:
- aggregate market-state outputs
- activation-readiness findings
- county/category/surface intelligence

Not allowed:
- raw user-level data export
- household-level data sale
- contact or identity leakage

## First implementation target
Phase 1:
- live admin feed
- bounded runtime
- truth-status fields in the contract

Phase 2:
- stored findings table
- supersession logic
- stale/suppressed/current lifecycle

Phase 3:
- partner-safe outputs
- market signal tie-in
- Cumulus-grade intelligence delivery
