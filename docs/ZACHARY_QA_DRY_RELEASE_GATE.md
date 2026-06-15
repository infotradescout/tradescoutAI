# Zachary QA + DRY/SRP Release Gate

Source of truth: `TradeScoutPro_HANDOFF_SPINE.md`.

This document turns Zachary's QA and DRY/SRP direction into TradeScout operating policy. It is a release-gate foundation only. It authorizes documentation, checklists, intake rules, and contract tests. It does not authorize runtime refactors, UI changes, feature work, schema/storage edits, route changes, role changes, Direct Connect changes, trust/CVS changes, deployment changes, or generated sitemap edits.

## Operating Order

TradeScout work must use this order:

1. QA the current user experience.
2. Fix what is broken or confusing.
3. Clean up duplicated/oversized code safely.
4. Re-QA after cleanup.
5. Only then introduce new features.

The goal is to make the app behave the way a real user expects before expanding scope. AI-built surfaces commonly miss broken states, spacing, mobile layouts, validation, confusing flows, and edge cases; this gate exists to make those failures visible before more work piles on top.

## Release Gate Rules

- No user-facing merge without QA evidence.
- No pure refactor merge without behavior-parity evidence and re-QA.
- User-facing QA starts with the user flow, not the code.
- DRY/SRP cleanup is a planned follow-up after UX QA and critical/high fixes.
- Runtime cleanup targets remain audit targets until an explicit refactor lane is approved.
- Refactor lanes must preserve routes, roles, events, permissions, auth, Direct Connect, trust/CVS, claims, pricing, payouts, DB schema, migrations, deployment behavior, and production config unless separately authorized.
- Generated sitemap drift must not be committed unless the task explicitly owns sitemap cleanup.

## Front End UI QA Guide

Start with user flow, not code:

- Identify the user, goal, route, entry point, expected next action, and success condition.
- Walk the flow as a real user, including hesitation, wrong inputs, reloads, and back navigation.
- Record what blocks, confuses, or surprises the user before proposing implementation changes.

Screen inventory:

- List every route, modal, drawer, tab, panel, empty screen, settings area, admin/operator view, and role-specific branch touched by the work.
- Mark public, authenticated, admin/operator, provider, requester, and denied-access states separately.
- Include mobile and desktop screenshots or notes for each inspected screen when relevant.

Test every clickable element:

- Buttons, links, icons, tabs, dropdowns, checkboxes, toggles, menus, pagination, upload controls, and inline actions must either work, be intentionally disabled, or show a clear valid state.
- Validate hover, focus, disabled, loading, and post-click states.
- Confirm destructive or privileged actions preserve confirmation and authority expectations.

Forms and validation:

- Test required fields, invalid values, too-long values, missing files, duplicate submissions, cancel paths, and browser autofill.
- Confirm validation copy is specific, visible, and does not imply unavailable capabilities.
- Confirm form success states explain what happened and what the user can do next.

Loading, empty, error, and success states:

- Every data-dependent panel needs loading, empty, error, and success behavior.
- Empty states must not fabricate records, metrics, providers, donations, activity, or operational proof.
- API errors must fail safely and keep law-sensitive actions gated.

Responsive testing:

- Test mobile, tablet, laptop, and wide desktop.
- Check wrapping, spacing, sticky bars, modals, sidebars, grids, map panels, cards, and action rows.
- Ensure text does not overlap, clip, or force incoherent horizontal scrolling.

Visual consistency:

- Check typography scale, spacing, color tokens, borders, icon usage, button hierarchy, card density, and repeated patterns.
- Avoid one-off styling unless the surface has a documented reason.
- Confirm user-facing copy remains TradeScout-only unless an approved exception exists.

Navigation, deep links, refresh behavior:

- Confirm direct URL entry, route refresh, browser back/forward, login redirects, onboarding redirects, denied routes, and canonical links.
- Confirm public pages do not reveal private actions or contact paths.
- Confirm unavailable routes fail to safe navigation or a clear error.

Permissions and roles:

- Test public, signed-out, signed-in incomplete, homeowner/requester, provider/contractor, business owner, staff/admin, and denied users when the surface is role-sensitive.
- Confirm visibility does not grant access.
- Confirm contact remains gated through Intent -> Decision Card -> Contact.

Realistic messy data:

- Test long names, missing optional fields, many records, zero records, expired records, duplicate-looking records, incomplete profiles, unverified actors, stale statuses, and uploaded filenames with spaces.
- Do not add fake production records to prove a state.

Accessibility basics:

- Check keyboard navigation, visible focus, labels, alt text, semantic headings, color contrast, reduced-motion concerns, and screen-reader-friendly status changes.
- Confirm icon-only actions have accessible names.

Browser compatibility:

- Test current Chrome/Edge and at least one additional browser when the surface is release-relevant.
- Note browser-specific layout, upload, storage, map, or auth behavior.

Refresh/session behavior:

- Refresh during loading, after submit, after sign-in, after sign-out, and after role/permission changes.
- Confirm session expiry, unauthorized responses, and stale client cache fail safely.

API error handling:

- Test network failure, 401/403/404/409/429/500-style responses when practical.
- Confirm errors do not expose private data, bypass contact gates, or imply action success.

AI sloppiness checks:

- Look for confident but unsupported claims, invented metrics, broken edge states, duplicated CTAs, vague labels, dead buttons, inconsistent naming, and copy that sounds polished but is false.
- Public campaign, pricing, offer, and strategic surfaces must have Truth Lock approval before merge.

Console/network checks:

- Check browser console for runtime errors, hydration errors, blocked assets, mixed content, failed requests, CORS issues, and repeated request loops.
- Capture relevant network evidence for bugs, especially status code and endpoint.

Per-feature QA checklist:

- User flow and success condition identified.
- Screen inventory completed.
- Every clickable element tested.
- Forms and validation tested.
- Loading, empty, error, and success states tested.
- Responsive behavior tested.
- Visual consistency reviewed.
- Navigation, deep links, and refresh behavior tested.
- Permissions and roles tested.
- Realistic messy data tested.
- Accessibility basics checked.
- Browser compatibility checked.
- API error handling checked.
- Console/network checks completed.
- Critical and high bugs fixed or explicitly waived by owner.
- Release evidence attached.

Bug report format:

- Use the Bug Report Template below for every bug that blocks or informs a release decision.

Bug priority levels:

- Use the Bug Priority Guide below. Do not hide critical or high issues inside polish language.

Final release check:

- QA evidence exists.
- Critical/high bugs are fixed or explicitly waived.
- User-facing copy is truthful.
- Law-sensitive gates are intact.
- Behavior-parity evidence exists for refactors.
- Re-QA evidence exists after cleanup.
- Validation commands are recorded with pass/fail status.
- Working tree is clean except approved files.

## Feature QA Checklist

- Feature or surface name:
- User goal:
- Primary route(s):
- Entry point(s):
- Success condition:
- Roles tested:
- Screen inventory:
- Clickable elements tested:
- Forms and validation tested:
- Loading/empty/error/success states tested:
- Responsive viewports tested:
- Browser(s) tested:
- Refresh/session behavior tested:
- API error handling tested:
- Console/network checks completed:
- Accessibility basics checked:
- Realistic messy data tested:
- Critical bugs:
- High bugs:
- Medium bugs:
- Low bugs:
- Waivers requested:
- Evidence links or attachments:
- Final QA decision:

## Bug Report Template

- Title:
- Steps to reproduce:
- Expected result:
- Actual result:
- Device/browser:
- Screenshot/recording:
- Priority:
- Affected route/screen:
- Console/network evidence if relevant:

## Bug Priority Guide

- Critical: user cannot complete the main purpose of the app.
- High: major feature broken but workaround exists.
- Medium: feature works but experience is confusing/messy.
- Low: polish issue.

## Release Evidence Checklist

- Branch and commit SHA:
- Scope of changed files:
- QA flow checklist completed:
- Bug report links or summaries:
- Critical/high bugs fixed or owner-waived:
- Truth Lock approval recorded when required:
- Behavior-parity evidence recorded when refactor-only:
- Re-QA evidence recorded after refactor or cleanup:
- Contract/focused tests run:
- `npm run check` result:
- Broader verify/release gates run or explicitly skipped with rationale:
- Sitemap drift checked and not staged unless in scope:
- Working tree status:
- Merge/deploy decision:

## DRY Refactor Intake Checklist

DRY/SRP cleanup is not authorized by this lane. These are audit targets only until a separate refactor lane is approved.

Known audit targets:

- admin-dashboard.tsx - 11,094 lines
- parking-pass.tsx - 8,578 lines
- shared/schema/legacy.ts - 6,554 lines
- server/storage.ts - 5,529 lines
- 631 repeated server try/catch blocks in route files
- ~358 raw fetch() calls versus 153 existing apiRequest() uses
- duplicated formatCurrency / formatDate helpers in 6+ pages

Refactor intake fields:

- Target file(s) or repeated pattern:
- User-facing screens/flows affected:
- Current behavior evidence:
- Behavior-parity plan:
- Test plan:
- QA screens/roles to re-check:
- Rollback plan:
- Law-sensitive areas touched:
- Explicit non-goals:
- Owner approval if public/campaign/pricing/offer/strategic surface is involved:

## DRY/SRP Rule

No refactor lane may merge unless it proves behavior parity and includes re-QA evidence for affected screens/flows.

Behavior parity means the refactor preserves user-visible behavior, route names, role behavior, event names, permissions, auth, Direct Connect gates, trust/CVS exposure, claims-first paths, pricing, payouts, DB shape, migration order, deployment behavior, and production config unless a separately approved lane says otherwise.

Re-QA means the affected user flows were tested again after cleanup, using the same evidence standard as the Front End UI QA Guide.

## Validation For This Docs Lane

Required:

- `node scripts/zachary-qa-dry-release-gate.contract.test.mjs`
- `node scripts/tradescoutpro-cleanup-docs.contract.test.mjs`
- `node scripts/tradescoutpro-handoff-spine.contract.test.mjs`
- `npm run check`

Do not require full `npm run verify` for this docs-only lane when it is known to enter unrelated DB-backed timeout paths. If skipped, document that this lane changes docs/contracts only and that full verify is reserved for release confidence or lanes that touch runtime/integration behavior.
