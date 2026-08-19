# TradeScout in-profile accounts

## Product decision

The user-facing action is simply:

**Create an account**

It is not “Create a fabricator account,” “Create a builder account,” or another role-specific signup.

Only businesses can create an account with a public TradeScout profile.

The relationship is:

`one TradeScout business identity → one account with a public profile → optional product access`

A profile account is not a second password, a duplicate TradeScout user, a copied business profile, or a separate BidRock identity.

## User job

A business should be able to begin on another business's public profile, create the relationship there, and return later through its existing TradeScout business identity.

Example:

1. A business visits the JW Stone profile.
2. It selects **Create an account**.
3. TradeScout creates or reuses the visitor's business identity.
4. TradeScout creates one account between that business identity and JW Stone.
5. Eligible stone-marketplace access is added concurrently behind the same relationship.

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

## Business-only rule

- A personal or homeowner-only identity cannot create a profile account.
- A signed-out visitor is sent through the existing TradeScout account setup with business setup selected.
- A signed-in person without a TradeScout business profile is sent through business setup.
- A business may create one account with each eligible public profile.
- Repeating the action reuses the same account instead of creating duplicates.
- Verification remains pending, approved, or rejected according to the existing TradeScout business-verification record.

## Concurrent BidRock access

BidRock is downstream product access, not the account owner.

When a business creates an account with an eligible stone profile:

1. The business-to-profile account is created.
2. A `bidrock` product entitlement is added to that account.
3. The entitlement remains pending until business verification is approved.

No role selection is required. The CTA and account remain owned by the profile experience.

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

This lane establishes the reusable business-only account contract and places the first **Create an account** action inside JW Stone.

It does not redesign JW Stone, add Stone Core promotion to the profile, launch BidRock checkout, or claim that saved-state, private pricing, orders, and conversations are already connected.
