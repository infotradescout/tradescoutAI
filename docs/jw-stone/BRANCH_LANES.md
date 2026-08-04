# JW Stone branch lanes

**Purpose:** Keep JW Stone work from breaking TradeScout core, Dean recovery, and non-JW release remediation.

## Prefix (required for new JW work)

All **new** JW Stone branches must start with:

```text
jw-stone/<topic>
```

Examples:

| Branch | Use |
| --- | --- |
| `jw-stone/lane-isolation` | Lane policy + index (this control plane) |
| `jw-stone/strategy-closed-loop` | Closed-loop strategy doc only |
| `jw-stone/marketplace-<change>` | `/jw-stone` storefront / First Cut / catalog UX |
| `jw-stone/profile-<change>` | `/u/jw-stone` profile theme only |
| `jw-stone/passport-<change>` | Stone Passport / inventory truth |
| `jw-stone/demand-<change>` | Demand brief / wishlist → sourcing signals |
| `jw-stone/ops-<change>` | Internal ops, receiving, landed cost |
| `jw-stone/homeid-<change>` | Installed-stone → HomeID handoff |

Base every JW branch from current `origin/main` unless you are stacking a short-lived JW series that already merged its parent JW PR.

## Do not put JW work on these lanes

| Forbidden host branch | Why |
| --- | --- |
| `fix/dean-damaskos-profile-recovery` | Dean-only recovery |
| `codex/non-jw-release-remediation-*` | Non-JW audit / SEO / release-control |
| Unrelated `fix/*`, `repair/*`, `codex/*` TradeScout platform branches | Contaminates review and rollback |
| Direct commits to `main` | `main` is production |

Legacy JW branches (`codex/jw-stone-*`, `agent/jw-stone-*`, `repair/*jw-stone*`, `feature/jw-stone-2-0`, etc.) are **historical**. Do not extend them. Port any still-needed change onto a fresh `jw-stone/<topic>` branch from `origin/main`.

## What counts as JW Stone work

Treat as JW-only if it primarily changes:

- JW marketplace route `/jw-stone` and `client/src/features/jw-stone/**`
- JW profile `/u/jw-stone`, wholesaler JW presentation, JW inventory assets
- JW public HTML / SEO specific to JW
- JW migrations, runbooks, SI build `jw-stone-marketplace`
- Docs under `docs/jw-stone/**`

If a change is required for **platform law** (contact gating, trust, anti-scrape, shared profile search) and only incidentally helps JW, keep it on a **TradeScout platform** branch, not `jw-stone/*`. Do not smuggle platform refactors through JW PRs.

## PR and merge rules

1. One JW concern per PR when practical.
2. Diff must not include Dean, non-JW remediation, or unrelated platform files.
3. Title prefix: `jw-stone:` …
4. Record JW-scoped browser proof for UI (`/jw-stone` and/or `/u/jw-stone`).
5. Explicit owner GO before merge to `main` (production deploy).
6. Prefer draft PR until local preview is approved for user-facing JW UI.

## Agent / human checklist before starting JW work

1. `git fetch origin main`
2. `git checkout -B jw-stone/<topic> origin/main`
3. Confirm you are **not** on Dean or non-JW remediation branches
4. Touch only JW-scoped paths (or document why a shared file must change)
5. Push `jw-stone/<topic>` and open a JW-only PR

## TradeScout stays the platform

JW receives a **license / strategic surface** on TradeScout. JW acquisition, OpCo equity, and warehouse ops do not move TradeScout ownership into JW. Keep TradeScout systems outside JW creditor and dispute perimeter in product and legal design.
