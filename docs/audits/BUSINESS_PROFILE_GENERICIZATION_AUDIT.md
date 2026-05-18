# Business Profile Genericization Audit

Date: 2026-05-14
Owner: TradeScout product/engineering
Scope: Business profiles, business tools, fixed-price offers, and legacy contractor surfaces.

## Law Integrity

| Statement | Classification | Notes |
| --- | --- | --- |
| Business profiles are for any local business that sells services, products, or expertise; contractor-specific language is allowed only where the surface is explicitly trade/contractor SEO or legacy compatibility. | policy_target | The first genericized surfaces are `/for-businesses`, `/business-owner-dashboard`, `/profile-setup`, and `/offer-services`. |
| Business discovery never grants contact access. Contact still flows through Intent -> Decision Card -> Contact, Direct Connect, or purchase-scoped order updates. | enforced | Generic business copy must preserve gated contact and Trust/CVS language. |
| TradeScout business tools must support manual operation as well as Scout-assisted automation. | policy_target | Finance records, fixed-price offers, profile purchase review, business profile editing, and Direct Connect remain separate user-review surfaces. |
| Legacy contractor route/table names are compatibility details, not product language for new business surfaces. | temporary_exception | Owner: engineering. Rationale: renaming storage/API contracts requires migration and redirect planning. Removal date: 2026-08-31. |

## Generic Business Model

| Layer | Generic target | Current bridge |
| --- | --- | --- |
| Business profile | Any business page with services, products, proof, county coverage, SEO, CTAs, and Trust/CVS context. | `business_profile`, public profile routes, business listing/editor surfaces. |
| Offers | Fixed-price service or item offers purchasable from profiles and discoverable through Exchange/SEO. | `profile_offers`, profile purchase flow, order status, seller review queue. |
| Work and orders | A service purchase creates a work request; an item purchase creates receipt/fulfillment review. | Profile purchases create work/receipt/accounting review without releasing contact or moving money automatically. |
| Books | QuickBooks-style manual records plus automation proposals from Direct Connect, estimates, material lists, and profile purchases. | `/finances/records`, accounting foundation, automation inbox, flat $1 platform fee metadata. |
| Scout | Guided bridge from discovery to business action. | Scout action cards route to business profile, offers, Direct Connect, Exchange, finance, HomeScout, and Community Vault. |

## First Genericization Pass

- Business acquisition copy now talks about local businesses, products, services, fixed-price offers, gated requests, and county growth instead of centering contractors.
- Generic `/businesses/apply` and `/business-dashboard` aliases now sit in front of legacy compatibility routes.
- Business search queries now include generic local business/profile demand phrases, while trade-specific SEO phrases stay in trade directories where they belong.
- Profile setup now presents the provider role as "Business" in user-facing copy while preserving the legacy `contractor_user` role value for compatibility.
- The business owner dashboard now routes to business directory, Direct Connect, business profile setup, fixed-price offers, books/records, estimates/materials, and analytics.
- The seller launch hub now describes customers, requests, credentials, offers, purchases, receipts, and bookkeeping in generic business language.
- Primary navigation, provider navigation, navigation preferences, and admin tool labels now use business/provider language while retaining legacy route/tab IDs as compatibility handles.
- Help, guest gates, role selection, older onboarding, and tour copy now teach local business/provider flows instead of contractor-only flows.
- Generic SEO defaults, footer platform links, and legal/privacy copy now use business/provider language outside explicit trade-directory SEO.
- Legacy route/API/table migration is captured in `docs/audits/LEGACY_CONTRACTOR_NAMING_MIGRATION_PLAN.md`.
- Generic business-provider API aliases are now preferred for provider search and Direct Connect targeting: `/api/business-providers/search`, `/api/business-providers/top`, and `targetProviderIds` are wired while legacy provider/contractor aliases remain compatibility handles.
- Business-provider role/capability helpers now let server gates and navigation check for business-provider tool access instead of only checking the legacy `contractor_user` role string.

## Next Work

1. Add route-level canonical preference tests for `/businesses/apply`, `/business-dashboard`, and future `/business/requests`.
2. Add generic admin/provider route aliases for business requests and settings while keeping legacy contractor URLs as redirects.
3. Replace remaining user-facing contractor-only dashboard labels in legacy business-tool surfaces with generic business/provider language.
