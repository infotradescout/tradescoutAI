# Evidence index — branch `fix/tradescout-landing-logo`

Plain-language summary of what changed, what's proven, and what's still open,
for Thomas to review before asking ISSA to sign off.

## 1. TradeScout landing page logo (2026-07-25)

**What changed:** The public landing page header (`/`) was showing a fake
"TS" text-in-a-box mark instead of the real TradeScout circle logo. Also
removed some leftover AI-drafted filler copy (a header explainer line, a
hero kicker line, and a row of trust-claim pills) that read as generic
placeholder text rather than real product copy.

- Source change: `client/src/pages/TradeScoutLandingPage.tsx` and
  `client/src/pages/TradeScoutLandingPage.css`
- Commit: `26472711` "Restore TradeScout landing logo and strip AI filler."
  (already committed and pushed to `origin/fix/tradescout-landing-logo`)

**Proof (this folder, `2026-07-25-tradescout-landing-logo/`):** captured
2026-07-25 against a local `npm run dev` server (port 5000) with Playwright/
Chromium, both viewports:
- `landing-desktop-header.png` / `landing-mobile-header.png` — header/hero
  crop showing the real circle logo mark, no "TS" placeholder, no leftover
  kicker/trust-pill filler text.
- `landing-desktop-fullpage.png` / `landing-mobile-fullpage.png` — full
  scroll of the landing page for context.
- `issa-build-regression-check-desktop.png` / `-mobile.png` — spot check
  that the unrelated ISSA Build profile page (`/u/issa-build`) still renders
  correctly after this change (it shares no code with the landing page, but
  checked anyway since both routes are on this branch).

**What this proves:** the real logo renders correctly in a live browser at
both desktop and mobile widths, on real component code, with no console
errors from the change itself. What it does NOT prove: how it looks on an
actual phone (screen glare, safe-area insets, real touch chrome) — that
still needs Thomas's physical-device review.

**Known non-blocking noise:** the browser console logs a React dev-only
warning about a `fetchPriority` prop on the new `<img>` tag. This is an
existing repo-wide pattern (same camelCase usage already exists in
`ProFabProfileTheme.tsx` and `WholesalerProfileTheme.tsx`), not something
new introduced by this fix, and it does not affect what renders on screen.
Left as-is to match existing convention; flagging here so it's not mistaken
for a new regression.

## 2. ISSA hero video — Gemini watermark crop (2026-07-24, already merged)

**What changed:** The ISSA Build profile hero video (`/u/issa-build`) had a
small AI-generation watermark (a faint 4-point sparkle/star) visible in the
bottom-right corner of the video frame. The crop/frame was adjusted to
remove it.

- Commits already on this branch: `6fc92049` "fix(issa): crop Gemini
  watermark from hero video", merged via PR #208 (`2c98a533`).
- This work was **done before today's cycle** and is already merged into
  `fix/tradescout-landing-logo` — it is not new BUILD work from this pass.
  It's included here because ~30 uncommitted QA screenshots from that
  investigation were sitting in the working tree undocumented; this folder
  is the curated, labeled version of that evidence trail.

**Proof (this folder, `2026-07-24-issa-hero-gemini-watermark-crop/`):**
- `before-full-frame.png` / `after-full-frame.png` — full hero frame,
  before vs. after crop.
- `before-br-corner-zoom.png` / `after-br-corner-zoom.png` — zoomed
  bottom-right corner where the watermark was; visible in "before", gone in
  "after".

**What this proves:** the watermark is removed from the frame used in these
captures. What it does NOT prove: every possible video frame/timestamp was
checked, or how it looks on a real phone.

## 3. Process artifacts (not evidence, not committed)

The original investigation produced ~30 additional trial/scratch files
(pixel-offset crop trials at different `br-###` offsets, ffmpeg trial
frames, raw extracted video frames, contrast/diff/mean comparison images,
watermark-candidate scans). These are real but are intermediate
debugging steps, not proof of anything on their own. They're still on disk
at `artifacts/screenshots/issa-hero-*` and `artifacts/issa-hero-frames/`
(untouched, not deleted) but are now `.gitignore`d so they stop showing up
as uncommitted noise. Nothing was deleted.

## Open items requiring Thomas / ISSA directly

1. **Physical-phone review** — not performed here. All mobile evidence
   above is a 390x844 Chromium viewport emulation, not a real device.
2. **ISSA's explicit sign-off** — this package exists to make that
   conversation fast, but the acceptance itself has to come from Thomas
   and ISSA, not from this branch.
3. **Merge/deploy** — this branch is pushed to origin but has NOT been
   merged to `main` and NOT deployed. That's an explicit next step for
   Thomas, not done automatically here.
