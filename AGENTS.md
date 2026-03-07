# AGENTS.md — TradeScout (Repo-Specific)

This repo is TradeScout only. Never import MealScout/Trader’s Corner assets, copy, or concepts.

## 1) Platform law (must be preserved)
- Visibility does not equal access: being seen never grants contact or power.
- All contact is gated: Intent → Decision Card → Contact.
- Claims-first signup; verification is adaptive/contextual.
- Counties are operational containers; intelligence precomputes into:
  - county_metrics (facts)
  - county_entities (assignments)
  - county_notes (human context)
- No pay-to-play; no lead selling.
- Read-only global community view allowed; global action is not.
- Scout is the only bridge from discovery to action.
- Admin/UI never computes intelligence; jobs precompute and store snapshots.
- Trust/CVS governs exposure.
- AI + SEO ingestion precedes feature expansion.
- Never remove features; fix and harden.

## 2) Implementation constraints
- Any change affecting contact flows MUST preserve gating invariants.
- Any change affecting county routing MUST write to the correct containers (no ad-hoc fields).
- Any change affecting trust/exposure MUST route through Trust/CVS logic (no bypass).

## 3) Definition of done (TradeScout)
- Feature works end-to-end for at least one county path.
- No regressions in gating.
- Tests/build succeed (or document why not and provide the fix path).
- Clear migration notes if data shape changes.

