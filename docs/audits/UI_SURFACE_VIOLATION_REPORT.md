# UI Surface Violation Report

Date: 2026-07-13

Scope: routed page roots under `client/src/pages`

Contract: `docs/SURFACE_CONTRACT.md`

## Result

The routed AppShell page inventory now has zero page roots claiming viewport height with
`min-h-screen`. AppShell and AppFrame retain ownership of viewport height, the application
canvas, and primary scrolling. Feature pages use frame-relative `min-h-full` only where they
need to fill the available content area, and no longer paint a route-wide background over the
AppFrame canvas.

One `min-h-screen` root remains by design:

| File | Ownership evidence | Disposition |
| --- | --- | --- |
| `client/src/pages/trade-up-for-trade-schools.tsx` | `AppRoutes.tsx` renders it through the `isPublicCampaignRoute` branch before `<AppShell>` | Keep. This isolated campaign is its own viewport canvas, not an AppShell FeatureSurface. |

## Remediated roots

| Surface | Prior violation | Current ownership |
| --- | --- | --- |
| Offer Services | `min-h-screen bg-tsBackground` | Frame-relative transparent feature surface |
| Exchange rental property/equipment | `min-h-screen bg-tsDark` | Frame-relative transparent feature surface |
| Exchange listing loading, error, and detail | `min-h-screen bg-tsBackground` | Frame-relative transparent states/detail |
| Profile purchase status | `min-h-screen bg-tsBackground` | Frame-relative transparent feature surface |
| Procurement pages | `min-h-screen bg-neutral-950` | Frame-relative transparent feature surface |
| County directory and trade county | `min-h-screen bg-tsBg` | Frame-relative transparent discovery surfaces |
| TradePartners hub | `min-h-screen bg-background` | Frame-relative transparent hub |
| Giveaway rules | `min-h-screen bg-slate-950` | Frame-relative transparent content surface |
| Wholesaler profile theme | `min-h-screen bg-[var(--brand-bg)]` | Frame-relative transparent branded content |

## Enforcement

`client/src/routing/featureSurfaceOwnership.contract.test.ts` recursively inspects routed page
sources and fails if an AppShell page introduces `min-h-screen`. The test separately proves that
the only allowlisted viewport owner is rendered in the isolated public-campaign branch before
AppShell. This preserves the distinction between an isolated page canvas and an in-app feature
surface without relying on reviewer memory.

Dialog-local `h-[100vh]` behavior is intentionally outside this rule: a full-screen mobile dialog
is FeatureContent-local and does not create a competing route scroll root.
