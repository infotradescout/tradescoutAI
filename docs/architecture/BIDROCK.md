# BidRock marketplace architecture

## Product role

BidRock is the verified-business stone marketplace Powered by TradeScout.

It does not own business identity, public profiles, Stone Core, physical inventory, Direct Connect, payments, or HomeID. It combines authorized stone listings from those systems into one market.

## Product spine

Published stone profile or Stone Core material
→ BidRock listing projection
→ source-profile account
→ verified-business access
→ seller-controlled price
→ future offer/order/payment lane
→ delivery, fabrication, installation, and HomeID

## Listing authority

Every current stone on TradeScout is eligible for BidRock through one of two sources:

1. Canonical Stone Core material
2. Stone inside a published TradeScout profile inventory

The BidRock listing stores the source identity and public presentation fields needed for the marketplace. It does not manufacture:

- physical ownership
- slab, bundle, block, or container quantity
- custody
- yard location
- received or inspected status
- availability-now claims
- source or distribution rights

Removed source stones are archived rather than silently left active. Sold listings are not reactivated by catalog synchronization.

## Stone-only boundary

The generic profile inventory block can contain other products. BidRock accepts only approved stone families. The boundary is enforced in both application filtering and a database trigger.

JW Stone may retain `unconfirmed` arrivals because those are known stone records whose exact family still requires confirmation.

Moulding, millwork, cabinets, appliances, and unrelated inventory are not BidRock listings.

## Account boundary

BidRock does not create a BidRock account, JW account, fabricator account, or separate password.

The visible action is always:

**Create an account**

A buyer or seller opens the applicable source stone profile and creates the profile account there. Existing stone profiles require a TradeScout business identity. The profile-account system then grants `bidrock` as downstream product access.

A legacy `/bidrock/account` link redirects into the source profile account flow. It does not maintain a second onboarding system or account-role selector.

## Business verification and price visibility

- Public and unverified visitors can browse stone but cannot see private prices.
- A business-backed account with an eligible stone profile receives a BidRock entitlement.
- BidRock pricing activates when the supporting TradeScout business verification is approved.
- A source-profile owner or seller-business owner may manage its own listing price even before buying access is active.
- Admin authority remains governed by the existing TradeScout role system.

## Pricing rule

An authorized seller may set either:

- price per square foot
- price per slab

No other unit is accepted in this foundation.

When no price exists:

- the authorized seller sees the price editor and chooses square-foot or slab pricing;
- a verified business sees that the seller has not set a price;
- a public visitor sees the source-profile account path rather than private pricing.

Every price change is recorded in `bidrock_price_history`.

## Commercial rules reserved for the next lane

The foundation locks these approved rules without pretending checkout is live:

- ACH-only payment posture
- $100 fee when a BidRock listing completes a verified sale

This foundation does not launch checkout, buyer offers, counteroffers, reservations, orders, ACH authorization, funds capture, payout, release, freight/custody tracking, completed-sale processing, or actual fee collection.

Those states must reuse TradeScout procurement, payment, accounting, Direct Connect, Stone Core, and HomeID authorities rather than adding another commercial universe.
