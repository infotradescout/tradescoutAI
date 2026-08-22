# D2 evidence - Scout to Community task loop

Date: 2026-08-21

Baseline: `ae840aa89b75c0eb93eaa2390b7cfcfe861d6ada`

## Outcome proved

- Scout presents one saved task identity, the latest meaningful state, one validated dominant next action, recoverable history, and one fixed composer.
- `Save -> New -> Conversations -> reopen` restored the same flooring task, 8 updates, and `Open local Community` next action.
- Community presents heading/create, one non-wrapping viewbar, compact progressive disclosure for all five existing start modes, and the real feed before secondary county panels.
- Global Explore remained browse-only and hid Create post.
- The bottom taskbar and top-right tools menu remained the shell navigation owners on desktop and mobile.

## Automated proof

- `npm run check`: pass.
- `npm run build`: pass, including public landing and built-asset URL verification.
- Focused Scout, Community, shell, and CVS batch: 70/71 assertions passed. The only failure is the pre-existing stale `initialHomeIdFromUrl` source assertion against untouched `client/src/pages/homes.tsx`, whose released implementation uses `requestedHomeId`.
- Direct impacted suites passed: action validation 13/13, ScoutThread 9/9, Scout home 9/9, shell 7/7, Community surface 7/7, Community CVS 5/5, Scout authority 3/3, Scout result UI 4/4.
- `git diff --check`: pass (line-ending notices only).

## Authenticated browser proof

Deterministic authenticated Escambia County fixture; fixture and local Vite server were removed after proof.

- 1440x1000 Scout: no horizontal overflow; task `y=124..306.85`; action `y=237.05..294.05`; collapsed history `y=314.85..359.65`; bottom taskbar `y=943.2..996`; top-right menu present.
- 1440x1000 long history: 8 updates; internal thread `scrollHeight=1477`, `clientHeight=474`, `scrollTop=1003.2`; reached latest.
- 390x844 Scout: no horizontal overflow; task `y=74..344.45`; action `y=269.95..331.65`; composer `y=716.2..760.2`; bottom taskbar `y=787.2..840`; no overlap; top-right account/tools menu present.
- 390x844 long history: internal thread `scrollHeight=1566`, `clientHeight=314`, `scrollTop=1252`; reached latest.
- 1440x1000 Community: no horizontal overflow; feed began at `y=373.2`; first post ended at `y=675.2`; five start routes reachable; final console after last HMR had zero warnings/errors.
- 390x844 Community: no horizontal overflow; viewbar `scrollWidth=399`, `clientWidth=344`, `flex-wrap=nowrap`; feed began at `y=334.6`; first post ended at `y=679.1`, before the bottom taskbar at `y=787.2`; all five start routes reachable.

Local visual artifacts:

- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\workspace-density\scout-task-desktop-1440.png`
- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\workspace-density\scout-task-mobile-390.png`
- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\workspace-density\community-feed-desktop-1440.png`
- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\workspace-density\community-feed-mobile-390.png`
- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\workspace-density\metrics.json`

## Release proof

Pending exact commit, minimum-release gate, PR merge, and post-deploy build-identity proof. No release completion is claimed by this artifact.
