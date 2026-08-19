# TradeScout in-profile accounts

## Product decision

Every published TradeScout profile has the same user-facing action:

**Create an account**

It is not “Create a fabricator account,” “Create a builder account,” or another role-specific signup. It is also not a JW Stone-only feature.

Only businesses can create an account with a public TradeScout profile.

The relationship is:

`one TradeScout business identity → one account with a public profile → optional product access`

A profile account is not a second password, a duplicate TradeScout user, a copied business profile, or a separate BidRock identity.

## User job

A business should be able to begin on any published TradeScout profile, create the relationship there, and return later through its existing TradeScout business identity.

Examples:

1. A fabricator visits JW Stone and selects **Create an account**.
2. A contractor visits a supplier profile and selects **Create an account**.
3. A retailer visits a manufacturer profile and selects **Create an account**.
4. A local business visits another public profile and selects **Create an account**.

The visible action and relationship are identical in every case. TradeScout creates or reuses the visitor's business identity, then creates one account between that business identity and the profile being viewed.

The profile does not ask the visitor to choose Fabricator, Builder, Designer, Supplier, or another account type. Those business facts belong to the visitor's existing TradeScout business profile and verification records.

## Canonical ownership

| Concern | Authority |
| --- | --- |
| Sign-in, email, password, social login | Existing TradeScout user identity |
| Visitor's business identity and verification | Existing private `user_profiles` business profile |
| Public business presentation | Existing TradeScout profile |
| Business-to-profile account relationship | `profile_business_accounts` |
| Product-specific access | `profile_account_entitlements` |
| Saved items | The applicable product's saved-state authority |
| Private pricing | Seller and pricing authority |
| Messages and requests | Direct Connect and conversation authority |
| Orders and payments | Commerce, procurement, and payment authority |

## Universal public-profile rule

- Every published profile receives the account action through the shared public-profile action component.
- No profile gets a separate account model merely because it has a custom design or mapped domain.
- JW Stone, R.E.D. Graniti, ISSA Build, ordinary business profiles, and future profile types use the same relationship contract.
- A custom profile may choose where the shared action is visually placed, but it may not replace it with a role-specific or product-owned account system.

## Business-only rule

- A personal or homeowner-only identity cannot create a profile account.
- A signed-out visitor is sent through the existing TradeScout account setup with business setup selected.
- A signed-in person without a TradeScout business profile is sent through business setup.
- A business may create one account with each published profile.
- Repeating the action reuses the same account instead of creating duplicates.
- Verification remains pending, approved, or rejected according to the existing TradeScout business-verification record.

## Concurrent product access

Product access is downstream of the universal profile account.

When a business creates an account with an eligible stone profile:

1. The business-to-profile account is created.
2. A `bidrock` product entitlement is added to that same account.
3. The entitlement remains pending until business verification is approved.

Other profiles may add different product entitlements later without changing the visible **Create an account** flow or creating another identity system.

## Routes

- `GET /api/u/:slug/account` — profile policy, business eligibility, and current relationship state
- `POST /api/u/:slug/account` — authenticated, idempotent business-account creation

Unsigned visitors return through:

`/u/:slug?profileAccount=1`

The profile completes the relationship after the TradeScout business identity exists.

## Privacy and trust

- No second password or credential record.
- No request text, message text, phone number, address, private note, or uploaded content is stored in the profile-account record.
- Business profiles remain private while verification is pending.
- Account creation does not claim that the business is verified.
- Suspended relationships and suspended product entitlements remain suspended during repeat entry.
- Product entitlements do not bypass pricing, commerce, account verification, or contact rules.

## Current lane

This lane establishes the reusable business-only account contract and exposes **Create an account** through the shared public-profile action layer used by every published profile.

It does not redesign individual profiles, add Stone Core promotion to JW Stone, launch BidRock checkout, or claim that saved-state, private pricing, orders, and conversations are already connected.
