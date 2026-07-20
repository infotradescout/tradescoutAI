# Core app design-token adoption — Selective Inheritance packet

Status: `review_required`

Observed: 2026-07-20

This packet stages a design-token adoption plan for operator review. It does
not authorize any code change. Every finding below is sourced directly from
the repo (file paths, line numbers, git history) — nothing here is a
guess about what the app looks like.

## Correction to the initial framing

The original visual audit (see chat history, same date) assumed the core
app had no elevation/surface system and proposed inventing one. That
assumption was wrong and is retracted. A comprehensive token system already
exists, was deliberately designed, and is documented. The real problem is
**inconsistent adoption**, not absence. This packet replaces "build a
design system" with "close a tracked adoption gap and fix the two blind
spots that let it go unnoticed."

## Primary sources

1. `client/src/index.css` — `@layer base { :root { ... } }`, lines 836–1055
   (the token definitions themselves)
2. `client/src/lib/themes.ts` — `applyTheme()` (line 382), `LOCKED_TRADESCOUT_THEME_ID`
   (line 64) — the runtime layer that actually injects token values
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

Two component-level abstractions already wire these correctly:
- `<Card>` (`components/ui/card.tsx`) → `.ts-card` → tokens. Using it gets
  correct elevation for free.
- `Page`/`Section`/`Card` (`components/layout/PagePrimitives.tsx`) — a
  second, independent primitive set wired to the same tokens via Tailwind
  arbitrary values. (Two parallel abstractions existing side by side is
  itself worth a note — see Candidate 5.)

This app is intentionally dark-only (6 charcoal-family palettes, no light
theme, `LOCKED_TRADESCOUT_THEME_ID = "charcoal"` re-asserted on every load).
No light-theme work is in scope anywhere in this packet.

## Adoption-gap candidates

### Candidate 1 — Scout home screen has zero token adoption

- Value: `client/src/scout/ScoutHome.tsx` (1,562 lines) contains **zero**
  references to any `--surface-*`/`--border-*` token and **zero** `<Card>`
  usage. It uses raw `zinc-950/800/300/400` Tailwind classes and inline
  `bg-[radial-gradient(...)]` / `shadow-[...]` throughout.
- Confidence: `0.98` (direct grep count, not inference)
- Verified evidence: yes — file content + absence confirmed by search
- Note: this is the file the earlier visual audit screenshotted as
  "Scout" and flagged as inconsistent with its own sibling files.
  `ScoutOS.tsx` and `ScoutThread.tsx` — in the same `client/src/scout/`
  folder — are deeply token-wired (their own `.scout-shell-refined`
  override block at index.css:4086). `ScoutHome.tsx` was created
  **2026-05-11, five months after** the Dec 2025 theme lock, so this
  cannot be explained as "predates the system." No document anywhere
  (including `docs/reference/theme/THEME_SYSTEM.md`, which lists every
  other file in this folder) mentions `ScoutHome.tsx`. This reads as an
  oversight, not a deliberate exemption.
- Apply rule: migrate `ScoutHome.tsx` onto the existing tokens and
  `<Card>` primitive. No new tokens needed.

### Candidate 2 — Exchange page chrome has zero token adoption at the page-composition level

- Value: `client/src/pages/exchange.tsx` outer wrapper and page chrome
  (header bar, filter pills, category grid container) uses raw
  `bg-black/30`, `bg-white/5`, `border-white/10` etc. — not tokens.
- Confidence: `0.95`
- Verified evidence: yes — `docs/audits/ui-surface-audit.md` (an
  existing, already-checked-in report) independently lists
  `exchange.tsx` as the **#3 raw-background offender in the app**, 139
  hits, corroborating the direct-audit finding from a second source.
- Note: this file's *inner* content (listing cards) already uses
  `<Card>` 40 times and inherits tokens correctly — the gap is
  specifically page-level chrome, not everything in the file. This gap
  is also the one deferral the project's own history explicitly
  documents: `docs/history/2026/THEME_LOCK_COMPLETE.md` says Community/
  Contractors/Tasks/Helpers/etc. were deliberately deferred and lists
  them as a follow-up that was never completed. This is a known,
  tracked debt, not a new problem.
- Apply rule: migrate the outer chrome to the existing tokens; leave
  the already-correct `<Card>` usage untouched.

### Candidate 3 — Partial adoption in Direct Connect and Community leaks untokenized values

- Value: `client/src/pages/direct-connect/DirectConnectShell.tsx` has 76
  token references (heavy adoption) but also 9 raw arbitrary-value
  classes (`bg-white`, `bg-zinc-950`, `bg-white/18`, `bg-white/10`,
  `bg-black/70`, `bg-black/25`, etc.) mixed in. `community-feed.tsx` has
  22 token references plus 10 raw arbitrary values
  (`bg-white/5` ×4, `bg-white` ×2, `bg-black/20` ×2, `bg-black/18` ×2).
- Confidence: `0.9`
- Verified evidence: yes — direct grep counts on both files
- Note: this is very likely the specific mechanism behind the "three
  different surface tones on one screen" symptom the original visual
  audit observed on Community (main card vs. composer vs. sidebar) —
  each raw value is its own one-off tone rather than a shared token.
- Apply rule: replace each raw value with the token layer it's
  approximating (e.g. `bg-white/5` → `bg-[color:var(--surface-intermediate)]`
  or the equivalent `<Card>`/`PagePrimitives` usage), case by case —
  this is a cleanup pass, not a redesign.

### Candidate 4 — Four dead tokens, one of them documented as load-bearing but silently unused

- Value: `--bg-tertiary`, `--bg-quaternary`, `--orange-primary` (index.css
  891-893) are defined once and never referenced anywhere else in the
  codebase. `--border-focus` (index.css:890) is one of three
  "interaction state" tokens named explicitly in
  `THEME_QUICK_REFERENCE.md`, but every actual focus ring in the app
  uses `--theme-accent-primary` directly instead (`.ts-control:focus`,
  index.css:1303-1310) — the documented token was never wired to real
  usage.
- Confidence: `0.95`
- Verified evidence: yes — grep confirms zero consumers for the first
  three; direct comparison of the focus-ring CSS rule against the
  documented token confirms the fourth.
- Apply rule: either delete the three unused tokens (simplification) or
  wire `--border-focus` into the real focus-ring rule and drop the
  direct `--theme-accent-primary` reference — pick one; don't do both
  ambiguously. Low risk either way since nothing currently depends on
  the current (broken) state.

### Candidate 5 — Two parallel Card abstractions exist side by side

- Value: `components/ui/card.tsx` (shadcn, CSS-class-based via
  `.ts-card`) and `components/layout/PagePrimitives.tsx` (Tailwind
  arbitrary-value-based) both wire the same underlying tokens through
  two different mechanisms.
- Confidence: `0.85`
- Verified evidence: yes — both files read directly
- Note: not necessarily a bug (both currently resolve to the same
  values), but it's two things a future contributor has to know about
  to stay consistent, and it's an ambient source of the same "which
  gray is this supposed to be" drift as Candidate 3. Flagging for a
  decision, not proposing removal of either without confirmation.
- Apply rule: no code change without operator input — see open
  questions below.

### Candidate 6 — Both existing enforcement scripts have blind spots that let Candidates 1 and 2 go unnoticed

- Value: `scripts/audit-theme-lock.mjs` flags raw 6-digit hex colors but
  is structurally blind to Tailwind utility classes (`bg-zinc-950`,
  `bg-black/30` are not hex codes) — and it explicitly exempts any file
  whose name substring-matches `"Scout"`, which also matches
  `ScoutHome.tsx` even though that file is the actual offender.
  `scripts/ui-surface-audit.mjs` only walks `client/src/pages/**` and
  never scans `client/src/scout/**` at all, so it can catch Exchange
  (and does — see Candidate 2) but structurally cannot ever catch
  ScoutHome.tsx regardless of its content.
- Confidence: `0.95`
- Verified evidence: yes — both scripts read in full
- Apply rule: narrow the Scout exemption in `audit-theme-lock.mjs` to
  the specific files it was meant for (`ScoutInput`, the chat shell
  files) instead of a bare substring match, and extend
  `ui-surface-audit.mjs`'s scan path to include `client/src/scout/**`.
  Without this, Candidates 1 and 2 will silently regress the next time
  someone touches these files.

## Explicit exclusions

Do not, as part of this packet:

- Invent new surface/border/shadow/radius tokens — the existing set is
  sufficient for every gap found
- Touch `ScoutOS.tsx`, `ScoutThread.tsx`, `ScoutInput.tsx`, `AppShell.tsx`,
  `navigation.tsx`, `MobileAppBar.tsx`, or any other file already
  correctly wired — this packet only touches confirmed gaps
- Add a light theme — this app is dark-only by design, confirmed at
  the source (`themes.ts`, zero `prefers-color-scheme`/`data-theme="light"`
  matches anywhere in `client/src`)
- Change the locked charcoal palette itself, or any of the six defined
  theme palettes in `themes.ts`
- Resolve Candidate 5 (the two parallel Card abstractions) without an
  explicit decision — see open questions

## Apply posture

`applyAuthorized: false`

Next required human confirmations:

1. Sequence — start with Candidate 1 (Scout, undocumented oversight,
   zero adoption) or Candidate 2 (Exchange, documented deferral, zero
   adoption at chrome level)? Both are self-contained and independent.
2. Candidate 3 (Direct Connect / Community leak cleanup) — bundle with
   Candidates 1–2, or treat as its own smaller follow-up pass?
3. Candidate 4 (dead tokens) — delete the three unused ones, or attempt
   to find their original intended use first? For `--border-focus`:
   wire it in, or formally retire it in favor of
   `--theme-accent-primary`?
4. Candidate 5 (two Card abstractions) — standardize on one
   (`components/ui/card.tsx` or `PagePrimitives.tsx`) and migrate the
   other's consumers, or leave both and just document when to use
   which?
5. Candidate 6 (audit-script blind spots) — fix now alongside the
   content changes (so regressions get caught immediately), or as a
   separate PR?
