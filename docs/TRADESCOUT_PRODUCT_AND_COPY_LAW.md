# TradeScout Product And Copy Law

Last Updated: 2026-03-30
Owner: Product / Founder direction
Status: Locked unless explicitly changed by owner

## Purpose
This file exists to stop TradeScout from drifting into generic marketplace copy, internal ops jargon, or AI-shaped filler.

Use it as the authority for:
- brand language
- public UX wording
- product positioning
- navigation decisions
- page consolidation decisions

If a proposed copy or UX change conflicts with this file, the change should be rejected.

## 1. Locked Brand Law
- Brand name is `TradeScout`.
- Core statement is `Connection Without Compromise`.
- Do not remove, soften, paraphrase, or replace `Connection Without Compromise` unless the owner explicitly asks for it.
- `Scout` is a core product concept, not decorative marketing copy.
- `CVS` is allowed user-facing because it is the real system in use.

## 2. Locked Platform Law
- Visibility does not equal access.
- All contact is gated: `Intent -> Decision Card -> Contact`.
- Contact opens after acceptance.
- Claims-first signup; verification is adaptive/contextual.
- Counties are operational containers, not the primary public story.
- Intelligence is precomputed into:
  - `county_metrics`
  - `county_entities`
  - `county_notes`
- No pay-to-play.
- No lead selling.
- Read-only global community view is allowed; global action is not.
- Scout is the only bridge from discovery to action.
- Admin/UI never computes intelligence; jobs precompute and store snapshots.
- Trust/CVS governs exposure.
- AI + SEO ingestion precedes feature expansion.
- Never remove features; fix and harden.

## 3. Core Product Promise
TradeScout helps people find trusted local help and move to action without pay-to-play ranking, lead spam, or uncontrolled access.

Everything public-facing should strengthen this promise.

If a page, CTA, or feature explanation does not support this promise, it should be demoted, merged, reframed, or removed from top-level emphasis.

## 4. What TradeScout Is
- A trust-driven local operating system.
- A gated connection system.
- A product where Scout helps users move from discovery to action.
- A place where trust and fit matter more than who pays.

## 5. What TradeScout Is Not
- Not a lead marketplace.
- Not a pay-for-placement directory.
- Not an open contact board.
- Not a vague “AI for local services” product.
- Not an ops dashboard pretending to be a consumer product.
- Not a pile of disconnected surfaces with equal importance.

## 6. Public Language Rules

### Use language that explains outcomes
Prefer words that tell the user:
- what this does
- what happens next
- what is unlocked
- why they can trust it

### Do not expose internal mechanics as primary UX copy
Avoid turning internal architecture into public explanation.

Examples of bad public copy:
- governed
- authority-first
- operating flow
- internal routing language
- trust details
- real fit
- clear trust details
- state and area
- county-heavy phrasing where city or neighborhood is more useful

### Allowed user-facing product terms
- TradeScout
- Connection Without Compromise
- Scout
- Direct Connect
- CVS
- recommendation / recommendations
- request
- accept / accepted
- contact opens after acceptance
- local pros
- nearby
- city
- neighborhood
- market

### Terms that must stay precise
- Use `recommendations`, not `reviews`, unless a surface truly means reviews.
- Use `contact opens after acceptance`, not softened variants like `contact opens after there is a real fit`.
- Use `CVS` when referencing the actual trust system.

## 7. Geography Rules
- Counties remain canonical for storage, routing, and operations.
- Public UX should default to city, neighborhood, nearby, named market, or specific place names.
- State and area are too vague for most user-facing copy.
- County should appear publicly only when:
  - the task is explicitly operational/admin
  - the route itself is county-specific
  - legal or geographic precision actually matters

## 8. Admin Language Rules
Admin should read like an operating console, not a dashboard collage.

Admin surfaces should answer:
- what changed
- what triggered it
- where it happened
- what action should happen next

Admin cards should prefer evidence over abstraction:
- path
- route
- bot
- hits
- recrawls
- inventory
- local market signal

Do not lead with vague recommendations when the trigger evidence is available.

## 9. Navigation Rules
- Not every product surface should compete as a first-class destination.
- The top-level product story should center on:
  - Scout
  - Direct Connect
  - Community
  - Exchange
- Other surfaces should earn top-level placement only if they directly strengthen the core product promise.
- Navigation should reduce confusion, not advertise every capability equally.

## 10. Page Quality Rules
Every public page should be able to answer:
- who is this for
- what can they do here
- why TradeScout is different
- what happens next

If a page mostly repeats another page with different wording, it is a consolidation candidate.

If a page sounds like:
- AI filler
- internal product doctrine
- SEO padding
- generic marketplace copy

it needs rewrite or consolidation.

## 11. Copy Review Checklist
Before shipping user-facing copy, verify:
- Does it preserve platform law?
- Does it keep `Connection Without Compromise` intact where brand law requires it?
- Does it describe user outcomes instead of system internals?
- Does it use `recommendations` correctly?
- Does it say `contact opens after acceptance` where relevant?
- Does it avoid vague location language?
- Does it sound like one coherent product?

## 12. Execution Order For Cleanup
When cleaning the product, work in this order:
1. Lock brand and copy law.
2. Simplify top-level navigation.
3. Rewrite shared shell and core conversion surfaces.
4. Rewrite geography and matching language around specific places and evidence.
5. Consolidate duplicate public pages.
6. Normalize admin surfaces into evidence-first operator UX.

This order is mandatory because later phases should inherit rules from earlier ones.
