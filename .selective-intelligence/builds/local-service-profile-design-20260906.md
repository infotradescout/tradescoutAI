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
