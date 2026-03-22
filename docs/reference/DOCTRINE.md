# TradeScout Doctrine (Locked)

Last Updated: 2026-03-19
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
- Scout is the only bridge from discovery to action.
- Admin/UI never computes intelligence; jobs precompute and store snapshots.
- Trust/CVS governs exposure.
- AI + SEO ingestion precedes feature expansion.
- Never remove features; fix and harden.

## Directional Rules
- Any contact-flow change must preserve gating invariants.
- Any county-routing change must write to canonical county containers only.
- Any trust/exposure change must route through Trust/CVS logic only.
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
