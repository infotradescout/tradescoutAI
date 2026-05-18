# Opportunity Radar Contract

Date: 2026-05-17
Owner: TradeScout product/engineering
Status: complete for `county_metrics`; expansion blocked until `county_entities` and `county_notes` carry the required Radar metadata below.

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

## County Entities Expansion Contract

`county_entities` may support Opportunity Radar only after each Radar-consumed row can prove all of the following at projection time:

| Requirement | Classification | Required proof before use |
| --- | --- | --- |
| County scope | enforced | `county_fips` resolves to a valid county and the move response includes that county context. |
| Active assignment | enforced | `status = active`; inactive, draft, suspended, or unknown assignments are excluded. |
| Trust/CVS exposure | enforced | Entity exposure is checked through the active Trust/CVS eligibility path before the entity label, category, or action target can appear in a move. |
| Source provenance | enforced | `metadata.sourceKind`, `metadata.sourceLabel`, and either `metadata.sourceRef` or a stable first-party entity reference exist. |
| Freshness | enforced | `updated_at` or `metadata.sourceUpdatedAt` is available and shown as `updatedAt`/freshness context on the move. |
| Action boundary | enforced | Entity-backed actions route to Scout prompts or Decision Cards; they must not expose direct contact, send messages, book work, publish, quote, invoice, or move money. |
| Sensitive inference filter | enforced | Metadata cannot expose private owner identity, private contact details, personal financial status, or unsupported acquisition/weakness claims. |

Until those proofs exist, `county_entities` may appear in admin coverage tools, but not in public Scout Opportunity Radar moves.

Minimum metadata shape for future use:

```json
{
  "sourceKind": "first_party_assignment | partner_record | business_profile | verified_import",
  "sourceLabel": "Human-readable source",
  "sourceRef": "stable-source-id-or-url",
  "sourceUpdatedAt": "ISO-8601 timestamp",
  "cvsExposureCheckedAt": "ISO-8601 timestamp",
  "cvsExposureOutcome": "eligible | limited",
  "publicMoveEligible": true,
  "sensitiveFieldsStripped": true
}
```

## County Notes Expansion Contract

`county_notes` may support Opportunity Radar only after notes are transformed into a non-sensitive, source-visible summary. Raw note text must never be rendered directly in public Scout moves.

| Requirement | Classification | Required proof before use |
| --- | --- | --- |
| Admin-only raw memory | enforced | `content` remains admin operational memory and is not sent directly to public Scout cards, map pins, or prompts. |
| Sanitized projection | enforced | A separate derived summary strips names, private contact details, unsupported allegations, sensitive personal data, and internal-only instructions. |
| Human accountability | enforced | `author_user_id` remains audit-only; public moves show source class/freshness, not the admin author's identity. |
| Category allowlist | enforced | Only operational categories approved for Radar can contribute to moves; risk notes can suppress or limit exposure but cannot create public claims. |
| Freshness | enforced | `updated_at` is projected as freshness context; stale notes cannot create high-confidence moves. |
| Trust/CVS interaction | enforced | Notes may reduce, suppress, or contextualize exposure; they cannot override CVS eligibility or grant visibility. |
| Temporary exception record | enforced | Any read-time note summarization must be logged as a temporary exception with owner, rationale, and removal date before release. |

Minimum derived projection shape for future use:

```json
{
  "sourceKind": "admin_county_note_summary",
  "sourceLabel": "County operations note",
  "sourceRef": "county_note:<id>",
  "sourceUpdatedAt": "ISO-8601 timestamp",
  "sanitizedSummary": "Public-safe operational context",
  "allowedMoveTypes": ["service_gap", "partnership_target"],
  "riskSuppressesExposure": false,
  "temporaryException": {
    "owner": "required for read-time derivation",
    "rationale": "required for read-time derivation",
    "removalDate": "YYYY-MM-DD"
  }
}
```

## Expansion Status

`county_entities` and `county_notes` are not currently approved sources for runtime Opportunity Radar moves.

Approved runtime source today:

- `county_metrics`

Blocked runtime sources today:

- `county_entities` until the entity expansion contract above is implemented.
- `county_notes` until sanitized derived note projections and exception tracking exist.

## Non-Goals

Opportunity Radar must not become:

- A public business directory.
- A contact list.
- A paid placement product.
- A lead-selling surface.
- A standalone map authority.
- A way around Direct Connect, Messages, Trust/CVS, Exchange, HomeScout, Community, or Finance governance.
