# Build Contract: bidrock-marketplace-recovery

Status: active correction Worker slice; release blocked pending reconciliation
Base revision: `5e6c44a49fcb0eae0cf720fadd898c477d8d8293`
Branch: `jw-stone/bidrock-marketplace-recovery`
Lock binding: Thomas's approved BidRock recovery checkpoint supplied on 2026-08-20

## Authorized semantic history

- The 2026-08-20 recovery checkpoint authorizes the business-only BidRock marketplace, shared profile-native identity, confirmed-stock projection, private verified-business pricing, seller controls, ACH-only commerce lifecycle, and routed client workspace described below.
- The owner-authoritative confirmed-stock statement records Gold Macaubas as 6 slabs with 2 polished slabs. That current statement supersedes the older 1.5-polished filename evidence without changing the broader photo catalog or erasing its provenance.
- The product-owner `REPLACE` amendment approved at `2026-08-20T19:23:32Z` removes the prior BidRock revenue decision. BidRock adds no marketplace fee. Canonical transaction and procurement records must carry zero in every fee field, while the data model remains open to a separately authorized future revenue model.

## Outcome

Build BidRock as a business-only stone marketplace Powered by TradeScout and seed it from JW Stone's seven confirmed physical-stock lots without relabeling the broader JW photo catalog as current or sale-ready.

## Included behavior

- One profile-native TradeScout business identity works across JW Stone and BidRock. There is no role picker, second password, or required general TradeScout onboarding before profile account creation.
- JW Stone's broader named/photo catalog remains a Material Library and source-evidence system.
- The seven owner-confirmed lots are deterministically and idempotently projected into Stone Core with exact dimensions and quantities. Projection never requires JW to retype them.
- Confirmed physical stock enters seller inventory as not published. Buyer exposure requires an explicit seller/admin sale-ready transition and a still-current physical position.
- Public and unverified callers receive no price value. Verified linked businesses may receive the seller's private per-slab or per-square-foot price.
- Inventory, publication, and price mutations require holder-business ownership, an administrator, or the exact durable delegation scope; profile ownership alone grants no Stone/BidRock write authority. Non-admin seller commerce also requires an active verified BidRock entitlement.
- The routed `/bidrock` client workspace supports compact browse/search/filter, compare, detail, saved selections, seller controls, and truthful transaction state.
- The commerce contract covers inquiry, offer/counteroffer, reservation, order, ACH readiness, custody/freight/fabrication, installation/HomeID handoff, cancellation, and completion. External payment-provider actions remain inactive until separately authorized and configured.
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
- No push, PR, merge, deployment, production database mutation, production payment activation, or GitHub Actions workflow is authorized by this build.

## Canonical reuse decisions

| Responsibility | Disposition | Canonical owner |
| --- | --- | --- |
| Shared business identity | Extend | `shared/profileAccount.ts`, `server/services/profileAccountService.ts`, profile-account routes/components |
| Stone truth and freshness | Extend | `server/services/stoneCoreProvisioning.ts`, Stone Core tables |
| Confirmed JW stock fixture/import | Create bounded owner | `shared/stoneInventory.ts`, `server/services/jwStoneConfirmedStock.ts` |
| Stone inventory API | Create bounded route/service | profile-scoped Stone Core inventory route/service |
| BidRock domain and state | Reconcile/extend | foundation `shared/bidrock.ts` and `server/services/bidrockService.ts` |
| BidRock UI | Create routed feature composition | canonical React route plus existing UI primitives |
| Payments/accounting | Reuse canonical records | `marketplace_transactions`, `procurement_orders`, and accounting authorities; `server/payment-service.ts` remains unchanged |

## Acceptance evidence

Focused domain/service/route/component tests must prove exact seven-lot values, idempotent identities, draft-before-sale-ready behavior, price redaction, seller ownership, one shared account, ACH-only payment readiness, routed workspace interactions, and protected contact/trust boundaries. Type/build/browser checks are recorded independently and only at the state actually observed.
