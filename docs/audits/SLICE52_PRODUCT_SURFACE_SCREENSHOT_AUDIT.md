# Slice 52 — TradeScout Product Surface Screenshot Audit

Date: 2026-05-31
Build observed live during capture: `139c11900ec432da26d6538c70368eab1a460b9b`
Scope: visual audit only (desktop + mobile) for `/landing`, `/`, `/homes`, `/direct-connect`, `/scout`

## Artifacts
Desktop and mobile screenshots captured in:
- `docs/audits/screenshots/slice52/`

Included files:
- `landing-desktop.png`, `landing-mobile.png`
- `home-desktop.png`, `home-mobile.png`
- `homes-desktop.png`, `homes-mobile.png`
- `direct-connect-desktop.png`, `direct-connect-mobile.png`
- `scout-desktop.png`, `scout-mobile.png`

## Decision
- Overall result: **PASS with P1/P2 polish backlog**
- P0 blockers: **none**
- Product is functional and coherent, but visual hierarchy and above-the-fold composition need polish on landing/home surfaces.

## Findings

### P1
1. Landing/home above-the-fold composition feels unbalanced due to very large empty dark space below the first-use/guidance block.
- Surfaces: `/landing`, `/`
- Evidence:
  - `docs/audits/screenshots/slice52/landing-desktop.png`
  - `docs/audits/screenshots/slice52/home-desktop.png`
  - `docs/audits/screenshots/slice52/landing-mobile.png`
  - `docs/audits/screenshots/slice52/home-mobile.png`
- Impact: page can appear unfinished or broken visually, even when functionally correct.
- Recommendation: tighten hero-to-content spacing and ensure intentional next content appears sooner on first viewport.

2. First-use launcher prominence on landing mobile appears weaker than desktop in captured state (guidance cards dominate; launcher choice block not clearly surfaced in the screenshot path).
- Surface: `/landing` mobile
- Evidence:
  - `docs/audits/screenshots/slice52/landing-mobile.png`
- Impact: reduced clarity for the “Where should I start?” decision moment on phones.
- Recommendation: guarantee launcher appears in primary scroll position for fresh users before long background/hero continuation.

### P2
1. Scout desktop right rail is information-dense compared to left-side discovery rail, causing mild visual competition.
- Surface: `/scout` desktop
- Evidence:
  - `docs/audits/screenshots/slice52/scout-desktop.png`
- Recommendation: slightly reduce right-rail emphasis (spacing/weight) to preserve left-side discovery flow priority.

2. Direct Connect mobile has strong clarity, but top section stack is dense before form interaction starts.
- Surface: `/direct-connect` mobile
- Evidence:
  - `docs/audits/screenshots/slice52/direct-connect-mobile.png`
- Recommendation: compress introductory cards by a small amount on mobile to bring first form control higher.

## Surface Notes
- `/direct-connect`: strong visual consistency and clear request-prep framing on both desktop/mobile.
- `/scout`: discovery framing is clear and aligned to language constraints.
- `/homes` unauthenticated path correctly shows sign-in gate; this audit did not evaluate authenticated HomeID dashboard visuals.

## No-Code Outcome
- This slice intentionally made no product-code changes.
- Follow-up recommended as a focused UX polish slice for P1 items on landing/home first viewport composition.
