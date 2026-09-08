# Local service profile design correction

Checkpoint: 2026-09-06. Base: origin/main 9553c70bf69eb06e5ea6e1d894c401eaa245a4e9.

The user rejected the rendered Louisiana Stone Solutions profile, including its adequacy as a default. The active deliverable is a revised, runnable native profile with desktop and mobile previews shown in the conversation before another release. The full outcome still includes the company's native request management; this design correction does not change publication, ownership, verification, delivery, or county authority.

## Experience and implementation lock

- Visitor job: identify the business, judge service and location fit, inspect its real photo, then start a request with optional service context.
- Existing owner: ProjectServiceProfile.tsx/.css, selected by the existing local-service layout field. Extend this implementation; do not add another theme or alter unrelated business templates.
- Alternatives considered: a marketing landing page inflates sparse facts; a checkbox form makes intake the business; a compact business profile presents identity and service fit before optional intake. Use the third.
- First viewport: real company name and logo, countertop specialty, Baton Rouge base, New Orleans coverage, useful original photo, clear request action and recipient.
- Selection remains optional. Put the existing multiselect in a disclosure and preserve its selected values into ExpressDirectConnectPanel. Preserve general requests.
- One photo appears once at rest, has a neutral caption, opens the existing accessible gallery, and retains its item/share identity. No photo removes the media column. Multiple photos retain the gallery.
- Support/account actions remain available in the existing route but visually secondary. No invented trust facts, projects, reviews, addresses, phone, partner relationship or credentials.
- Original logo and kitchen photograph only. Content additions are limited to the company-provided services and user's statement that the company handles requests.
- Responsive review includes desktop, 390px, and 320px, zero media and longer text, keyboard gallery recovery, chosen-services request, and no submission.

## Sequence and proof

1. Reconstruct the current route and preserve the original dirty checkout. Done: separate clean worktree from current origin/main.
2. Extend the existing profile composition and scoped styles; prepare the source-backed content update.
3. Run the actual ProfileSiteView in an isolated local preview with production-shaped data, no production writes, and no fabricated request success. Test affected profile/contact contracts and type/build checks.
4. Have an independent design objector review fresh desktop/mobile images. Resolve concrete findings and show the revised result to the user. The user's rejection overrides automated visual claims.
5. Keep release and any stored profile content update pending that preview review; no merge or deployment in this correction turn.

The regenerated project index retains the existing 15 errors and 5 warnings. The active change extends canonical component owners instead of introducing another competing export. Unrelated JW locks and original workspace WIP are preserved.

## Review checkpoint: 2026-09-06 17:23 UTC

Implemented the revised composition in the existing ProjectServiceProfile owner. Identity and location precede the original photo, specialty, service list, and request action. Service selection is an optional disclosure and continues into the native ExpressDirectConnectPanel. The mobile fixed request action hides when the main action is visible, transferring keyboard focus before hiding a focused action. The existing gallery, trust actions, account controls, verification conditions, profile items, and contact callbacks are retained.

The shared Louisiana Stone Solutions definition now includes its supplied service description and a direct request-recipient statement. These are proposed content values in this local preview. The public route reads stored profile content; these source changes have not updated the production record. A future authorized release must review and apply those values through the native profile update path while preserving ownership and other stored content.

The fixture uses the actual ProfileSiteView route, native providers, styles, trust/account actions, and request dialog. It binds only to 127.0.0.1:5197, uses local original image/font assets, and blocks all mutations. It does not demonstrate request delivery, authenticated business management, or production exposure.

Validation:

- `npm ci --no-audit --no-fund`: passed.
- `npm run check`: passed; `tmp/preview/typecheck-final.log`.
- `npm run build`: passed, including local-service lazy chunk, public asset, and route-owner checks; `tmp/preview/build-final.log`. Existing large-chunk warning remains. Windows CRLF differences in 187 public text files were normalized to exact HEAD bytes solely in this new checkout; there are no staged or working-tree public asset changes.
- `npm run test:run -- client/src/pages/profile-sites/ProjectServiceProfile.test.tsx client/src/pages/profile-sites/LocalServiceProfileTheme.test.tsx client/src/pages/profile-sites/ExpressDirectConnectPanel.test.tsx server/tests/business-profile-gallery-sharing.contract.test.ts server/tests/louisiana-stone-manual-release.behavior.test.ts server/tests/louisiana-stone-profile-exposure.test.ts server/tests/profile-account-domain.test.ts server/tests/profile-gallery-share-metadata.test.ts server/tests/profile-site-law-invariants.contract.test.ts server/tests/public-profile-trust-actions.contract.test.ts server/tests/universal-profile-express-direct-connect.contract.test.ts`: 102 passed, 5 failed; all 30 component tests passed. Receipt: `test-results/local-service-design-source-review-final.json`.
- Remaining source-contract baselines: two legacy wrapper marker assertions in profile-site-law-invariants; one Wholesaler inline trustActions prop assertion in public-profile-trust-actions; two legacy Express copy assertions in universal-profile-express-direct-connect. These are documented failures, not a full-suite pass. The updated local-service light/compact routing assertion passes.
- Browser: selected Countertops and Tile reach the native request title and Details field; no request submitted. The gallery opens, Escape closes it, and focus returns to View full photo. Mobile shows one visible primary request action both above and within the request section. At 390px and with a synthetic long name at 320px, there is no horizontal overflow. Without media, zero photo elements and no reserved photo column remain.
- Independent visual review: desktop, mobile, scrolled mobile, expanded picker, long name, and no-media screenshots have no blocking visual defect. The proposed copy objection was closed against the user's Photo 3 business statement, "Pretty much whole remodels." This review establishes preview suitability; user acceptance remains pending.

Local visual artifacts under `artifacts/profile-review/`: `desktop.png`, `mobile.png`, `mobile-services.png`, `mobile-service-picker.png`, `mobile-long-name.png`, `no-media.png`, and `request-form.png`. The desktop preview was shown inline in the conversation. The runnable preview is `http://127.0.0.1:5197/u/louisiana-stone-solutions`; its launcher and fixture documentation are in the ignored `tmp/preview/README.md`.

The generated local index remains refreshed and retains the 15/5 baseline. Its local inventory includes the ignored preview harness and Vite cache, so it is kept outside this source change. No minimum-release gate, production mutation, production request, or deployment was run for this visual review checkpoint. No migrations are introduced. Merge and deployment remain pending the user's preview review.

## Release continuation: 2026-09-07

The user directed completion after rejecting the imposed review pause. The active outcome is now the release of this reviewed Louisiana Stone Solutions layout and supplied copy, followed by direct production verification. The preceding preview hold records that earlier checkpoint; it no longer pauses the authorized release.

Current main `a531323772cebd57ea49694a29a5b9c0fbd83031` was merged into the branch without conflicts. The newer BusinessProfileTheme work on main is a different renderer; this change retains its existing dispatch and edits only the existing project-profile owner. Preserve the approved business data, native request custody, original images, and other profile templates.

Run the full minimum-release gate on the exact clean candidate, including native disposable PostgreSQL migration and schema verification, and recheck the native profile at desktop and mobile sizes. Apply the three proposed content values through the native authorized profile update after re-reading its saved content. Merge PR 592 through the existing main-to-Render path and verify the build marker, health, live public route, and request dialog. No customer request or external message is needed for the production smoke. Record release evidence on the pull request; the rollback boundary begins at the currently live main SHA above.

## Quality correction: 2026-09-08

The user rejected the released design: "thats not even close to the quality of our other public profiles." That correction invalidates the preceding design-quality verdict. Prior functional proof remains bounded to the functions tested. The release authority from the continuation remains active; do not reintroduce the old preview approval hold.

Intent reconstruction: the locked outcome is a materially better Louisiana Stone Solutions public profile, measured against actual TradeScout public profiles. The supported visitor job is to identify the company, assess service and location fit, view its supplied photo, and start a native request with optional service context. The specific composition is a reversible design choice, not a user-approved aesthetic standard.

Live comparisons in the current turn: ISSA Build shows full-width photography and a deliberate brand header; JW Stone combines material imagery with editorial typography; JRS Auto Glass gives its own brand the whole page. Pro Fab's route is unavailable and contributes no comparison evidence. No benchmark assets, copy, or business claims are imported into LSS.

Experience alternatives: a full-bleed image with text overlay over-enlarges the single portrait image and hides its countertop detail; a gallery workspace implies more imagery than is supplied; an editorial company/photograph composition preserves the original image while giving identity, service choice, and request their own hierarchy. Implement the third in the existing ProjectServiceProfile owner. Retain canonical DM Sans/Cormorant fonts, persisted gold/ink brand values, and the original logo and kitchen photo.

Semantic delta: replace the directory-style identity row and small cropped image; consolidate the repeated service list and hidden picker into one visible optional selector. These are deliberate replacements of earlier implementation choices, not removed capabilities. Preserve general requests, selected service context, gallery/share identity and focus recovery, trust actions, account controls, profile items, approved-only verification, native contact custody and county enforcement. No production record fields, ownership, API, migration, or unrelated renderer changes are needed.

The refreshed index at base 87d87de4 reports 11 pre-existing errors and 5 warnings. The new worktree is D:/ts-lss-quality-20260908 on codex/lss-profile-quality-20260908; canonical County Map WIP remains untouched. The local preview uses the actual ProfileSiteView with the persisted production content read back after the preceding native save. It permits only local GET/HEAD fixture requests and uses the hash-verified original assets and the app's canonical fonts. It does not prove authenticated account management or delivery.

Proof plan: rendered desktop/mobile and a fresh-context Product Design Objector; selected/general request opening, gallery close/focus, no-media and long-name views; focused profile/contact contracts; exact clean minimum release gate against a fresh disposable database; PR and Render release followed by build/health and public page verification. No visual score or technical pass substitutes for the user's judgment.

Implementation and review disposition: the canonical profile now uses an ink/gold business identity beside the original photograph, with visible service choices and direct request access. Both in-page service links scroll and focus the services heading without creating a fragment history entry that triggers the profile Back guard. Support/account controls remain available with secondary visual weight. The corrected 320px header stays on one row (44px navigation height), and the 390px service chooser has no horizontal overflow.

The independent Product Design Objector found the fragment-navigation failure, excessive support/account prominence, request draft loss, and missing request-modal keyboard containment. All four are corrected. The native ExpressDirectConnectPanel keeps unsent edits for the same business while refreshing untouched service prefills, resets contact/consent for another profile or completed request, ignores stale results from an abandoned business draft, contains Tab/Shift+Tab, and restores opener focus. No backend route or submission authority changed.

Pre-release proof: 135 focused tests across 11 suites pass, including 21 request-panel tests and 11 project-profile tests. Root browser verification used the actual ProfileSiteView with saved production-shaped content at 1440x1000, 390x844 and 320x700. Both service links stay on the local profile and focus the services heading. Countertops plus Tile reach the native dialog; typed Details survive close/reopen; Shift+Tab wraps first-to-last, Tab last-to-first, and Escape restores the request button. Gallery open/Escape and selected-service retention pass. Synthetic no-media renders zero images with one column; a deliberately long name remains readable without horizontal overflow. Nothing was submitted. The preview is evidence for these observed flows, not proof of real delivery or user aesthetic acceptance. Exact release gate and post-deploy state will be recorded in the pull request.
