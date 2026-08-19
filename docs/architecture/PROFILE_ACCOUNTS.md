# TradeScout in-profile accounts

## Product decision

A visitor may create an account **with a public TradeScout profile** without creating another identity system.

The relationship is:

`one TradeScout identity → one profile-scoped account → optional verified business persona → optional product entitlements`

A profile account is not a second password, a duplicate TradeScout user, a clone of the business profile, or a separate BidRock identity.

## User job

A visitor should be able to begin on a business's public profile, create the relationship in that same profile experience, and return later through one TradeScout sign-in.

Examples:

- A homeowner creates a customer account with a local business.
- A fabricator creates a fabricator account with JW Stone.
- A builder creates a builder/contractor account with a stone supplier.
- A member creates an account with a community profile.

The profile account is the durable relationship boundary for later profile-specific capabilities such as saved work, private pricing, project continuity, documents, orders, and conversations. Those capabilities attach only when their own authoritative systems are integrated; creating the account does not falsely claim they already exist.

## Canonical ownership

| Concern | Authority |
| --- | --- |
| Sign-in, email, password, social login | Existing TradeScout user identity |
| Public business presentation | Existing TradeScout profile |
| Relationship between visitor and profile | `profile_accounts` |
| Business role and verification | Existing private `user_profiles` business persona |
| Product-specific access | `profile_account_entitlements` |
| Saved items | The relevant product's saved-state authority |
| Private pricing | Seller/pricing authority |
| Messages and requests | Existing Direct Connect/conversation authority |
| Orders and payments | Existing commerce/procurement/payment authority |

## Account roles

The foundation supports:

- Customer
- Fabricator
- Builder or contractor
- Designer
- Stone yard or dealer
- Supplier
- Trade professional
- Member

Each public profile receives a policy derived from the profile and its published content. Ordinary businesses expose customer and trade-professional relationships. Stone businesses expose the stone-specific roles. JW Stone defaults to Fabricator for the first proof without removing the other valid paths.

## Concurrent product access

Product access is downstream of the profile relationship.

For an eligible verified-business role on a stone profile:

1. Create or reuse the TradeScout identity.
2. Create or reuse the private TradeScout business persona.
3. Create or update the profile account.
4. Add the `bidrock` product entitlement.
5. Keep the entitlement pending until business verification passes.

BidRock therefore runs concurrently with profile account creation without owning the profile relationship or creating another account universe.

Customer-only profile accounts do not automatically receive business-only BidRock access.

## Routes

- `GET /api/u/:slug/account` — public-safe policy and signed-in relationship state
- `POST /api/u/:slug/account` — authenticated, idempotent account creation or role addition

The public profile card sends unsigned visitors through the existing TradeScout account setup and returns them to:

`/u/:slug?profileAccount=1&role=:role`

The profile then completes the relationship automatically after the TradeScout session exists.

## Privacy and trust

- No second password or credential record.
- No request text, message text, phone number, address, private note, or uploaded content is stored in the profile-account record.
- Business personas remain private while verification is pending.
- Account creation does not claim the visitor is a verified business.
- Suspended profile relationships and suspended product entitlements remain suspended during idempotent re-entry.
- Product entitlements do not bypass their product's pricing, commerce, or verification rules.

## Current first useful lane

This lane establishes the reusable platform contract and places the first working in-profile account card inside JW Stone. It deliberately does not redesign the JW Stone profile, place Stone Core partnership promotion on it, launch BidRock checkout, or claim private pricing and saved-state integration are complete.

After this foundation is proven, the same card can be placed in the standard profile action area for every eligible profile without changing the identity or persistence model.
