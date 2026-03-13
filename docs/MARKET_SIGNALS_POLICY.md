# TradeScout Market Signals Policy

## Purpose
TradeScout may monetize aggregate market intelligence and governed activation products.
TradeScout must not sell raw personal data, direct contact access, or household-identifiable exports.

This policy separates:
- internal action-driving intelligence
- externally sellable market signals
- prohibited external data products

## Core rule
Raw user-, household-, property-, vehicle-, receipt-, or conversation-level data may be used internally to improve routing, trust, recommendations, and activation.

External products must only expose outputs that are:
- aggregated
- thresholded
- anonymized
- market-scoped
- non-reconstructive

## Product classes

### Green: externally sellable
These can be sold via dashboard, report, API, or managed activation.

- County/category demand index
- Brand trend index
- Product/service velocity by county
- Maintenance-cycle pressure index
- HomeScout Listings inventory pressure
- Trade/category price movement bands
- Trust-weighted demand index
- Conversion-readiness score at county/category level
- Time-windowed shifts in demand or brand usage
- Aggregated spend bands
- Aggregated service interval trends
- Aggregated receipt-derived category demand
- Market activation eligibility cohorts, if thresholded and non-identifiable

Examples:
- "Rheem water heater activity is up in Travis County this week."
- "Synthetic oil demand is elevated among late-model truck services in Mobile County."
- "Toilet replacement activity is up in Escambia County this month."

### Yellow: internal by default, external only with stronger controls
These may be used internally to trigger actions that later produce sellable aggregate outputs.
They should not be externalized without product, privacy, and legal review.

- Receipt-derived product event streams
- Household maintenance histories
- Property-level equipment composition
- Vehicle-level service composition
- Brand usage by micro-geography below county level
- Cross-surface behavioral sequences
- Time-of-day or high-frequency behavior tied to narrow cohorts
- Activation cohorts with small audience sizes
- Partner performance tied to narrow market slices

Rules:
- no user-level export
- no household-level export
- no exact address, property, or VIN-level export
- no audience below threshold
- no external use for off-platform identity resolution without explicit approved policy

### Red: prohibited for external sale/share
These may inform internal decisions but must not be sold, licensed, or exposed as an external data stream.

- Raw receipts
- Raw invoices
- Raw property records uploaded by users
- Exact home composition for a specific household
- Exact vehicle/service history for a specific user
- Per-user or per-household product usage profiles
- Direct contact data derived from behavior
- Decision-card or contact-unlock identity outputs
- Conversation contents
- User-level trust/CVS values
- Targeting lists of identifiable users or households
- Off-platform retargeting files built from TradeScout user actions

## Internal-use allowance
TradeScout may use Yellow and Red internal data to:
- route Scout actions
- improve trust/CVS
- trigger TradeDeals
- trigger partner offers
- trigger HomeScout or Exchange workflows
- generate county/category aggregate snapshots
- power internal operations and product quality

Internal use is allowed because it improves the operating system.
That does not automatically authorize external sale or sharing.

## Sellable output requirements
Every external market signal product must satisfy all of the following:

1. Aggregate only
- no user rows
- no household rows
- no property rows
- no VIN rows

2. Thresholded
- minimum sample size before output is emitted
- suppress small cells

3. Time-windowed
- use rolling windows or bounded time buckets

4. Scoped
- county, city, region, category, brand, or partner program level

5. Non-reconstructive
- output must not let a buyer infer a specific user, household, or property

6. Governed
- output must respect platform privacy settings, legal opt-outs, and partner entitlement scopes

## Recommended thresholds
Default minimums for external outputs:
- county/category signal: 25 contributing events
- county/brand signal: 25 contributing events
- city/category signal: 50 contributing events unless city is large enough to justify lower thresholds
- partner performance slice: 25 contributing events

If thresholds are not met:
- suppress the cell
- roll up to broader geography
- roll up to broader category

## Permitted monetization models

### 1. Market Signals subscription
- dashboards
- exports
- APIs
- alerts

### 2. Activation subscription
- sponsor county/category demand lanes
- sponsor TradeDeals
- sponsor Scout recommendation eligibility
- sponsor HomeScout Listings promotion surfaces

### 3. Managed intelligence programs
- partner insights
- campaign planning
- county expansion planning

## Prohibited monetization models
- lead list sales
- raw personal data sales
- direct contact unlock sales
- household intelligence exports
- off-platform identity targeting files from TradeScout activity

## Competitive strategy
TradeScout may choose to:
- make some aggregate signal layers free
- open a delayed or lower-resolution public signal tier
- use open/free access strategically to weaken slower competitors

But free access must still follow Green rules.
Free does not justify releasing Red or Yellow data externally.

## Implementation guidance
Build three layers:

### Layer 1: source intelligence
Internal-only events and facts:
- receipts
- uploads
- property lifecycle data
- vehicle/service data
- Scout interaction data
- decision-card events

### Layer 2: derived signal snapshots
Canonical market products:
- county demand snapshot
- brand trend snapshot
- inventory pressure snapshot
- activation readiness snapshot

### Layer 3: external product surface
- dashboards
- reports
- APIs
- managed partner programs

## Initial product catalog

### TradeScout Market Signals
- county demand index
- category intent velocity
- brand trend index
- maintenance-cycle pressure
- HomeScout Listings inventory pressure
- Exchange demand movement

### TradeScout Activation
- category sponsorship
- county sponsorship
- TradeDeal sponsorship
- signal-triggered activation

## Non-negotiable platform law
Visibility does not equal access.
Being part of a market signal product must never grant direct contact or bypass Scout gating.
