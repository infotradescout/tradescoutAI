# Local Opportunity Positioning Doctrine Audit

Date: 2026-06-09
Owner: TradeScout product/engineering
Scope: Product positioning, public copy, campaign language, and legacy audience-specific surfaces.

## Law Integrity

| Statement | Classification | Notes |
| --- | --- | --- |
| TradeScout is local opportunity infrastructure for people, businesses, providers, hosts, buyers, sellers, and communities. | policy_target | Canonical doctrine and copy law now use this as the core definition. Runtime/product surfaces should continue moving away from contractor/homeowner-only framing unless explicitly scoped. |
| Contact remains gated even when opportunity discovery is broad. | enforced | The positioning update preserves Intent -> Decision Card -> Contact, Decision Before Contact, Awareness ≠ Authority, Claims First, and Connection Without Compromise. |
| Contractor-only language is allowed only in contractor-specific campaigns, trade-specific SEO, and legacy compatibility contexts. | policy_target | Existing role, route, schema, and compatibility names remain while user-facing acquisition and general product copy continue genericization. |
| Homeowner-only language is allowed only in homeowner-specific campaigns, HomeID/HomeScout contexts, and legacy compatibility contexts. | policy_target | Homeowner language remains valid where the feature is explicitly scoped to homes/homeowners, but not as default TradeScout positioning. |
| Legacy contractor/homeowner route, schema, and table names are compatibility details, not the preferred product positioning. | temporary_exception | Owner: engineering. Rationale: renaming storage/API contracts requires migration and redirect planning. Removal date: 2026-08-31. |

## Messaging Doctrine

Preferred category line:

They control access. We open opportunity.

Use broader terms by default:
- people
- businesses
- providers
- communities
- opportunity
- connection
- verified intent
- local exchange

Position TradeScout against platforms that monetize access before value is created.

Preserve:
- Connection Without Compromise
- Decision Before Contact
- Awareness ≠ Authority
- Claims First

## Updated Canonical Surfaces

- `docs/reference/DOCTRINE.md`
- `docs/TRADESCOUT_PRODUCT_AND_COPY_LAW.md`
- `TRADESCOUT_FOUNDER_INPUT.md`
- `client/index.html`

## Next Work

1. Continue replacing general public copy that defaults to contractors/homeowners with local opportunity language.
2. Keep contractor/homeowner copy only where the campaign, route, SEO target, or feature context explicitly requires it.
3. Preserve gated-contact language in every broad opportunity surface.
