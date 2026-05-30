# Slice 47 — Release Candidate Deployment Watch

## Baseline
- RC baseline commit: `76ba7c77`
- Watch mode: controlled production watch
- Product scope: TradeScout HomeID / Direct Connect / Scout / first-use guidance

## Allowed during watch
- critical bug fixes
- route/runtime fixes
- low-risk UX/copy polish
- documentation
- smoke updates

## Not allowed during watch
- new product systems
- schema-heavy migrations
- payment changes
- notification changes
- contractor routing/provider matching changes
- auth weakening
- verification bypasses
- fake data/demo data in real flows
- sitemap drift

## Watch surfaces
- auth/session
- startup fallback visibility
- HomeID routes
- Direct Connect request routes
- Scout routes
- first-use guidance rendering
- mobile first-use flow
- 500/timeout spikes

## Checkpoints
- deploy build header check
- `/api/health`
- core route render checks
- session persistence smoke
- HomeID verified smoke
- first-use guidance live UI smoke
- mobile first-use smoke

## Alert thresholds
- any persistent `500` on core routes = FAIL
- startup fallback visible on main routes = FAIL
- auth/session refresh failure = FAIL
- HomeID smoke regression = FAIL
- Direct Connect request creation/submission regression = FAIL
- Scout route crash = FAIL
- first-use guidance hidden or broken on live routes = FAIL
- mobile overflow/blocking navigation = FAIL
- isolated expected `429` from rapid login retry = non-blocking if retry succeeds

## PASS criteria
- deployed build header confirms RC baseline or newer approved fix
- health endpoint returns `200`
- core routes mount
- startup fallback hidden
- verified HomeID smoke passes
- first-use guidance live proof passes
- session persistence passes
- mobile first-use smoke passes
- no unresolved P0/P1 blockers

## FAIL criteria
- any P0/P1 blocker remains unresolved
- release flow requires bypass not allowed in production
- critical route timeout persists
- user cannot start HomeID, Direct Connect, or Scout discovery route

## Response rules
- P0: patch immediately, document route/build/error/fix/validation
- P1: patch if low-risk, otherwise document and schedule
- P2: backlog only, no release block
