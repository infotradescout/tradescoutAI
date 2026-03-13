# Scout Market Signals API v1

## Goal
Expose externally sellable, aggregated, real-time or near-real-time market signals without exposing raw personal or household data.

## Product boundary
This API is for:
- market intelligence
- signal subscriptions
- dashboards
- activation planning

This API is not for:
- user-level exports
- direct contact access
- household-level intelligence
- off-platform targeting lists

## Base path
`/api/market-signals/v1`

## Auth
- API key required
- partner/workspace scoped
- rate-limited
- all requests audited

Planned headers:
`Authorization: Bearer <api_key>`

## Entitlement scopes
- `signals.read.county`
- `signals.read.brand`
- `signals.read.category`
- `signals.read.inventory`
- `signals.read.activation`

## Canonical dimensions
- geography: county, city, state, region
- category: trade, product category, service category
- brand
- market surface: HomeScout Listings, Exchange, TradeDeals, Direct Connect
- time window

## Core resources

### 1. County demand snapshot
`GET /api/market-signals/v1/counties/:countyFips/demand`

Returns:
- county demand index
- top rising categories
- top falling categories
- trust-weighted activity
- confidence band
- `stateCode` when available from the aggregate source

Example response:
```json
{
  "countyFips": "01097",
  "stateCode": "AL",
  "window": "24h",
  "generatedAt": "2026-03-12T18:00:00Z",
  "signals": {
    "demandIndex": 72,
    "trustWeightedDemandIndex": 68,
    "inventoryPressureIndex": 41,
    "conversionReadinessIndex": 58
  },
  "topCategories": [
    { "category": "hvac", "direction": "up", "changePct": 21 },
    { "category": "roofing", "direction": "up", "changePct": 15 }
  ]
}
```

### 2. Category trend
`GET /api/market-signals/v1/categories/:categorySlug/trend`

Query params:
- `countyFips`
- `stateCode`
- `window`

Returns:
- demand velocity
- volume band
- price band
- trust-weighted activity

### 3. Brand trend
`GET /api/market-signals/v1/brands/:brandSlug/trend`

Query params:
- `countyFips`
- `stateCode`
- `category`
- `window`

Returns:
- brand trend score
- usage velocity
- spend band
- competing brand rank band

### 4. HomeScout Listings inventory pressure
`GET /api/market-signals/v1/homescout-listings/inventory`

Query params:
- `countyFips`
- `stateCode`
- `propertyType`
- `window`

Returns:
- active listing count
- new listing velocity
- price-drop pressure
- buyer-demand proxy

### 5. Activation readiness
`GET /api/market-signals/v1/activation-readiness`

Query params:
- `countyFips`
- `stateCode`
- `category`
- `surface`

Returns:
- market activation score
- sponsor readiness
- minimum viable audience status
- recommended activation surface

## Response rules
All responses must:
- be aggregated
- be thresholded
- suppress under-minimum cohorts
- never include raw user or household identifiers

## Suppression behavior
When thresholds are not met:
```json
{
  "status": "suppressed",
  "reason": "minimum_threshold_not_met"
}
```

## Initial windows
- `1h`
- `24h`
- `7d`
- `30d`

## Sellable signal families
- demand index
- velocity index
- inventory pressure
- trust-weighted activity
- conversion readiness
- brand trend
- spend band
- maintenance-cycle pressure

## Internal-only source families
These may feed derived outputs but must never be returned directly:
- receipt rows
- uploaded invoices
- property-level facts
- user-level histories
- conversation content
- decision-card identities

## Activation tie-in
This API may feed:
- TradePartner dashboards
- sponsor eligibility
- county campaign planning
- Scout activation placement decisions

But the API itself does not grant:
- direct contact
- lead ownership
- user identity access

## Roadmap

### v1
- read-only aggregate signals
- API key auth
- county/category/brand/listings endpoints

### v1.1
- webhooks for signal threshold crossings
- saved partner watchlists

### v2
- paid activation recommendation endpoints
- partner-side planning exports
