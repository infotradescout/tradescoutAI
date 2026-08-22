# D3 evidence - Businesses workspace

Date: 2026-08-21

Baseline: `722cb8904b8dbc6aead0444ec5a1a3705251e7de`

## Outcome proved locally

- Businesses is now one search-and-inspect workspace: a compact selectable result list stays visible beside one selected-business inspector on desktop and stacks inspector-first after selection on mobile.
- Explicit URL fields are authoritative; absent fields may restore from session state scoped to the authenticated user and pathname. Values are normalized and capped, aliases emit one canonical query form, and Clear removes both URL and scoped storage state.
- A selected provider resolves only from the current safe provider-search results. Filter, search, state, county, and stale-result changes clear selection.
- The inspector reuses the canonical compact `ProviderCard`; its public profile link and existing provider-targeted Direct Connect hire route remain the only action owners. Directory fallbacks remain profile-only. No raw contact data or numeric CVS value was added.
- Existing area selection, trade inference, provider query, ordering, result count, loading, empty, fallbacks, analytics, and routes remain in place. The shared bottom taskbar and top-right tools were not edited.

## Automated proof

- Final combined focused run: 7 files, 100 tests passed, covering workspace state, same-state and interstate county/coordinate invalidation, provider card, Direct Connect gates, provider state scope, and universal provider exposure.
- Adjacent no-star doctrine: 3/4 passed. Its sole failure is the pre-existing stale assertion for `label: "Commercial Jobs"`; exact baseline and untouched `AppShellCore.tsx` use `label: "Jobs"`.
- `npm run check`: pass.
- `npm run build`: pass, including sitemap generation, Vite production bundle, public-landing verification, 557 JavaScript asset-URL checks, and server bundle.
- `git diff --check`: pass with repository-normal LF-to-CRLF notices only.

## Authenticated browser proof

Deterministic authenticated Escambia County fixture; the fixture, local Vite server, and temporary browser tabs were removed after proof.

- 1440x1000: zero page-level horizontal overflow (`1440/1440`); compact two-pane list and one inspector; selected Connect `y=631.4..665.4`; bottom taskbar `y=943.2..996`; top-right tools present.
- 390x844: zero page-level horizontal overflow (`390/390`); inspector promoted before the scrollable result list; inspector ends at `y=780.275`, before the bottom taskbar at `y=787.2`; top-right tools present.
- Native keyboard proof used CUA click on search, Tab to the result button, and Enter; it produced exactly one `aria-pressed=true` result and the matching inspector without a custom listbox keyboard model.
- County-change proof started from saved Escambia County coordinates, selected Okaloosa County without reselecting Florida, cleared the prior selection, canonicalized to `state=FL&county=12091`, omitted the old coordinates from the provider request, rendered the Okaloosa result, and kept horizontal overflow at zero.
- Interstate proof started at `state=FL&county=12033` with Escambia coordinates, selected Alabama, and produced `state=AL` with neither a county nor coordinates in the provider request. Selecting Baldwin County then produced `state=AL&county=01003`, still without coordinates; only the Alabama/Baldwin fixtures rendered, the stale-Florida sentinel stayed absent, and horizontal overflow remained zero.
- Businesses -> Jobs -> Businesses restored `/contractors?q=flooring&selected=provider-3`, the `flooring` query, and `Panhandle Home Finishes`; reload restored the same state.
- Clear produced `/contractors`, empty search, zero selected options, no Clear control, and remained clear after reload.
- Public profile remained `/business/panhandle-home-finishes`; Connect remained the existing `/direct-connect?intent=hire&targetProviderId=...` handoff.
- Final browser console contained zero warnings or errors.

Local visual artifacts:

- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\businesses-workspace\businesses-desktop-1440.png`
- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\businesses-workspace\businesses-mobile-390.png`
- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\businesses-workspace\businesses-county-change-1440.png`
- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\businesses-workspace\businesses-interstate-change-1440.png`
- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\businesses-workspace\metrics.json`

## Release proof

Pending exact commit, minimum-release gate, pull request, merge, and deployed build-identity proof. No release completion is claimed yet.
