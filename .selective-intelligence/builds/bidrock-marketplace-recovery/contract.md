# Build Contract: bidrock-marketplace-recovery

Status: offer-first marketplace correction in progress
Base revision: `764d56f0f5ffb88c6ef28fdcb5c4683c6a09dcb5`
Branch: `jw-stone/bidrock-offer-first`
Lock binding: Thomas's approved BidRock recovery checkpoint plus the controlling offer-first corrections supplied on 2026-08-24

## Current controlling amendment (`2026-08-24`)

- This amendment `REPLACE`s the prior auction-first framing wherever the two conflict. BidRock is a seller-confirmed stone marketplace and, for TradeScout/JW Stone inventory, a polished contact-and-offer funnel.
- A seller may publish current inventory without any asking price. An unpriced lot has no displayed or inferred price, opening bid, reserve, auction schedule, or required auction setup. Its buyer action is `Make an offer`.
- The buyer supplies the desired whole-lot quantity, total offer amount, and optional note. Submission creates only a private, attributable offer for seller review. It does not create an order, release contact details, charge either party, or activate payment.
- The seller may explicitly accept, counter, or decline. Only explicit acceptance may create the existing guarded reservation/order path.
- Other verified businesses may publish and sell their own seller-confirmed inventory through BidRock. A seller-set price or timed auction is optional, not a prerequisite to marketplace publication.
- Timed auctions remain supported only when a seller deliberately supplies an opening bid, increment, schedule, and fulfillment terms. Auction-owned lots continue to reject negotiated offers, and sellers cannot bid on or offer against their own inventory.
- Business verification, holder/delegation authority, stock freshness, privacy, Direct Connect/contact release gates, zero-fee controls, and dormant external payment boundaries remain protected.

## Authorized semantic history

- The 2026-08-20 recovery checkpoint authorizes the business-only BidRock marketplace, shared profile-native identity, confirmed-stock projection, private verified-business pricing, seller controls, ACH-only commerce lifecycle, and routed client workspace described below.
- The owner-authoritative confirmed-stock statement records Gold Macaubas as 6 slabs with 2 polished slabs. That current statement supersedes the older 1.5-polished filename evidence without changing the broader photo catalog or erasing its provenance.
- The product-owner `REPLACE` amendment approved at `2026-08-20T19:23:32Z`, reconfirmed on 2026-08-22, postpones the prior BidRock revenue decision for this release. This release adds no marketplace fee and canonical transaction and procurement records must carry zero in every fee field. It does not establish a permanent zero-fee policy; any later revenue model requires separate authorization.
- The 2026-08-21 auction-first amendment is retained as historical provenance for the optional auction subsystem. The controlling 2026-08-24 amendment above replaces it as the primary marketplace experience.

## Outcome

Build BidRock as a business-only, offer-first stone marketplace Powered by TradeScout inside the existing TradeScout application and database. JW Stone's seven confirmed physical-stock lots are the launch inventory and inquiry funnel, not a permanent single-seller boundary, and the broader JW photo catalog must not be relabeled as current or sale-ready.

## Included behavior

- One profile-native TradeScout business identity works across JW Stone and BidRock. There is no role picker, second password, or required general TradeScout onboarding before profile account creation.
- JW Stone's broader named/photo catalog remains a Material Library and source-evidence system.
- The seven owner-confirmed lots are deterministically and idempotently projected into Stone Core with exact dimensions and quantities. Projection never requires JW to retype them.
- Confirmed physical stock enters seller inventory as not published. Buyer exposure requires an explicit seller/admin sale-ready transition and a still-current physical position.
- Public and unverified callers receive no price value. Verified linked businesses may receive the seller's private per-slab or per-square-foot price.
- Inventory, publication, and price mutations require holder-business ownership, an administrator, or the exact durable delegation scope; profile ownership alone grants no Stone/BidRock write authority. Non-admin seller commerce also requires an active verified BidRock entitlement.
- Each sale-ready lot is publishable for private buyer offers without a price. A seller may optionally replace offer-taking with one independent timed auction with an opening bid, optional reserve, minimum increment, start/end time, two-minute soft-close window, pickup/freight terms, and an explicit scheduled/live/ended/no-sale/sold outcome.
- Verified businesses may submit a private maximum bid. Database-clock, row-locked proxy bidding exposes only the amount needed to lead, resolves equal maximums in favor of the earlier valid maximum, prevents seller self-bidding, and never creates fabricated bidders or activity.
- Public and unverified viewers may see lot facts, time remaining, bid count, and non-price auction state but no dollar value. Verified businesses may see the current bid and minimum next bid. Private bidder maximums remain visible only to their owner and authorized administrators.
- Bids inside the final two minutes extend the auction end by two minutes. A successful close creates exactly one winner, reservation, allocation, and ACH-only order when the reserve is met. An unmet reserve closes as no sale and can be explicitly relisted.
- The routed `/bidrock` client is an offer-first marketplace, not an inventory administration dashboard: seller-confirmed unpriced lots lead with `Make an offer`, exact physical facts, private attributable intake, search, filters, saved lots, compare, seller controls, and offer/order state. Deliberately configured auctions retain countdown, bid activity, reserve state, fulfillment terms, and `Place bid` only for those auction lots.
- BidRock is marketplace-wide and supports seller-classified natural and engineered stone slabs, bundles, blocks, containers, A-frames, and pieces represented by canonical Stone Core assets. JW Stone is the launch seller, never the marketplace identity.
- The seller inventory route, Stone Core persistence, public/seller DTOs, and BidRock projection preserve the seller-authoritative natural-or-engineered material class; unknown classes fail closed instead of being relabeled.
- Opening bid, optional reserve, increment, auction schedule, pickup terms, and freight terms are seller-authoritative inputs only when the seller chooses a timed auction. Confirmed inventory without them may be published as an unpriced offer-only listing; the platform never invents auctions, bids, asking prices, or offer amounts.
- The commerce contract retains private offer/counter/accept/reject, reservation, order, ACH readiness, custody/freight/fabrication, installation/HomeID handoff, cancellation, and completion. Fixed-price/Buy It Now remains outside this correction. External payment-provider actions remain inactive until separately authorized and configured.
- BidRock uses ACH only. BidRock fee values are zero throughout canonical linkage and settlement; no BidRock fee policy or calculation exists.

## Correction invariants

- Schema changes ship only through ordered, upgrade-safe migrations. Request handlers and public reads never create or mutate schema, project stock, or expire commerce state.
- Stock mutations require the holder business, an administrator, or durable explicit delegation. Editing stock atomically removes publication evidence and returns the BidRock listing to private draft until an explicit re-publication.
- Buyer-facing inventory uses a purpose-built stable public identifier; Stone Core passport and position identifiers remain private.
- Profile verification and BidRock entitlement reconciliation are atomic and idempotent and never reactivate suspended or revoked relationships.
- Offer, reservation, allocation, order, settlement, cancellation, and handoff transitions use database-clock truth plus row locks or compare-and-swap guards. Holds release or consume exactly once.
- Canonical ACH/procurement linkage is immutable and one-to-one. Linkage and settlement revalidate actors, listing/order provenance, contents, totals, ACH state, and zero fee fields.
- Handoff mutation is limited to the seller, an administrator, or an explicitly delegated provider, with truthful staged evidence and race-safe transitions.
- External listing and order paths use stable purpose-built public identifiers. Delegated providers receive only their assigned handoff type plus safe order/lot references and necessary schedule/location/evidence fields.

## Protected unchanged behavior

- JW Stone's complete catalog and source evidence remain present; catalog membership never implies physical stock or sale readiness.
- Existing Stone Core material/passport/position/publication boundaries remain canonical.
- Existing profile-account, payment, procurement, accounting, Direct Connect, HomeID, trust/CVS, privacy, and contact gates remain authorities; BidRock does not create parallel identity or payments systems.
- Public users never see price values or copy advertising that prices are available.
- No marketplace fee is added or advertised.
- The owner's 2026-08-22 correction permanently retracts separate Render service, preview-deployment, temporary-database, and temporary-connection authority. This correction stays in the existing repository and existing production service on `jw-stone/bidrock-offer-first`. Any release must use the exact local minimum-release contract and current production GO; production payment activation and GitHub Actions remain unauthorized.

## Canonical reuse decisions

| Responsibility | Disposition | Canonical owner |
| --- | --- | --- |
| Shared business identity | Extend | `shared/profileAccount.ts`, `server/services/profileAccountService.ts`, profile-account routes/components |
| Stone truth and freshness | Extend | `server/services/stoneCoreProvisioning.ts`, Stone Core tables |
| Confirmed JW stock fixture/import | Create bounded owner | `shared/stoneInventory.ts`, `server/services/jwStoneConfirmedStock.ts` |
| Stone inventory API | Create bounded route/service | profile-scoped Stone Core inventory route/service |
| BidRock domain and state | Reconcile/extend | foundation `shared/bidrock.ts` and `server/services/bidrockService.ts` |
| Timed auction and bid ledger | Extend canonical BidRock domain | ordered migration plus `shared/bidrock.ts`, `server/services/bidrockService.ts`, and `server/routes/bidrock.ts` |
| BidRock UI | Consolidate and reframe routed feature composition | existing BidRock React feature and canonical UI primitives |
| Payments/accounting | Reuse canonical records | `marketplace_transactions`, `procurement_orders`, and accounting authorities; `server/payment-service.ts` remains unchanged |

## Acceptance evidence

Focused domain/service/route/component tests must prove exact seven-lot values, idempotent identities, draft-before-sale-ready behavior, offer-only publication without a price or auction, buyer-supplied offer values, self-offer rejection, marketplace-wide natural/engineered classification, guest dollar redaction, verified-business bidding for optional auctions, proxy advancement, tie ordering, seller self-bid rejection, concurrent bid safety, two-minute extension, reserve met/no-sale close, exactly-once winner/order creation, ACH-only payment readiness, offer-first routed interactions, and protected contact/trust boundaries. Database, type, build, and desktop/mobile browser checks are recorded independently and only at the state actually observed.
