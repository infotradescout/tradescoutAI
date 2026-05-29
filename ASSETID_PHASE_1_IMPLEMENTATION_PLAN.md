# AssetID Phase 1 Implementation Plan

## Executive decision

Phase 1 implements HomeID as the first AssetID vertical.

## Objective

Deliver a durable HomeID truth layer with explicit authority, evidence, visibility, and transfer rules, while HomeScout and Direct Connect operate as action/enrichment layers.

## Core rules

1. AssetID is the durable truth layer.
2. HomeID is the first implementation.
3. HomeScout is the exchange/action layer.
4. Direct Connect job cycles can enrich HomeID through verified evidence.
5. Users control authority, visibility, and transfer.

## Listing-Side HomeID Creation and Handoff

### Goal

Allow realtors and property managers to create/enrich HomeID before claim, then hand off authority to rightful owner/buyer through explicit transfer.

### Rules

1. Listing-side parties may create/enrich with scoped authority only.
2. Buyer/seller handoff closes listing-side authority and opens owner authority.
3. HomeID identity is stable across handoff.
4. Seller-private evidence is excluded from transfer by default.
5. HomeScout listing/sale flows may trigger handoff workflow.

### Contract targets (Phase 1C)

1. Realtor can create/enrich with scoped authority.
2. Property manager can create/enrich with scoped authority.
3. Seller controls buyer packet inclusion.
4. Buyer can claim property with pre-existing HomeID.
5. Handoff closes seller/listing authority and opens buyer/owner authority.
6. Private seller-only evidence excluded by default.
7. HomeScout listing/sale flow can trigger handoff.
8. Listing-side attribution persists without permanent control.

## Non-goals for this slice

- No schema migrations.
- No route implementation.
- No UI implementation.
- No mutation of unrelated TradeScout surfaces.
