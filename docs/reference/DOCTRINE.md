# TradeScout Doctrine (Locked)

Last Updated: 2026-06-09
Owner: OpenClaw Authority Layer
Status: Locked - Directional Changes Only

## Purpose
This file defines non-negotiable platform law and directional doctrine.
If a proposal conflicts with this file, the proposal is rejected.

## Platform Law (Non-Negotiable)
- Visibility does not equal access.
- All contact is gated: Intent -> Decision Card -> Contact.
- Claims-first signup; verification is adaptive/contextual.
- Counties are operational containers.
- Intelligence is precomputed into:
  - `county_metrics` (facts)
  - `county_entities` (assignments)
  - `county_notes` (human context)
- No pay-to-play.
- No lead selling.
- Read-only global community view is allowed; global action is not.
- Scout is the primary guided bridge from discovery to action; non-Scout action paths must still obey contact, trust, and county law.
- Target contract: Admin/UI consumes precomputed intelligence. Transitional read-time derived intelligence requires a documented temporary exception.
- Trust/CVS governs exposure.
- AI + SEO ingestion precedes feature expansion.
- Never remove features; fix and harden.

## Positioning Doctrine
TradeScout is local opportunity infrastructure for people, businesses, providers, hosts, buyers, sellers, and communities.

Preferred category line:

They control access. We open opportunity.

Core public framing:
- TradeScout opens local exchange through verified intent, trusted context, and gated connection.
- TradeScout is for people and communities creating, discovering, evaluating, and acting on local opportunity.
- TradeScout stands against platforms that monetize access before value is created.

Messaging rules:
- Avoid contractor-only language except in contractor-specific campaigns, trade-specific SEO, and legacy compatibility contexts.
- Avoid homeowner-only language except in homeowner-specific campaigns, HomeID/HomeScout contexts, and legacy compatibility contexts.
- Prefer broader terms such as people, businesses, providers, communities, opportunity, connection, verified intent, and local exchange.
- Preserve these named principles in doctrine and core copy: `Connection Without Compromise`, `Decision Before Contact`, `Awareness ≠ Authority`, and `Claims First`.

## Law Validity Rule
- Doctrine claims are authoritative only when mapped to runtime enforcement or tracked as temporary exceptions.
- Canonical status matrix: `docs/audits/LAW_REALITY_MATRIX.md`
- Canonical guardrails: `docs/audits/DRIFT_GUARDS.md`

## Directional Rules
- Any contact-flow change must preserve gating invariants.
- Any county-routing change must write to canonical county containers only.
- Any trust/exposure change must route through Trust/CVS logic only.
- Any production TradeScout copy must remain TradeScout-only unless an explicit exception is approved and logged.
- If it does not affect direction, it does not belong in authority discussion.

## What TradeScout Will Never Become
- A pay-for-placement marketplace.
- A lead broker that sells user intent.
- A global action feed that bypasses county context.
- A direct-connect platform without Intent -> Decision Card gating.
- An analytics-only product disconnected from real user action completion.

## KPI Doctrine
Primary KPIs (authoritative):
- `% traffic -> action`
- `% action -> completion`
- `% completion -> real connection`

Secondary diagnostics (non-authoritative):
- Drop-off by step
- County-level conversion variance
- Segment-level conversion variance

Vanity metrics (never treated as success):
- Likes
- Comments
- Reach alone
