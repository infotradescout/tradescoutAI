# In-profile accounts

## Product decision

Every published profile may present the same clear action:

**Create an account**

The visitor creates the account with the business or profile they are currently using. They are not required to visit TradeScout first, complete general onboarding, publish a business listing, or understand the shared account infrastructure underneath.

The first completed business example is JW Stone:

`Visit JW Stone → Create an account → enter normal business details → continue inside JW Stone`

## Governing relationship

`one private shared identity → one account relationship with a profile → profile-specific tools and history`

The private shared identity prevents duplicate passwords across connected products. It does not make the visitor create a public TradeScout presence.

An in-profile account is not:

- a second password
- a role-specific account
- an automatically published TradeScout profile
- a copied public business listing
- a separate BidRock identity
- a forced general onboarding session

## JW Stone rule

Any business can create an account with JW Stone.

JW Stone does not ask the business to classify itself as a fabricator, builder, contractor, designer, dealer, supplier, or another account role. Those may describe how a company operates, but they are not account types and do not belong in signup.

A new JW Stone visitor provides:

- business name
- contact name
- email
- phone
- password
- acceptance of the terms and privacy policy

The system then creates:

1. one private shared identity
2. one private business identity record
3. one account relationship with JW Stone
4. an optional downstream BidRock entitlement under the same relationship

The private business identity is not a public business page. No business directory record or published profile is created during this flow.

## Existing customers

A person who already has a shared identity can sign in from JW Stone and continue without leaving the JW Stone experience.

If that identity already has a private business record, the existing record is reused. If it does not, the person supplies the business name and the system creates a private business record in the same flow.

The account relationship remains idempotent: one private identity has at most one account relationship with the target profile.

## Other profiles

Other profiles use the same visible action but keep their own account policy.

A profile may support:

- a normal customer account
- a business account
- membership continuity
- booking history
- saved projects
- property-owner tools
- dealer access
- another profile-specific job

The profile policy decides whether a normal private identity or private business identity backs the relationship. The visitor still creates the account directly with the profile rather than being diverted into general platform onboarding.

## Canonical ownership

| Concern | Authority |
| --- | --- |
| Email, password, and session | Private shared identity |
| Private business identity and verification | Private business identity record |
| Public presentation and account priority | Target public profile |
| User-to-profile relationship | `profile_accounts` |
| Product-specific access | `profile_account_entitlements` |
| Saved items | Applicable product saved-state authority |
| Private pricing | Seller and pricing authority |
| Messages and requests | Direct Connect and conversation authority |
| Orders and payments | Commerce, procurement, and payment authority |

## Privacy boundary

Account creation stores only the information needed to establish the private relationship.

The profile-account record does not store:

- passwords
- message or request text
- phone numbers
- addresses
- private notes
- uploaded content
- payment information

The supporting private business record remains private by default. Publishing a TradeScout business profile requires a later deliberate action.

## Verification boundary

Creating an account and verifying a business are separate actions.

A business can create and use its JW Stone account immediately. Verification controls protected features such as private business pricing or qualified marketplace access. Verification does not decide whether a business is allowed to have an account.

The supported verification states are:

- pending
- approved
- rejected

The profile relationship also supports active, suspended, and closed states.

## Concurrent BidRock access

BidRock remains downstream product access, not the account owner.

For an eligible stone profile:

1. The business-backed profile account is created or reused.
2. A `bidrock` entitlement is attached to that same relationship.
3. The entitlement remains pending until business verification is approved.

No second password, separate BidRock business identity, or role-specific registration is created.

## Routes

- `GET /api/u/:slug/account` — reads the profile policy and current relationship
- `POST /api/u/:slug/account` — creates or reuses the relationship and may create the required private business identity

Authentication itself continues to use the existing shared session endpoints, but the profile owns the visible signup and sign-in experience.

Source paths may come from the normal public profile route or a branded product surface such as `/jw-stone`. They must remain safe same-origin relative paths.

## Current lane

This lane establishes the profile-native account path and removes the general onboarding dependency.

It does not yet claim that these later product layers are complete:

- cross-device saved-state sync
- private pricing presentation
- quote history
- order history
- payment processing
- conversation history
- full My JW Stone workspace

Those layers must attach to the same account relationship rather than creating another identity system.
