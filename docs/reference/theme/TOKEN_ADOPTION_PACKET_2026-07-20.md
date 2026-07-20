# Core app theme convergence — Selective Inheritance packet

Status: `changes_requested`

Observed: 2026-07-20
Revised: 2026-07-20 — reframed from adoption to convergence/source-removal per review

> This program is complete only when obsolete styling paths are removed from
> the repository and CI prevents their reintroduction. Visual matching and
> increased token usage alone are not completion criteria.

This packet stages a theme convergence and source-removal plan for operator
review. It does not authorize any code change. Every finding is sourced
directly from the repo (file paths, line numbers, git history).

## Review correction (supersedes the first draft's framing)

The first draft treated this as a token **adoption** gap and proposed adding
token usage where it was missing. That framing was reviewed and rejected:

> The root cause is not "insufficient token adoption." It is that the
> repository keeps multiple valid-looking styling paths alive. A value gets
> replaced, but the raw helper stays. A new Card is adopted, but the old
> Card remains importable. A token is superseded, but the dead token
> remains defined. An audit passes, but entire directories or syntax forms
> are outside its scan. Two months later, another developer or agent finds
> the old path, assumes it is approved precedent, and reintroduces the
> drift.

This packet is therefore restructured as a **convergence and source-removal
plan**. The success condition is not "more token references" — it is:

> There are fewer legal styling paths after the merge than before it.

**Non-negotiable principle, applies to every lane below:**

> Every token migration must remove the displaced styling source. Every
> canonical-component migration must delete or make unreachable the
> competing component. Every closed audit blind spot must include a
> regression test proving the old pattern now fails.

Do not "deprecate" a duplicate while leaving it available. Do not preserve
a dead token because it might be useful later — a future need can
introduce a reviewed semantic token; a dormant alternative only creates
ambiguity now.

## Primary sources

1. `client/src/index.css` — `@layer base { :root { ... } }`, lines 836–1055
2. `client/src/lib/themes.ts` — `applyTheme()` (line 382), `LOCKED_TRADESCOUT_THEME_ID` (line 64)
3. `client/src/components/ui/card.tsx` + `.ts-card` CSS class (index.css:1245-1284)
4. `client/src/components/layout/PagePrimitives.tsx` — second, parallel Card abstraction
5. `docs/reference/theme/THEME_LOCK_IMPLEMENTATION.md`, `docs/history/2026/THEME_LOCK_COMPLETE.md`,
   `docs/history/2026/SCOUT_AND_NAVS_LOCKED.md` — prior implementation record
6. `scripts/audit-theme-lock.mjs`, `scripts/ui-surface-audit.mjs` — existing CI guards
7. `docs/audits/ui-surface-audit.md` — existing raw-background offender list
8. Git history for `index.css`, `client/src/scout/ScoutHome.tsx`, `client/src/pages/exchange.tsx`

## What already exists (do not rebuild)

A 4-surface elevation hierarchy, fully token-backed, real values injected at
runtime by `applyTheme()`:

| Layer | Token | Purpose |
|---|---|---|
| Frame | `--surface-frame`, `--surface-frame-border` | Navigation chrome |
| Base/canvas | `--surface-base`, `--surface-app-bg` | Transparent — canvas owned by `TradeScoutBackground` |
| Card (elevated) | `--surface-card` | Cards, suggestions, prompts |
| Intermediate | `--surface-intermediate` | In-card surfaces |
| Input | `--surface-input` | Form fields |
| Border states | `--border-primary/secondary/subtle/active/focus` | Interaction states |
| Shadows | `--shadow-card`, `--surface-card-shadow`, `--surface-card-shadow-hover`, `--surface-control-shadow`, `--surface-action-shadow` | Elevation depth |
| Radius | `--ts-radius-card/control/panel/chip` | 8px / 8px / 10px / pill |
| Text | `--text-primary/secondary/tertiary/muted` | Type hierarchy |
| Charcoal scale | `--charcoal-950/900/800/700` | Base color-mix ramp |

Two component-level abstractions currently wire these tokens — this
duplication is itself part of the problem this packet resolves (Lane 1):
- `<Card>` (`components/ui/card.tsx`) → `.ts-card` → tokens.
- `Page`/`Section`/`Card` (`components/layout/PagePrimitives.tsx`) — a
  second, independent primitive set wired to the same tokens via Tailwind
  arbitrary values.

This app is intentionally dark-only (6 charcoal-family palettes, no light
theme, `LOCKED_TRADESCOUT_THEME_ID = "charcoal"` re-asserted on every load).
No light-theme work is in scope anywhere in this packet.

## Evidence feeding the lanes below

- **Scout**: `client/src/scout/ScoutHome.tsx` (1,562 lines) — zero
  `--surface-*`/`--border-*` token references, zero `<Card>` usage. Raw
  `zinc-950/800/300/400` classes and inline `bg-[radial-gradient(...)]` /
  `shadow-[...]` throughout. Created 2026-05-11 — five months *after* the
  Dec 2025 theme lock — so this is not legacy code that predates the
  system; it's an undocumented oversight. Sibling files `ScoutOS.tsx` /
  `ScoutThread.tsx` in the same folder are deeply token-wired.
- **Exchange**: `client/src/pages/exchange.tsx` outer chrome (header bar,
  filter pills, category grid container) uses raw `bg-black/30`,
  `bg-white/5`, `border-white/10`. Independently corroborated by the
  already-checked-in `docs/audits/ui-surface-audit.md`, which lists this
  file as the #3 raw-background offender in the app (139 hits). Inner
  listing cards already use `<Card>` 40 times and are unaffected. This gap
  is a documented, never-completed deferral
  (`docs/history/2026/THEME_LOCK_COMPLETE.md`).
- **Direct Connect**: `DirectConnectShell.tsx` — 76 token references
  alongside 9 raw arbitrary-value classes (`bg-white`, `bg-zinc-950`,
  `bg-white/18`, `bg-white/10`, `bg-black/70`, `bg-black/25`).
- **Community**: `community-feed.tsx` — 22 token references alongside 10
  raw arbitrary values (`bg-white/5` ×4, `bg-white` ×2, `bg-black/20` ×2,
  `bg-black/18` ×2) — very likely the exact mechanism behind the
  "three different grays on one screen" symptom from the original visual
  audit (main card vs. composer vs. sidebar as three separate styling
  authorities, not three bad hex choices).
- **Dead tokens**: `--bg-tertiary`, `--bg-quaternary`, `--orange-primary`
  (index.css:891-893) — defined once, zero consumers anywhere.
  `--border-focus` (index.css:890) — documented in
  `THEME_QUICK_REFERENCE.md` as a real interaction-state token, but every
  actual focus ring uses `--theme-accent-primary` directly instead
  (`.ts-control:focus`, index.css:1303-1310); the documented token was
  never wired to real usage.
- **Audit blind spots**: `scripts/audit-theme-lock.mjs` flags raw hex but
  is blind to Tailwind utility classes, and exempts any file whose name
  substring-matches `"Scout"` — which also matches `ScoutHome.tsx`, the
  actual offender. `scripts/ui-surface-audit.mjs` only walks
  `client/src/pages/**` and never scans `client/src/scout/**`, so it
  structurally cannot ever catch ScoutHome.tsx regardless of content.

## Five convergence lanes

### Lane 1 — Theme enforcement and primitive convergence
Branch: `fix/theme-enforcement-and-primitive-convergence`. Goes first. No
surface redesign in this lane.

- Fix both audit-script blind spots.
- Select the one canonical `Card` (operator decision required — see open
  questions).
- Migrate every remaining import from the competing `Card`.
- Delete the competing component file, export, barrel entry, and
  documentation reference.
- Classify the four dead tokens; delete those with no current semantic
  owner; wire a token only when this same branch introduces a real use
  for it.
- Add an import restriction (lint boundary) so the deleted `Card` path
  cannot return.
- Add audit regression fixtures containing known violations and prove the
  scripts reject them.

### Lane 2 — Scout complete convergence
Branch: `fix/scout-theme-convergence`. First surface to migrate. Zero
adoption despite being created after the theme lock — the cleanest
demonstration that the enforcement system now works. Scout is the
discovery surface in the product spine; Direct Connect already uses the
system heavily.

- Replace all raw surface, border, shadow, radius, and text-hierarchy
  values in `ScoutHome.tsx`.
- Remove local constants, class strings, helper functions, and CSS rules
  displaced by the tokens.
- Use the canonical `Card` where the represented object is actually a
  card.
- No Scout-specific aliases for existing semantic tokens.
- Mark `client/src/scout/` as a zero-tolerance clean zone in CI.
- Complete = the old styling route no longer exists in these files, not
  "looks correct."

### Lane 3 — Direct Connect leakage removal
Branch: `fix/direct-connect-theme-convergence`. The core action rail. Not
a redesign — remove the remaining 9–10 one-off values and their sources:
local color constants, arbitrary Tailwind values, inline styles, duplicate
shadows/borders/radii, component-specific fallbacks that bypass tokens,
compatibility aliases no longer needed. Tightly bounded; strong regression
protection given how heavily this surface is already token-adopted.

### Lane 4 — Community leakage removal
Branch: `fix/community-theme-convergence`. Establish one intended
hierarchy — application background, primary surface, raised/interactive
surface, border/subtle separation — then delete the raw declarations and
local alternatives that produced the competing grays. Do not merely make
their hex values match today; remove the competing authorities.

### Lane 5 — Exchange chrome convergence
Branch: `fix/exchange-chrome-theme-convergence`. Last. Inner cards already
canonical; the page-level omission was an intentional deferral. Bounded to
page shell, header, filters, and grid chrome. Broad Exchange expansion
stays deferred unless required by the core product loop.

## Audit behavior that prevents recurrence

The audit cannot remain a loose search for a few obvious hex codes. It
must cover every way styling actually enters the repo:

- Raw hexadecimal, RGB, HSL, and color-function values
- Tailwind arbitrary colors, shadows, radii, and borders
- Inline React style objects
- CSS and stylesheet declarations
- Template-string class composition
- Local CSS custom properties that duplicate system tokens
- Direct imports from deprecated component paths
- Reintroduction of deleted token names
- Files and directories previously omitted by the scanners

**Clean-zone model:**
- Scout, Direct Connect, Community, and Exchange become zero-exception
  zones as each lane lands.
- Any forbidden value in a clean zone fails CI.
- Existing debt outside clean zones may ratchet temporarily, but its
  count cannot increase.
- Exceptions require an owner, reason, and expiration date. No permanent
  generic allowlist.

**Test the audit itself.** Keep small fixtures that intentionally contain:

```tsx
<div className="bg-[#17191d] shadow-[0_8px_24px_rgba(0,0,0,.4)]" />
```

```tsx
import { Card } from "@/components/legacy/Card";
```

```css
.panel {
  border-radius: 13px;
  background: #202226;
}
```

The audit suite must prove each fixture fails. A scanner that only
reports success against the current repository can silently remain
incomplete.

## Merge conditions

No theme-convergence PR should merge unless all of these are true:

- The displaced component, token, helper, or declaration is deleted.
- The migrated surface has zero unexplained raw visual values.
- The deprecated `Card` path is no longer importable.
- Dead token names no longer exist unless actively used and documented.
- The audit catches intentionally introduced violations.
- The changed surface is registered as a clean zone.
- Desktop and mobile manual screenshots prove the intended hierarchy.
- The final report lists files deleted, exports removed, and styling
  paths eliminated — not just tokens added.

## Merge posture

**Product: PASS** — this removes a recurring source of product
inconsistency rather than introducing another cosmetic layer.

**Technical: REQUEST CHANGES unless deletion is explicit** — do not start
a Scout token-swap branch while the duplicate `Card`, dead tokens, and
audit blind spots remain intact.

**Recommended order:**

```text
1. fix/theme-enforcement-and-primitive-convergence
2. fix/scout-theme-convergence
3. fix/direct-connect-theme-convergence
4. fix/community-theme-convergence
5. fix/exchange-chrome-theme-convergence
```

## Explicit exclusions

Do not, as part of this packet:

- Invent new surface/border/shadow/radius tokens — the existing set is
  sufficient for every gap found.
- Touch `ScoutOS.tsx`, `ScoutThread.tsx`, `ScoutInput.tsx`, `AppShell.tsx`,
  `navigation.tsx`, `MobileAppBar.tsx`, or any other file already
  correctly wired.
- Add a light theme — this app is dark-only by design, confirmed at the
  source.
- Change the locked charcoal palette itself, or any of the six defined
  theme palettes in `themes.ts`.
- Expand Exchange beyond page-shell/header/filter/grid chrome.

## Apply posture

`applyAuthorized: false`

Next required human confirmations before Lane 1 can start:

1. Canonical `Card` decision — `components/ui/card.tsx` (shadcn,
   CSS-class-based) or `PagePrimitives.tsx` (Tailwind-arbitrary-based)?
   Lane 1 cannot proceed without this.
2. Dead-token disposition — delete all four, or does `--border-focus`
   get wired into the real focus-ring rule instead of deleted?
3. Confirm the 5-lane branch sequence above, or reorder.
4. Confirm Admin stays fully out of scope across all 5 lanes (staff-only,
   lowest priority per the original visual audit).
