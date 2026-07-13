# JW Stone Express Direct Connect implementation evidence

Date: 2026-07-13
Scope: `/u/jw-stone` and the TradePartner-profile Direct Connect CTA.
Product Spine Gate: PASS for this slice. The surface serves a person who already selected a business and supports the concrete jobs “call this business” and “send this business a private request.” It routes into the core Direct Connect request lifecycle without creating a lead marketplace.

## Authoritative route and audience rule

| Route or surface | Audience and permitted roles | Direct Connect behavior |
| --- | --- | --- |
| `/u/jw-stone` TradePartner profile | Public; anonymous or authenticated | Always Express Direct Connect to JW Stone. Authentication does not change the path. |
| Express choice panel on the profile | Public; anonymous or authenticated | Call reveals the number after the explicit Call choice. Request opens the phone-required form. |
| `/direct-connect` portal | TradeScout members and its existing onboarding gates | Retains the full canonical Direct Connect discovery/request path. |
| Managed business inbox | JW Stone profile owner/manager only | Receives the private assignment and notification. |

## Normalized evidence model

| File and symbol | Route or surface | Audience and permitted roles | Canonical product object represented | User job supported | Current behavior | Competing or duplicate implementation | Direct Connect capability involved | Visual or terminology divergence | Severity | Evidence and confidence | Proposed disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `client/src/pages/ProfileSiteView.tsx` — `useExpressDirectConnect` | `/u/:slug` TradePartner branch | Public; all auth states | Business profile + targeted connection intent | Contact the business currently being viewed | TradePartner profile CTAs always choose Express; no referrer or login branching | Canonical portal CTA parameters remain as a compatibility fallback | Initiate, call, request | “Express Direct Connect” now distinguishes target-specific contact from the portal | blocker | Direct render branch and contract test; high | keep |
| `client/src/pages/profile-sites/WholesalerProfileTheme.tsx` — `startDirectConnect` | JW Stone branded profile CTAs | Public; all auth states | Targeted connection intent | Start from hero, inventory stone, audience card, or final CTA | Every CTA opens the same express panel and preserves selected-stone context | Former link wrappers routed anonymous users to pre-Scout setup before contact choice | Initiate | Previously identical “Direct Connect” labels produced different redirects by auth state | blocker | Five CTA call sites covered; high | consolidate |
| `client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx` | Profile overlay | Public; all auth states | Contact decision + request draft | Call now or send one private request | Call requires no account; form requires name, email, phone, type, details; logged-out success promotes membership | `DirectConnectShell` remains the portal implementation and is not duplicated here | Initiate, call, request, onboard | Target-specific language and phone-friction explanation are explicit | drift | UI source, build, theme audit, contracts; high | keep |
| `server/routes/tradepartner-express.ts` — reveal route | `POST /api/tradepartner-profiles/:slug/express-contact/reveal` | Public; all auth states; rate limited | Contact decision | Reveal and dial the selected business | Returns phone only for a published, active, discoverable TradePartner after the Call decision | Public JSON-LD formerly exposed the number without a decision | Call | None after SEO leak removal | blocker | Route schema and SEO negative contract; high | migrate |
| `server/routes/tradepartner-express.ts` — request route | `POST /api/tradepartner-profiles/:slug/express-request` | Public; all auth states; rate limited | Request + assignment + requester account | Send details directly to the selected business | Valid phone entry is the friction gate; no SMS/OTP; creates/attaches requester, private request, one owner assignment, notification, and onboarding email attempt | Full portal request composer remains canonical for portal-originated work | Request, receive, lifecycle start, notify, onboard | “Phone required” replaces stronger verification claims | blocker | Zod schema, transaction, five contract tests; high | keep |
| `server/publicProfileHtml.ts` — `buildJsonLd` | SSR/SEO for `/u/jw-stone` | Crawlers and public visitors | Business profile | Discover JW Stone without exposing contact data | Website/location remain eligible for markup; phone is absent | Prior TradePartner JSON-LD emitted `telephone` | Trust/contact gate | Structured markup previously contradicted visible contact protection | blocker | Negative contract and repository diff; high | delete |
| `server/repositories/businessRepository.ts` — `getBusinessPublicById` | Public profile data assembly | Public profile consumers | Public business subset | Render business identity safely | Internal `contactPhone` remains available to authorized server consumers; no extra public SEO `phone` field is created | `contactPhone` is filtered by `/api/u/:slug` safe subset | Trust/contact gate | No user-facing divergence | cleanup | Route sanitization and type check; high | keep |

## Canonical object mapping

| Product concept | Canonical representation in this slice |
| --- | --- |
| Business profile | Published `profiles` row linked to an active `businesses` row and discoverable owner |
| Connection intent | Profile CTA plus explicit Call or Request decision |
| Request | One private, personal `workRequests` record with `source=direct_connect` |
| Employment relationship | Not represented or mutated by this flow |
| Assignment | One `workRequestAssignments` row addressed only to the selected profile owner |
| Conversation/response | Continues through the existing Direct Connect lifecycle after the owner accepts/responds |
| Requester account | Authenticated member, matching existing account, or new provisional homeowner account |
| Notification | Canonical notification to the managed business owner after request commit |
| Trust state | Published/active TradePartner plus discoverable verified owner; phone entry is friction, not asserted verification |

## Manual flow proofs

1. Anonymous visitor opens `/u/jw-stone`, selects any Direct Connect CTA, and sees Call or Send a request without being redirected to registration.
2. Call returns the number only after the explicit Call choice, launches the device dialer, and then offers free TradeScout membership to save/continue discovery.
3. Request cannot submit without a syntactically complete phone number. No SMS or OTP is sent or claimed.
4. A logged-out request creates or matches a requester account, creates one private request, assigns only the JW Stone manager, and attempts account-access onboarding by email.
5. An authenticated visitor uses the same Express UI; the request attaches to the current session and does not create another account.
6. The `/direct-connect` portal is unchanged and continues to own the full discovery path.

## Validation and remaining live evidence gap

- TypeScript check: PASS.
- Production build: PASS.
- New Express contract tests: 5/5 PASS.
- Existing public-profile contracts: 21/21 PASS.
- Theme, trust-leak, authority-gate, and HTTP-semantics audits: PASS.
- Local browser screenshots: blocked by the validation environment's unavailable Chromium download, not by application code. A deployed `/u/jw-stone` fresh-page desktop/mobile proof and real phone/request delivery smoke remain required before production approval.

`DirectConnectShell_Reset.tsx` and any reset report are historical evidence only. This implementation does not restore or adopt them; it preserves the current portal path and adds a narrowly targeted profile-origin flow.
