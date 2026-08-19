# TradeScout in-profile accounts

## Product decision

Every published TradeScout profile has the same user-facing action:

**Create an account**

The action is universal. The account policy is not.

It is not “Create a fabricator account,” “Create a builder account,” or another role-specific signup. It is also not a JW Stone-only or BidRock-owned feature.

Each profile decides what kind of TradeScout identity may use its account and what that account is meant to unlock.

## Current account priorities

### Existing stone profiles

The completed stone-profile lane is business-only.

- JW Stone
- R.E.D. Graniti
- ISSA Build
- Future published profiles whose inventory is identified as stone

Those accounts require an existing TradeScout business identity because they can lead to verified-business stone access and BidRock. A personal or homeowner-only identity cannot create one.

### Other public profiles

Other profiles are not automatically business-only.

Their account priority may be customer continuity, membership, bookings, project access, dealer access, property-owner tools, business access, or another profile-specific job. The profile policy determines whether a normal TradeScout identity or a TradeScout business identity is required.

Until a non-stone profile defines a stricter policy, it uses the normal signed-in TradeScout identity. It does not receive BidRock merely because the universal account action is present.

## Governing relationship

`one TradeScout identity → one account with a public profile → profile-specific priority → optional product access`

When a profile requires business access, the relationship also carries the user's existing TradeScout business profile and its verification state.

A profile account is not a second password, a duplicate TradeScout user, a copied business profile, or a separate product identity.

## User jobs

Examples:

1. A fabricator visits JW Stone and selects **Create an account**. The stone policy requires a TradeScout business profile and may add BidRock access.
2. A homeowner visits a service profile and selects **Create an account**. That profile may prioritize customer continuity without requiring a business identity.
3. A contractor visits a wholesale supplier whose profile policy requires businesses. The same generic action routes through business setup.
4. A future community or membership profile uses the same action but defines its own purpose and allowed identity.

The profile never asks the visitor to choose Fabricator, Builder, Designer, Supplier, Customer, or another account role during this flow. Those facts belong to the user's existing TradeScout identity, business profile, project, or later profile-specific setup.

## Canonical ownership

| Concern | Authority |
| --- | --- |
| Sign-in, email, password, social login | Existing TradeScout user identity |
| Business identity and verification when required | Existing private `user_profiles` business profile |
| Public presentation and account priority | Existing TradeScout profile |
| User-to-profile account relationship | `profile_accounts` |
| Product-specific access | `profile_account_entitlements` |
| Saved items | The applicable product's saved-state authority |
| Private pricing | Seller and pricing authority |
| Messages and requests | Direct Connect and conversation authority |
| Orders and payments | Commerce, procurement, and payment authority |

## Universal public-profile rule

- Every published profile receives the same **Create an account** action through the shared public-profile layer.
- No profile gets a separate credential system merely because it has a custom design or mapped domain.
- Custom profiles may choose where the shared action is placed, but they may not replace it with a role-specific or product-owned account universe.
- The visible CTA remains generic even when the profile requires a business identity.

## Profile-priority rule

A profile account policy carries:

- required identity: normal TradeScout user or TradeScout business
- internal priority key
- safe description
- optional downstream product access

Stone detection always wins over a weaker configuration. A stone profile cannot downgrade itself to a personal account because business verification protects private pricing and BidRock access.

Non-stone profiles may define their own account policy in the profile's private configuration. They are not forced into the stone-business model.

## Concurrent BidRock access

BidRock is downstream product access, not the account owner.

When a business creates an account with an eligible stone profile:

1. The business-backed profile account is created.
2. A `bidrock` product entitlement is added to that same account.
3. The entitlement remains pending until business verification is approved.

A non-stone profile does not receive BidRock. A normal user-backed profile account does not receive BidRock.

## Routes

- `GET /api/u/:slug/account` — profile policy, required identity, current relationship, and business-setup requirement when applicable
- `POST /api/u/:slug/account` — authenticated, idempotent account creation under that profile's policy

Unsigned visitors return through:

`/u/:slug?profileAccount=1`

The profile completes the relationship after the required TradeScout identity exists. Business setup is requested only when the target profile policy requires it.

## Privacy and trust

- No second password or credential record.
- No request text, message text, phone number, address, private note, or uploaded content is stored in the profile-account record.
- Business verification is required only where the profile policy calls for business access.
- Account creation does not claim that a business is verified.
- Suspended relationships and suspended product entitlements remain suspended during repeat entry.
- Product entitlements do not bypass pricing, commerce, account verification, or contact rules.

## Current lane

This lane establishes one reusable account contract, exposes **Create an account** across published profiles, and enforces the first completed policy:

**stone profiles are business-only; other profiles keep their own priorities.**

It does not redesign individual profiles, add Stone Core promotion to JW Stone, launch BidRock checkout, or claim that saved-state, private pricing, orders, and conversations are already connected.
