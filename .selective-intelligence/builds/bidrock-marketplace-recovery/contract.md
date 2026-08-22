# Build Contract: bidrock-marketplace-recovery

Status: auction realignment reconciled; isolated database and temporary desktop-preview proof passed; native mobile live-viewport proof provisional
Base revision: `5e6c44a49fcb0eae0cf720fadd898c477d8d8293`
Branch: `jw-stone/bidrock-marketplace-recovery`
Lock binding: Thomas's approved BidRock recovery checkpoint supplied on 2026-08-20 plus the auction-first replacement checkpoint approved on 2026-08-21

## Authorized semantic history

- The 2026-08-20 recovery checkpoint authorizes the business-only BidRock marketplace, shared profile-native identity, confirmed-stock projection, private verified-business pricing, seller controls, ACH-only commerce lifecycle, and routed client workspace described below.
- The owner-authoritative confirmed-stock statement records Gold Macaubas as 6 slabs with 2 polished slabs. That current statement supersedes the older 1.5-polished filename evidence without changing the broader photo catalog or erasing its provenance.
- The product-owner `REPLACE` amendment approved at `2026-08-20T19:23:32Z` removes the prior BidRock revenue decision. BidRock adds no marketplace fee. Canonical transaction and procurement records must carry zero in every fee field, while the data model remains open to a separately authorized future revenue model.
- The product-owner `REFRAME` amendment approved on 2026-08-21 rejects the inventory-workspace and negotiated-offer model as BidRock's primary buyer experience. BidRock is an auction-first marketplace: independent timed stone lots, verified-business max/proxy bidding, reserve outcomes, truthful bid activity, a two-minute soft close, and winner-to-order conversion. Browse, save, filter, and compare remain supporting capabilities.

## Outcome

Build BidRock as a business-only timed stone auction Powered by TradeScout and seed the isolated temporary proof from JW Stone's seven confirmed physical-stock lots without relabeling the broader JW photo catalog as current or sale-ready.

## Included behavior

- One profile-native TradeScout business identity works across JW Stone and BidRock. There is no role picker, second password, or required general TradeScout onboarding before profile account creation.
- JW Stone's broader named/photo catalog remains a Material Library and source-evidence system.
- The seven owner-confirmed lots are deterministically and idempotently projected into Stone Core with exact dimensions and quantities. Projection never requires JW to retype them.
- Confirmed physical stock enters seller inventory as not published. Buyer exposure requires an explicit seller/admin sale-ready transition and a still-current physical position.
- Public and unverified callers receive no price value. Verified linked businesses may receive the seller's private per-slab or per-square-foot price.
- Inventory, publication, and price mutations require holder-business ownership, an administrator, or the exact durable delegation scope; profile ownership alone grants no Stone/BidRock write authority. Non-admin seller commerce also requires an active verified BidRock entitlement.
- Each sale-ready lot can have one independent timed auction with an opening bid, optional reserve, minimum increment, start/end time, two-minute soft-close window, pickup/freight terms, and an explicit scheduled/live/ended/no-sale/sold outcome.
- Verified businesses may submit a private maximum bid. Database-clock, row-locked proxy bidding exposes only the amount needed to lead, resolves equal maximums in favor of the earlier valid maximum, prevents seller self-bidding, and never creates fabricated bidders or activity.
- Public and unverified viewers may see lot facts, time remaining, bid count, and non-price auction state but no dollar value. Verified businesses may see the current bid and minimum next bid. Private bidder maximums remain visible only to their owner and authorized administrators.
- Bids inside the final two minutes extend the auction end by two minutes. A successful close creates exactly one winner, reservation, allocation, and ACH-only order when the reserve is met. An unmet reserve closes as no sale and can be explicitly relisted.
- The routed `/bidrock` client is an auction house, not an inventory dashboard: live and closing-soon lots, large truthful imagery, lot number, slab facts, countdown, bid activity, reserve state, fulfillment terms, and a dominant Place bid action. Search, filters, saved lots, compare, seller controls, and order state remain supporting tools.
- The commerce contract retains reservation, order, ACH readiness, custody/freight/fabrication, installation/HomeID handoff, cancellation, and completion. Negotiated offer/counteroffer and fixed-price/Buy It Now are outside this auction proof. External payment-provider actions remain inactive until separately authorized and configured.
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
- The 2026-08-21 approval authorizes local implementation, an isolated temporary database migration/seed, push to `jw-stone/bidrock-marketplace-recovery`, redeployment of the existing temporary preview, and browser proof there. It does not authorize a PR, merge, production deployment, production database mutation, production payment activation, or GitHub Actions workflow.

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

Focused domain/service/route/component tests must prove exact seven-lot values, idempotent identities, draft-before-sale-ready behavior, guest dollar redaction, verified-business bidding, proxy advancement, tie ordering, seller self-bid rejection, concurrent bid safety, two-minute extension, reserve met/no-sale close, exactly-once winner/order creation, ACH-only payment readiness, auction-first routed interactions, and protected contact/trust boundaries. Database, type, build, desktop/mobile browser, and temporary deployment checks are recorded independently and only at the state actually observed.
