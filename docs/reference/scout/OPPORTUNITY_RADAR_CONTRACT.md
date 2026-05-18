# Opportunity Radar Contract

Date: 2026-05-17
Owner: TradeScout product/engineering
Status: initial contract

## Purpose

Opportunity Radar is the Scout interface layer that presents local "moves" instead of directory results.

It answers:

- What local move may be worth reviewing.
- Why the move matters.
- Which precomputed county signal supports it.
- What governed Scout action can prepare next.

Opportunity Radar is not a new authority engine. It is a Scout and Maps presentation pattern over governed county intelligence.

## Authority Boundary

Opportunity Radar must preserve TradeScout law:

| Statement | Classification | Runtime rule |
| --- | --- | --- |
| Visibility does not equal access. | enforced | A visible move must not reveal direct contact details or grant messaging, booking, payment, posting, quote, or invoice authority. |
| Contact is gated through Intent -> Decision Card -> Contact. | enforced | Move actions can prepare pitches, offers, reports, and drafts; contact still requires the existing gated path. |
| Counties are operational containers. | enforced | Moves must resolve to county context before rendering. |
| Trust/CVS governs exposure. | enforced | Moves that expose entities must only include CVS-eligible entities. |
| Admin/UI reads precomputed intelligence. | policy_target | Moves should read precomputed county intelligence; read-time derivation requires a documented temporary exception. |
| No pay-to-play and no lead selling. | enforced | Move rank must not be sold placement, contact resale, or paid exposure. |

## Current Projection

The first runtime projection is `opportunityMoves` on `GET /api/scout/home-snapshot`.

Current source:

- `county_metrics`

Current metric families:

- `completed_jobs_30d`
- `completed_job_median_receipt_usd_30d`
- `homescout_price_drops_7d`
- `homescout_median_dom_days`
- `tradedeals_active`
- `tradedeals_claimed_30d`
- `events_this_week`

Current surfaces:

- Scout Home Opportunity Radar feed.
- Active Scout result card when source-backed moves are available.

## Move Shape

Every move must include:

- `id`
- `type`
- `title`
- `whyItMatters`
- `actionLabel`
- `prompt`
- `sourceLabel`
- `sourceMetricKeys`
- `confidence`
- `updatedAt`

The prompt must route back into Scout. It must not directly expose contact, send a message, create a booking, move money, publish, quote, invoice, or broadcast.

## Move Types

Allowed initial move types:

- `service_gap`
- `underserved_area`
- `fast_win`
- `partnership_target`
- `audit_target`

Additional move types require this contract to be updated first.

## Expansion Rules

Future projections may include `county_entities` and `county_notes` only when:

- Entity exposure has a Trust/CVS eligibility check.
- Human notes are transformed into non-sensitive operational context.
- Source and freshness are visible to the user.
- Any read-time derivation is recorded as a temporary exception with owner, rationale, and removal date.

## Non-Goals

Opportunity Radar must not become:

- A public business directory.
- A contact list.
- A paid placement product.
- A lead-selling surface.
- A standalone map authority.
- A way around Direct Connect, Messages, Trust/CVS, Exchange, HomeScout, Community, or Finance governance.

