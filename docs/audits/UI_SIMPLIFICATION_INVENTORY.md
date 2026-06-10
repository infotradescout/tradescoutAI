# TradeScout UI Simplification Inventory P0

Date: 2026-06-10
Commit baseline: `5d48fd91` (`Publish remaining launch docs and metadata`)
Scope: inventory only. No UI simplification, navigation movement, component refactor, route deletion, or copy change is authorized by this document.

## Purpose

TradeScout needs site-wide UI simplification without losing capability or weakening law-sensitive behavior. This inventory maps the major UI surfaces before any cleanup work so future phases can simplify information architecture, component primitives, and route-level presentation without breaking:

- visibility does not equal access
- Intent -> Decision Card -> Contact
- auth-gated request creation
- anonymous draft persistence without anonymous public posting
- optional/secondary HomeID
- county containers and routing
- Trust/CVS exposure controls
- no pay-to-play or lead-selling framing
- staff/provider/admin reachability
- feature and route preservation

## Source Files Reviewed

- `client/src/App.tsx`
- `client/src/AppRoutes.tsx`
- `client/src/components/layout/AppShell.tsx`
- `client/src/components/layout/navigation.tsx`
- `client/src/config/nav.ts`
- `client/src/pages/TradeScoutLandingPage.tsx`
- `client/src/scout/index.tsx`
- `client/src/scout/ScoutOS.tsx`
- `client/src/pages/direct-connect/DirectConnectShell.tsx`
- `client/src/pages/contractor-dashboard.tsx`
- `client/src/pages/contractor-leads.tsx`
- `client/src/pages/admin-direct-connect-requests.tsx`
- `client/src/admin/adminTools.tsx`
- `docs/audits/DRIFT_GUARDS.md`

## Inventory Tags

- Audience: `public`, `requester/homeowner`, `provider`, `staff`, `admin`
- Contact-gate exposure risk: `critical`, `high`, `medium`, `low`
- Role/auth guard: `public`, `ProtectedRoute`, `ProtectedRoute adminOnly`, `ProtectedRoute requiredRoles`, `role-derived nav`, `server/API guard required`
- Law-sensitive action: any user action that can affect contact release, routing, visibility, trust exposure, county assignment, verification, or public claims.

## Surface Inventory

### Public Landing

- Route/path: `/`, `/landing`, `/landing/:variant`, `/lp`, `/lp/:variant`
- File/component path: `client/src/AppRoutes.tsx`, `client/src/pages/TradeScoutLandingPage.tsx`
- Audience: public, requester/homeowner, provider
- Primary user action: start a request or enter the onboarding/auth funnel.
- Secondary actions: ask Scout, business/provider entry, learn trust/direct-connect framing.
- Law-sensitive actions: public CTA must not imply direct contact or lead buying; authenticated users are redirected to post-landing route.
- Feature dependencies: public root landing router, `LandingAccessGate`, logo/public assets, mobile viewport rules, SEO metadata.
- Current clutter sources: multiple public entry aliases; marketing, doctrine, business, and request intent all compete for first-screen priority.
- Must-not-remove controls: logo, `Start a Request` path, business/provider entry, public-safe explanation of gated contact, authenticated redirect behavior.
- Role/auth guards: public for anonymous users; authenticated users are routed away by `RootLanding`/`LandingAccessGate`.
- Contact-gate exposure risk: high, because CTA wording can accidentally imply direct provider contact.
- HomeID relationship: none on first viewport; any HomeID mention should stay secondary/contextual.
- County/routing relationship: county campaigns and query parameters may prefill downstream request context.
- Scout relationship: Scout is a guided bridge, not a replacement for request review.
- Direct Connect relationship: landing CTA should enter Direct Connect/request creation without stale `Start Direct Connect` wording.

### Scout

- Route/path: `/scout`, legacy root query redirect `/?prompt=...`, experimental `/_scout-lite`
- File/component path: `client/src/AppRoutes.tsx`, `client/src/scout/index.tsx`, `client/src/scout/ScoutOS.tsx`
- Audience: public, requester/homeowner, provider, staff/admin when signed in
- Primary user action: describe intent and receive guided next steps.
- Secondary actions: open suggested action tiles, route to Direct Connect, review local context, learn feature paths.
- Law-sensitive actions: Scout may recommend and route but must not bypass Decision Card/contact gates, county constraints, or auth requirements.
- Feature dependencies: activity logging, local intent parsing, Scout action router, suggested actions, location context, route back-compat.
- Current clutter sources: Scout has conversation, action tiles, context cards, drawers, onboarding prompts, and work-area sheets competing in one surface.
- Must-not-remove controls: action validation, route discipline, Decision Card/gate handoffs, user freedom to skip Scout actions, safe route redirects.
- Role/auth guards: route is public/app framed; server/API guards remain required for irreversible actions.
- Contact-gate exposure risk: high, because Scout can initiate paths toward contact-sensitive actions.
- HomeID relationship: memory/context may be referenced, but HomeID must stay optional.
- County/routing relationship: Scout location authority and county defaulting must remain explicit and auditable.
- Scout relationship: canonical guided bridge.
- Direct Connect relationship: Scout can route users to request drafting but must not create/post anonymously or release contact.

### Direct Connect Shell

- Route/path: `/direct-connect`, `/direct-connect/:rest*`, `/tasks` redirect
- File/component path: `client/src/pages/direct-connect/DirectConnectShell.tsx`
- Audience: public, requester/homeowner, provider
- Primary user action: post a local request, review replies, manage provider/requester next steps.
- Secondary actions: inbox, providers/pros, my requests, notifications, HomeID attach/create prompt, route candidates.
- Law-sensitive actions: request creation, provider routing, contact approval/denial/release, candidate selection, county defaulting, Trust/CVS ordering.
- Feature dependencies: `DirectConnectRequestComposer`, `DirectConnectInbox`, `DirectConnectPros`, `MyDirectConnectRequests`, local draft storage, `/api/direct-connect/*`, `/api/business-providers/search`.
- Current clutter sources: composer, inbox, provider search, requester management, contact-gate actions, HomeID prompt, notifications, and mobile section nav all coexist in one large component.
- Must-not-remove controls: review-before-submit text, auth gate on create error path, anonymous draft persistence, contact privacy copy, contact approval/deny/release controls, county field/default, Trust/CVS/location candidate ordering, notification access.
- Role/auth guards: route itself is public; request creation and inbox data depend on auth/server guards.
- Contact-gate exposure risk: critical.
- HomeID relationship: optional memory/history layer; missing HomeID must not block request creation.
- County/routing relationship: request payload may include `countyFips`; provider search and route candidates use county and location scoring.
- Scout relationship: Direct Connect is the action path Scout routes into.
- Direct Connect relationship: canonical action path.

### Request Composer

- Route/path: `/direct-connect`, intent/entry variants under `/direct-connect/:rest*`
- File/component path: `client/src/pages/direct-connect/DirectConnectShell.tsx` (`DirectConnectRequestComposer`)
- Audience: public, requester/homeowner
- Primary user action: create a request draft and submit once authenticated.
- Secondary actions: choose intent, add location, details, photos/attachments, provider selections, HomeID link/create/skip.
- Law-sensitive actions: submit request, route request to providers, preserve anonymous draft, prevent anonymous public posting.
- Feature dependencies: localStorage draft key `ts_direct_connect_draft_v1`, attachment keys, business provider search, routing readiness evaluation, HomeID analytics.
- Current clutter sources: many fields and disclosures appear in one flow; provider candidate selection and HomeID memory prompts can feel like required setup.
- Must-not-remove controls: submit/review stage, auth error persistence, "no one is contacted until submit" language, "direct contact details until you approve" review line, HomeID skip/continue path.
- Role/auth guards: anonymous drafting allowed; creation requires authenticated API success.
- Contact-gate exposure risk: critical.
- HomeID relationship: optional and secondary; copy currently frames future ease/history.
- County/routing relationship: location/county captured and sent as routing context when available.
- Scout relationship: can receive prefill/intent from Scout.
- Direct Connect relationship: core composer.

### HomeID / HomeScout / Asset Memory

- Route/path: `/home`, `/homes`, `/homes/:rest*`, `/homescout/listings/:id`, `/homescout/:stateCode/:countyFips`, `/homescout/new`, `/homescout-listings` redirect, `/real-estate-marketplace` redirect, `/exchange/real-estate`
- File/component path: `client/src/SmartHome.tsx`, `client/src/pages/homescout-listing.tsx`, `client/src/pages/homescout-county.tsx`, `client/src/pages/direct-connect/DirectConnectShell.tsx`
- Audience: requester/homeowner, provider, public for listings where routed
- Primary user action: manage or inspect property/listing context and reuse history in requests.
- Secondary actions: create/list home context, view county listing context, attach/update HomeID from a Direct Connect request.
- Law-sensitive actions: any HomeID-derived data used in provider-facing request payloads; any listing/contact path.
- Feature dependencies: HomeID persistence helpers, HomeID packet/readiness helpers, HomeScout listing routes, Exchange real estate gate.
- Current clutter sources: HomeID, HomeScout, asset management, real estate exchange, and Direct Connect memory language overlap.
- Must-not-remove controls: optional HomeID skip, property context privacy, request creation without HomeID, listing gates where applicable.
- Role/auth guards: mixed public/protected depending route; `/homescout/new` is protected.
- Contact-gate exposure risk: medium to high depending whether a listing/request exposes private property or contact data.
- HomeID relationship: canonical memory/context layer, not required setup.
- County/routing relationship: HomeScout county routes use state/county params; Direct Connect can derive county context.
- Scout relationship: Scout may reference saved property context as memory.
- Direct Connect relationship: HomeID can enrich request details after user choice.

### Provider Board / Provider Request Surfaces

- Route/path: `/business/requests`, `/contractor-leads`, `/contractor/leads`, `/contractor/dashboard` redirect, `/business-dashboard`, `/business-owner-dashboard` redirect
- File/component path: `client/src/AppRoutes.tsx`, `client/src/pages/contractor-dashboard.tsx`, `client/src/pages/contractor-leads.tsx`, `client/src/pages/business-owner-dashboard.tsx`
- Audience: provider, business, worker
- Primary user action: review eligible work/request leads and respond through gated flows.
- Secondary actions: request contact, inspect county/trade/status, manage provider/business profile.
- Law-sensitive actions: requesting contact, viewing requester details, responding to assignments, provider exposure based on Trust/CVS.
- Feature dependencies: `/api/direct-connect/contractor/requests/*/request-contact`, provider/business role checks, assignment/readiness APIs.
- Current clutter sources: legacy contractor names remain as compatibility aliases beside broader provider/business language.
- Must-not-remove controls: request-contact button, contact state display, county/trade context, provider eligibility/status details.
- Role/auth guards: `/business/requests` protected; some legacy provider paths appear public-route-rendered but API must enforce data access.
- Contact-gate exposure risk: critical.
- HomeID relationship: should show only request-relevant context chosen by requester; no raw HomeID dump.
- County/routing relationship: provider eligibility and display are county/service-area sensitive.
- Scout relationship: provider actions may route through Scout for guidance but cannot bypass gate.
- Direct Connect relationship: responder side of Direct Connect.

### Staff Review Surfaces

- Route/path: `/admin/direct-connect-requests` via admin tools, `/admin`, `/admin/:tool*`, legacy redirects `/content-moderation`, `/support-tickets`, `/platform-analytics`, `/manage-users`, `/contractor-verification`
- File/component path: `client/src/pages/admin.tsx`, `client/src/admin/adminTools.tsx`, `client/src/pages/admin-direct-connect-requests.tsx`, `client/src/components/admin/AdminDirectConnectRequestCard.tsx`
- Audience: staff, admin
- Primary user action: inspect queues, review Direct Connect requests, monitor platform activity, operate moderation/verification.
- Secondary actions: route/review requests, inspect audit/config/state, manage users/businesses/attachments/errors.
- Law-sensitive actions: staff routing, contact release support, authority config, verification, trust/exposure diagnostics, moderation.
- Feature dependencies: admin shell/tool registry, admin role checks, authority policy/config APIs, Direct Connect request cards.
- Current clutter sources: many admin tools in one registry; legacy redirects and operational pages vary in density and naming.
- Must-not-remove controls: Direct Connect review queue, authority diagnostics, professional verification, moderation, audit logs, error reports, geo coverage, provisioning.
- Role/auth guards: `ProtectedRoute adminOnly`, `hasAdminUiAccess`, and tool-level checks.
- Contact-gate exposure risk: critical.
- HomeID relationship: staff should see only operationally necessary request context, not private HomeID history by default.
- County/routing relationship: staff routing and geo coverage must preserve county containers.
- Scout relationship: Scout resilience/admin tools exist but are operational, not user action bypasses.
- Direct Connect relationship: operational review and routing layer.

### Dashboards

- Route/path: `/dashboard`, `/my-tradescout`, `/dashboard/jobs`, `/dashboard-settings`, `/homeowner-dashboard`, `/business-dashboard`, `/hoa-dashboard`, `/realtor-dashboard`, `/helper-dashboard`, `/car-salesman-dashboard`
- File/component path: `client/src/AppRoutes.tsx`, `client/src/components/RoleDashboardRouter.tsx`, role dashboard page files under `client/src/pages/`
- Audience: requester/homeowner, provider, staff, admin, role-specific users
- Primary user action: role-aware home, recent work, settings, jobs, and account status.
- Secondary actions: profile completion, settings, jobs, requests, messages, role-specific tools.
- Law-sensitive actions: role-derived access to provider/staff/admin tools, profile/claim/verification state, contact-message shortcuts.
- Feature dependencies: `resolveDefaultHomeRoute`, `RoleDashboardRouter`, onboarding gates, profile completion banner.
- Current clutter sources: many role-specific dashboard pages and legacy aliases compete with a coherent "My TradeScout" concept.
- Must-not-remove controls: role-based redirects, admin dashboard access, request/job status, settings/profile links, onboarding completion state.
- Role/auth guards: most dashboard routes protected; admin shell protected through admin role access.
- Contact-gate exposure risk: medium, high if dashboard exposes messages/contact queues.
- HomeID relationship: requester dashboard may include saved property/memory context.
- County/routing relationship: dashboard context may display county or route to county-scoped features.
- Scout relationship: authenticated users can default to Scout or use Scout as next-step advisor.
- Direct Connect relationship: dashboard should surface requests/inbox without opening contact prematurely.

### Profile / Business / Provider Pages

- Route/path: `/profile`, `/profile/:userId`, `/u/:slug`, `/p/:slug`, `/p/:slug/edit`, `/u/:slug/edit`, `/business/:slug`, `/business/:slug/edit`, `/directory/businesses`, `/contractors`, `/contractors/:slug`, `/contractors/top`, `/commercial-directory`, `/commercial/p/:slug`, `/saved-contractors`
- File/component path: `client/src/AppRoutes.tsx`, `client/src/pages/ProfilePage.tsx`, `client/src/pages/PublicProfileView.tsx`, `client/src/pages/ProfileSiteView.tsx`, `client/src/pages/ProfileSiteEditor.tsx`, `client/src/pages/BusinessProfileView.tsx`, `client/src/pages/BusinessProfileEditor.tsx`, `client/src/pages/business-directory.tsx`, `client/src/pages/contractor-profile.tsx`, `client/src/pages/commercial-directory.tsx`
- Audience: public, requester/homeowner, provider
- Primary user action: view profiles/businesses/providers, edit owned profile, discover local businesses.
- Secondary actions: save, contact/request through gated path, claim business, view trust/profile signals.
- Law-sensitive actions: contact provider/seller/business, provider ranking/exposure, public claims and verification.
- Feature dependencies: profile routes, business/profile editors, directory APIs, trust/CVS display, claim flow.
- Current clutter sources: multiple profile URL patterns and legacy contractor naming sit beside business/provider language.
- Must-not-remove controls: edit guards, claim/verification entry, trust/CVS indicators, contact/request indirection through safe paths.
- Role/auth guards: public view routes; edit routes protected; commercial directory protected.
- Contact-gate exposure risk: high.
- HomeID relationship: generally none except provider/request history references.
- County/routing relationship: directories and provider discovery are county/service-area sensitive.
- Scout relationship: Scout may route discovery into profiles but should not authorize direct contact.
- Direct Connect relationship: profile contact should become a request/decision path, not raw contact release.

### Community Surfaces

- Route/path: `/community`, `/community-feed`, `/groups`, `/groups/:id`, `/community-builder/*`, `/foundation`, `/county-hub`, `/county-directory`, `/county/:stateCode/:countySlug`, `/city/:stateCode/:citySlug`, `/trade/:tradeSlug...`, `/best/:tradeSlug...`
- File/component path: `client/src/AppRoutes.tsx`, `client/src/shells/CommunityPageShell.tsx`, `client/src/pages/community-feed.tsx`, `client/src/pages/groups.tsx`, `client/src/pages/group-detail.tsx`, `client/src/pages/community-builder/*`, SEO/county/trade page files
- Audience: public, requester/homeowner, provider, community builder
- Primary user action: read local activity, post/update where permitted, browse county/trade context.
- Secondary actions: join groups, contribute, view local rankings/context, ask Scout.
- Law-sensitive actions: global read-only versus local action, county-scoped posting, moderation, contact/message attempts.
- Feature dependencies: community shell, county/trade SEO routes, community builder, moderation.
- Current clutter sources: community, groups, county hubs, trade SEO, foundation/community builder surfaces overlap as local context products.
- Must-not-remove controls: global read-only restriction, local action gates, moderation/reporting, county context.
- Role/auth guards: mixed public/protected; local write actions must be server guarded.
- Contact-gate exposure risk: medium, high for reply/contact affordances.
- HomeID relationship: indirect through local property/project context.
- County/routing relationship: core county container surface.
- Scout relationship: Scout can summarize and route but global actions remain blocked.
- Direct Connect relationship: posts may prefill Direct Connect requests, preserving review/auth/contact gates.

### Exchange / Marketplace Surfaces

- Route/path: `/exchange`, `/exchange/:category`, `/exchange/listing/:id`, `/exchange/seller`, `/marketplace` redirect, `/marketplace/new`, `/marketplace-listing`, `/trade-deals`, `/daily-deals`, `/vehicle-marketplace`, `/worker-marketplace`
- File/component path: `client/src/AppRoutes.tsx`, `client/src/pages/exchange.tsx`, `client/src/pages/exchange/*`, `client/src/pages/marketplace-listing.tsx`, `client/src/pages/trade-deals-lucky.tsx`
- Audience: public, requester/homeowner, provider, seller
- Primary user action: browse/list items or offers, inspect listing detail, manage seller listings.
- Secondary actions: contact seller, save listing, purchase/profile offer where applicable.
- Law-sensitive actions: seller contact, marketplace conversations, paid/boost-like visibility, profile purchase paths.
- Feature dependencies: Exchange category pages, seller dashboard, progressive feature gate, marketplace listing creation.
- Current clutter sources: Exchange, marketplace, TradeDeals, daily deals, vehicles, worker marketplace and real-estate aliases all overlap.
- Must-not-remove controls: seller contact gate/conversation guard, listing creation guard, saved listing controls, category filters.
- Role/auth guards: `/marketplace/new` protected; Exchange can be progressive-gated.
- Contact-gate exposure risk: high, especially listing contact dialogs.
- HomeID relationship: real-estate exchange overlaps with HomeScout but should remain separate from HomeID memory.
- County/routing relationship: scope filters may include local/state/national; local actions must respect county/context.
- Scout relationship: Scout may route to listings but should not expose private seller/requester contact.
- Direct Connect relationship: item/service interest can convert to request path where appropriate.

### Auth / Onboarding / Verification

- Route/path: `/login`, `/register`, `/signup`, `/create-account`, `/pre-scout-setup`, `/onboarding`, `/onboarding/intent`, `/onboarding/profile`, `/profile-setup` redirect, `/claim-my-business`, `/address-verification`, `/verify-email`, `/check-email`, `/reset-password`, `/verification`, `/identity-verification`, `/insurance-verification`, `/license-verification`, `/background-check`, `/compliance`
- File/component path: `client/src/AppRoutes.tsx`, auth/onboarding page files under `client/src/pages/`
- Audience: public, requester/homeowner, provider, staff/admin by role
- Primary user action: sign in/up, claim/setup account, complete profile basics, verification.
- Secondary actions: address verification, email verification, business/provider lane selection, password reset.
- Law-sensitive actions: claim-first signup, adaptive/contextual verification, role assignment, verification state used by trust/exposure.
- Feature dependencies: onboarding gate, `postOnboardingRoute`, profile version, auth hooks, role checks.
- Current clutter sources: legacy aliases, multiple setup routes, business/provider lanes, profile completion prompts and auth mode params.
- Must-not-remove controls: safe `next` handling, onboarding exempt paths, claim flow, verification prompts, address/email verification.
- Role/auth guards: mixed public and protected; onboarding/profile routes protected.
- Contact-gate exposure risk: medium because verification affects exposure and contact eligibility.
- HomeID relationship: HomeID should not become required during signup.
- County/routing relationship: county query params can prefill launch/direct-connect path.
- Scout relationship: pre-Scout setup can route into Scout after profile basics.
- Direct Connect relationship: auth return path must preserve Direct Connect draft/next.

### Mobile Navigation

- Route/path: global app shell on mobile except auth/setup/admin surfaces
- File/component path: `client/src/components/layout/AppShell.tsx`, `client/src/components/navigation/MobileAppBar`, legacy `client/src/components/layout/navigation.tsx`
- Audience: public, requester/homeowner, provider, staff/admin where allowed
- Primary user action: reach Direct Connect, Inbox, Community, Scout, and account/tools.
- Secondary actions: unlockable features, install, profile/settings, admin controls when allowed.
- Law-sensitive actions: mobile nav must not hide staff/admin tools for eligible roles; must not create a direct contact shortcut.
- Feature dependencies: `useIsMobile`, `VITE_MOBILE_SIMPLIFICATION_V1`, `VITE_UI_MINIMAL_V1`, feature unlocks, role checks, contact request count.
- Current clutter sources: AppShell has current mobile flow nav and simplified nav, while legacy navigation component still defines a separate public/auth menu.
- Must-not-remove controls: Direct Connect, Inbox/contact request count, Scout, Community, account/tools, admin access for admin roles.
- Role/auth guards: role-derived nav; admin surfaces are hidden from non-admins.
- Contact-gate exposure risk: high if Inbox/messages shortcuts are mistaken for unlocked contact.
- HomeID relationship: Asset Management appears as unlockable; should not be elevated as required setup.
- County/routing relationship: nav itself none, but routes behind it may be county-gated.
- Scout relationship: one of four mobile primary destinations.
- Direct Connect relationship: primary mobile destination.

### Desktop Navigation

- Route/path: global app shell on desktop except auth/setup/admin surfaces
- File/component path: `client/src/components/layout/AppShell.tsx`, legacy `client/src/components/layout/navigation.tsx`, `client/src/config/nav.ts`
- Audience: public, requester/homeowner, provider, staff/admin
- Primary user action: move between Scout, Direct Connect, Commercial, Community, Share, account/tools, admin.
- Secondary actions: advanced/unlockable features, notifications, messages, install, settings.
- Law-sensitive actions: role-aware admin access, messages/contact request count, progressive exposure gates.
- Feature dependencies: feature nav builders, `RightToolsPanel`, notification center, progressive feature unlocks, role checks.
- Current clutter sources: multiple nav definitions exist (`AppShell`, legacy `Navigation`, `NAV_SECTIONS` for Scout), and labels differ across surfaces.
- Must-not-remove controls: Direct Connect, Scout, messages/contact request count, notifications, admin controls for admin roles, profile/tools.
- Role/auth guards: role-derived nav and admin checks.
- Contact-gate exposure risk: medium to high.
- HomeID relationship: Asset Management/unlockable feature only.
- County/routing relationship: none at nav layer.
- Scout relationship: top-level nav.
- Direct Connect relationship: top-level nav and orientation action.

## Route Alias / Compatibility Notes

These routes are part of the simplification risk because they preserve old links and user muscle memory:

- `/tasks` -> `/direct-connect`
- `/marketplace` -> `/exchange`
- `/homescout-listings` -> `/exchange/real-estate`
- `/real-estate-marketplace` -> `/exchange/real-estate`
- `/contractor/dashboard` -> `/business-dashboard`
- `/contractor-profile` -> `/contractors`
- `/contractors/signup`, `/contractor-join`, `/contractors/accelerator` -> `/businesses/apply`
- `/business-owner-dashboard` -> `/business-dashboard`
- `/profile-setup` -> `/onboarding/profile`
- `/auth/login` -> `/login`
- `/auth/signup` -> `/create-account`
- legacy admin routes redirect into `/admin/*`

Future simplification must not delete these without a separate route preservation decision and migration notes.

## Launch-Risk Summary

### Critical

- Direct Connect request composer and submit flow.
- Direct Connect requester request cards and contact approval/deny/release controls.
- Provider board/request-contact flow.
- Staff/admin Direct Connect review and routing surfaces.
- Any provider-facing payload or card that could leak requester contact or raw HomeID/private property details.

### High

- Public landing CTA and hero copy.
- Scout action routing into Direct Connect/contact-sensitive paths.
- Mobile bottom nav and Inbox/messages shortcuts.
- Profile/business/provider contact affordances.
- Exchange listing contact dialogs.
- HomeID prompt placement inside request creation.

### Medium

- Dashboards that aggregate requests, messages, jobs, and role-specific tools.
- Auth/onboarding `next` handling and claim/verification flows.
- Community local action/global read-only distinctions.
- County/trade SEO pages that route into provider discovery or Direct Connect.
- Desktop navigation and RightToolsPanel consolidation.

### Low

- Static legal/help/about/compare pages, as long as copy remains TradeScout-only and does not imply pay-to-play or lead selling.
- Pure read-only SEO/dataset pages with no contact or posting action.
- Install/offline/static metadata surfaces.

## Proposed Implementation Order

Do not implement in P0. Recommended sequence for future slices:

1. Preserve route/access map and add route smoke checks for critical surfaces.
2. Normalize law-sensitive copy in one shared contact-gate presentation.
3. Simplify landing only after CTA/copy guard tests are in place.
4. Simplify Direct Connect composer by grouping existing fields, not deleting them.
5. Normalize HomeID as optional context across Direct Connect and dashboard surfaces.
6. Clean provider board density while preserving request-contact and eligibility status.
7. Clean staff/admin Direct Connect review density while preserving queues/actions.
8. Consolidate desktop/mobile nav labels after role reachability checks exist.
9. Address profile/business/provider route naming and alias discoverability.
10. Address community/exchange/dashboard secondary surfaces.

## Future Verification Matrix

| Surface | Verification Needed | Law Checks |
| --- | --- | --- |
| Public landing | desktop/mobile screenshot, CTA text scan, logo present | no stale direct-contact CTA, `Start a Request` path preserved |
| Scout | route loads, action tiles route safely, legacy query redirect | Scout does not create contact or bypass Decision Card |
| Direct Connect composer | anonymous draft, auth return, authenticated submit, missing HomeID submit | anonymous public posting disabled, HomeID optional |
| Direct Connect requester cards | contact states and mobile actions visible | approve/deny/release only in allowed states |
| Provider board | eligible requests readable, request-contact action visible | no requester contact before approval |
| Staff/admin review | review queue readable, routing/contact state visible | staff action path preserves contact gate and county routing |
| HomeID/HomeScout | HomeID skip path, property context privacy | no required HomeID setup for request creation |
| Profiles/business/provider | public view, edit guard, contact CTA route | contact/request path remains gated |
| Community | global read-only and local write checks | global action blocked, county context preserved |
| Exchange | listing detail and seller/contact flow | seller/requester contact not leaked prematurely |
| Auth/onboarding | next param, claim flow, verification prompts | claim-first and adaptive verification preserved |
| Mobile nav | bottom nav, tools drawer, admin reachability by role | no hidden staff/admin access for eligible roles |
| Desktop nav | primary nav, messages, notifications, admin icon | no direct contact shortcut |

## Acceptance Status

- UI simplification inventory exists: complete.
- Major public/auth/provider/staff/admin surfaces mapped: complete at surface-group level.
- Law-sensitive controls identified: complete.
- Functional UI code changed: no.
