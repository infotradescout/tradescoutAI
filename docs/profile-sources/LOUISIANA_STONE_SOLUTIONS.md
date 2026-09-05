# Louisiana Stone Solutions profile source boundary

Prepared: 2026-09-05T02:56:59Z. Source reviewed in the active September 4, 2026 task; business statements are not independently verified credentials.

Sources are the user-supplied private Messenger conversation, interpreted through the active task's source packet, and the business's first-party Facebook page. The coordinating task verified the Facebook identity, location, public business email, logo, and cover photo in a logged-in live browser during the same task. The private screenshot, participant identities, and direct contact details are not copied into this repository or public content.

- [Official Louisiana Stone Solutions Facebook page](https://www.facebook.com/profile.php?id=100091128907591): matches the supplied business name and logo; identifies Baton Rouge, LA 70810 and a public business email.
- [Company-published countertop kitchen cover photo](https://www.facebook.com/photo/?fbid=866756699705286&set=a.104568599257437): gray countertop kitchen imagery. Publication by the business is confirmed; completion or installation by the business is not established.

| Field | Evidence class | Profile treatment |
|---|---|---|
| Louisiana Stone Solutions | Confirmed from supplied business messages and matching first-party page | Plain business display name; no personal identity or ownership claim |
| Baton Rouge, Louisiana 70810 | Business base confirmed in messages; ZIP resolved by first-party page | Location label; ZIP is now known, with no street address or invented premises |
| New Orleans and surrounding areas | Confirmed service coverage | Named service area plus the source's bounded surrounding-area wording; no parish list or mileage radius |
| Countertops | Confirmed specialty | Leads the headline, introduction, and service list |
| Tile, Sheetrock/drywall, paint, cabinets, remodeling | Confirmed services | Six concise services in total, with Sheetrock/drywall kept as one service |
| Black business text and yellow fleur-de-lis on white | Confirmed by supplied source and first-party profile logo | White, black, and yellow presentation palette; exact hex values are created design choices |
| Public business email | Resolved by first-party page | Retained privately by the coordinating task; omitted from public copy and CTA values |
| Original logo and countertop kitchen cover photo | Resolved by first-party page | Stored at immutable TradeScout upload URLs and integrated into the draft; no completed-project claim |
| Slug, headings, descriptions, request prompts, SEO | Created | Original copy assembled from the confirmed facts; saved slug `louisiana-stone-solutions` |

No source confirms fabrication or installation specialties, stone/material species, pricing, discounts, warranties, credentials, insurance, hours, street address, years in business, ownership, reviews, or completed-project attribution. Those claims and fields are omitted. The business base is not used to invent additional service-area boundaries.

The supplier-side conversation about JW Stone, slabs or containers, a Pensacola–Dallas corridor, samples or price lists, a mini-showroom, and a kitchen/bath target describes supplier context or a tentative relationship. None becomes a Louisiana Stone Solutions offering, affiliation, footprint, inventory claim, or market specialization.

The original logo and cover are connected through stable hosted assets. The kitchen image is used in the hero and a company-imagery gallery, with neutral alt text and SEO imagery. The cover is described as company-published countertop kitchen imagery, with no claim that the business completed the work. A completed-project claim still requires completion attribution. A private conversation screenshot is not a public business asset.

The confirmed business mailbox is stored in the business's existing email and notification-email fields after the operator selected business-handled requests. Direct contact remains disabled on the public presentation, and no phone is invented. This content module does not read, write, publish, or duplicate contact values. There are no phone numbers, email addresses, contact links, personal names, or credential assertions in the public payload.

The module reuses `LocalServiceProfilePresentation` from `shared/localServiceProfile.ts` and the existing native `profileSections`, `hero`, `about`, `services`, `gallery`, and `localServiceProfile` blocks. About and service blocks derive from the same presentation values. No credentials or verification assertions are supplied. The renderer must omit unsupported verification and empty credential controls.

`LOUISIANA_STONE_SOLUTIONS_PROFILE_DRAFT_PAYLOAD` matches the content fields of the existing authenticated `POST /api/profiles` contract. That endpoint supplies ownership and creates a draft. `setActive` is false; owner/business binding, slug collision checks, publication, provisioning, verification, and account creation remain outside this module. An empty CTA configuration leaves requests with the existing TradeScout request path; it does not create direct contact access. Integration must retain existing contact gating and county routing; this module changes neither implementation.

Recheck the facts when the business supplies corrections or authoritative public materials, and before any future publication that changes offerings, coverage, identity, contacts, or assets. Local content validity is not proof of a saved, published, deployed, or live profile.

## Saved draft checkpoint

On September 4, 2026 (America/Chicago), the operator-created intake was advanced from `profile_build` to `routing_review` after a full transaction rollback rehearsal and one committed creation. The same transaction stores the original images, creates a credentialless internal profile steward, creates the unclaimed business, and saves the profile as `draft`. It preserves existing source URLs and refuses to overwrite existing records or conflicting media. No login credentials, owner claim, verification, discovery exposure, notifications, or request delivery were enabled.

- Intake: `8f64032b-5976-4e8a-8b45-0a812a99c558`.
- Business: `3274f35c-4185-4d1e-b56f-83b9bb31a135`.
- Profile: `c3b6e578-4435-4b5e-861c-d76956af6439`.
- [Admin draft preview](https://www.thetradescout.com/u/louisiana-stone-solutions).
- [Native editor](https://www.thetradescout.com/u/louisiana-stone-solutions/edit).
- Business/profile ownership matches the same internal steward; business discovery is disabled and contact routing remains pending.

At `2026-09-05T03:19:26Z`, anonymous `GET /api/u/louisiana-stone-solutions` returned 404 with `private, no-store`; the authenticated administrator could view the saved draft and open its protected request form. No form was submitted and no business message was sent. This proves request entry only, not delivery or acceptance. The draft account widget currently reports `Profile not found` because its public endpoint requires a published profile.

Both original images returned HTTP 200 with `image/jpeg`, immutable caching, and byte-for-byte SHA-256 matches:

| Asset | TradeScout URL | Bytes | SHA-256 |
|---|---|---:|---|
| Kitchen cover | `/uploads/business-profiles/louisiana-stone-solutions/kitchen-a8af176a1642.jpg` | 121062 | `a8af176a1642d48eb1470ba1017058a2522f08d3844f86a95b9ecd8ffdc0244c` |
| Logo | `/uploads/business-profiles/louisiana-stone-solutions/logo-ba7034eb0e0d.jpg` | 5043 | `ba7034eb0e0dffb9cf5ca3f58d0e559ec10705fb7be33bc8898f4e8e7e5d1e35` |

The live Render environment uses the existing Postgres public-media provider. No service, environment, deployment, or main-branch changes were made to save the draft. Creation and HTTP receipts are retained locally under `artifacts/profile-sources/louisiana-stone-solutions/`.

## Template findings before publication

Authenticated live review exposed a shared-renderer defect: hardcoded `Recent work` and verification copy ignored this profile's neutral gallery title and unverified state. An absent about photo also left a fixed-width text column. The local template correction honors supplied titles, keeps photo navigation neutral, omits empty credential/trust cards, requires approved verification before verification prose, and gives no-photo about content the full column. These code corrections require the normal TradeScout release path; saved profile data does not deploy frontend changes.

The operator subsequently confirmed, "They will handle all requests." Louisiana Stone Solutions is the selected recipient; TradeScout is not the operating recipient. The original company-page email was saved as `profileData.email` and `profileData.notificationEmail`, with `contactManagement: business_managed` and public contact still disabled. This scoped update was rehearsed with rollback before committing. It sent no messages and changed no owner, claim, verification, profile status, or discovery exposure.

An exact-mailbox account lookup found no existing company account. The credentialless steward cannot open the recipient inbox. The normal Express notification contains an inbox link and withholds customer contact details until the protected response step, so a mailbox setting alone is not end-to-end delivery readiness. A confirmed company operator account must be attached through the appropriate managed-profile handoff. The generic self-service claim route currently rejects any nonempty owner ID, including the internal steward; do not present its link as a verified transfer path for this record.

The current live intake enum lacks business-managed contact. Its existing `pending_owner_contact` value remains until the additive business-managed mode is released; the intake notes and latest action record the selected company recipient and remaining operator setup. Publication and working recipient access remain open. Do not promote the intake to `live` or claim customer delivery from this private draft checkpoint.

## Local implementation checkpoint

The isolated branch adds `business_managed` to the existing intake contract and database constraint through migration `0128_business_managed_partner_contact`. It uses explicitly configured company destinations and the existing protected request flow. Switching the admin editor into this mode clears inherited destinations; editing an existing business-managed intake preserves its company contacts. Both managed-profile health paths block readiness until the correct business recipient, inbox configuration, claimed ownership, and confirmed operator account exist. The migration does not change existing intake records or grant access.

The changed routing behavior, actual admin editor PATCH payloads, intake contracts, profile operations, and required schema checks passed 59 focused tests. Independent review confirmed the inherited-destination defect was fixed. The profile template passed 21 related tests, and protected request entry passed 33 tests. Actual local component review at 390 by 844 and 1280 by 900 confirmed loaded original imagery, corrected headings, a working neutral photo gallery, and no mobile hero overflow. This local preview is not a production deployment or a request-delivery test.

Release preparation also fixes three existing TypeScript filter-narrowing errors without changing emitted behavior, replaces the undeclared development-only `nanoid` import with Node's built-in `randomUUID`, and preserves the canonical sitemap's final newline during generation. Verified unchanged public assets and the unchanged profile route source were normalized to canonical Git LF bytes to satisfy the existing strict byte and source guards; those guards were not weakened. Three existing IndexNow test expectations still expect four image URLs where the current baseline emits five; they remain recorded baseline failures outside the changed behavior.

The full minimum release contract must be evaluated against the saved commit. Its database step targets the separately verified `tradescout_test` database only. No production migration, publication, owner handoff, message delivery, merge, or code deployment has occurred in this checkpoint.
