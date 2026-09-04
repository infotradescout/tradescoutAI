# TradeScout OAuth identity boundary

Status: Draft convergence evidence  
Authority: Infinity System Convergence Standard, approved by Thomas on
2026-09-04

## Canonical product-local owners

- `server/auth.ts` owns TradeScout's Local, Google, and Facebook Passport
  strategies, provider availability, provider-subject resolution, and the
  fail-closed social identity policy.
- `server/storage.ts` owns the transitional lookup across legacy dedicated
  provider columns and the shared `provider` / `providerId` fields.
- `server/routes.ts` owns the HTTP entry and callback routes, safe return paths,
  referral attribution, verification handoff, and the product-specific
  community welcome hook.
- `client/src/pages/pre-scout-setup.tsx` owns the canonical person-facing auth
  surface and explains a rejected link or collision without implying that a
  write occurred.

This is a TradeScout boundary. It does not assign the future Infinity-wide
human identity owner.

## Identity rule

The provider subject identifier is login proof. A provider-supplied email is
discovery and collision evidence only; it is not authority to modify an
existing account.

| Provider-subject match | Email match | Decision | Write |
| --- | --- | --- | --- |
| Same account | Same account | Sign in | None |
| Existing account | None | Sign in | None |
| None | Existing account | Require authenticated linking | None |
| One account | Different account | Stop for identity collision | None |
| None | None | Create product-local account | New account only |

Google and Facebook use the same decision function. Neither provider may
silently attach itself to an account merely because the emails match.

## Converged in this change

- Google strategy registration moved out of the route monolith and beside the
  existing Local and Facebook strategies.
- Strategy registration and `/api/auth/providers` reporting consume one
  provider-availability decision.
- Facebook subject lookup now supports both its dedicated legacy field and the
  shared provider fields. Google has the equivalent lookup.
- Both strategies use one explicit decision table for existing identity,
  account creation, link-required, and collision outcomes.
- Link-required and collision outcomes fail before account creation or update.
- Failed callbacks return to the canonical auth surface with a constrained
  error code and a plain-language explanation.
- Product-specific welcome behavior stays outside the reusable auth owner via
  an explicit hook.

## Proof and limits

The policy, owner boundary, existing identity spine, OAuth availability, and
auth handoff have automated contract coverage. The server bundle builds.

This branch does not yet prove or perform:

- authenticated provider linking or unlinking;
- collision adjudication and account recovery;
- duplicate production-row reconciliation;
- provider-subject uniqueness constraints or a schema migration;
- a live Google or Facebook callback against production credentials;
- cross-product identity sharing, consent, deletion, or audit behavior;
- merge or deployment.

Those are named migration gates, not behavior silently inferred from the
current database.
