import type { CSSProperties } from "react";
import { JW_STONE_SOCIAL_PRESENTATION } from "@shared/jwStonePresentation";

/** Same color logo used by `/u/jw-stone` centered-brand header — never invert-whiten. */
export const JW_STONE_LOGO_URL = JW_STONE_SOCIAL_PRESENTATION.logoUrl;

/**
 * Canonical JW Stone marketplace brand tokens.
 *
 * Confirmed sources (do not invent):
 * - logo / social mark olive `#81904a` — `JW_STONE_SOCIAL_PRESENTATION.accentColor`,
 *   logo.svg mark, migrations/0110, social-preview contract tests
 * - marketplace UI accent `#a8b86c` — lighter olive for CTAs/chrome (owner: `#81904a` too dark)
 * - secondary `#6d6c69` — logo.svg / logo-social.svg checker squares
 * - ink `#171717` / muted `#4c4c4c` — logo wordmark + tagline fills
 * - display type: `font-editorial` (Cormorant/Georgia) matches logo Georgia wordmark
 * - header chrome: light ground + color logo (WholesalerProfileTheme JW path)
 * - catalog ground: warm ivory (owner luxury layout) — not wholesaler cream `#f7f4ec`
 * - First Cut bar: deep charcoal (not absolute black)
 *
 * Rejected as JW brand: wholesaler theme defaults navy `#0e3a5c` / gold `#b3892b`
 * / cream surface `#f7f4ec` (generic WholesalerProfileTheme fallback, not JW logo).
 */
export const JW_STONE_BRAND = {
  /** Lighter UI olive for CTAs and accents — not the darker logo mark. */
  accent: "#a8b86c",
  /** Logo / social mark olive kept for reference and profile parity. */
  mark: JW_STONE_SOCIAL_PRESENTATION.accentColor,
  secondary: "#6d6c69",
  ink: "#171717",
  muted: "#4c4c4c",
  /** Warm ivory catalog / page ground. */
  background: "#f5f0e6",
  /** Slightly deeper ivory for elevated surfaces / cards. */
  surface: "#faf6ee",
  /** Deep charcoal — First Cut / dark bars (not absolute black). */
  dark: "#2a2724",
  darkElevated: "#35322e",
  onAccent: "#171717",
  onDark: "#faf6ee",
  border: "#ddd4c4",
  borderStrong: "#b8ae9c",
} as const;

export const JW_STONE_BRAND_STYLE = {
  "--jw-accent": JW_STONE_BRAND.accent,
  "--jw-mark": JW_STONE_BRAND.mark,
  "--jw-secondary": JW_STONE_BRAND.secondary,
  "--jw-ink": JW_STONE_BRAND.ink,
  "--jw-muted": JW_STONE_BRAND.muted,
  "--jw-bg": JW_STONE_BRAND.background,
  "--jw-surface": JW_STONE_BRAND.surface,
  "--jw-dark": JW_STONE_BRAND.dark,
  "--jw-dark-elevated": JW_STONE_BRAND.darkElevated,
  "--jw-on-accent": JW_STONE_BRAND.onAccent,
  "--jw-on-dark": JW_STONE_BRAND.onDark,
  "--jw-border": JW_STONE_BRAND.border,
  "--jw-border-strong": JW_STONE_BRAND.borderStrong,
} as CSSProperties;

/** Shared chrome class fragments; colors resolve from CSS vars on the marketplace root. */
export const jw = {
  page: "bg-[var(--jw-bg)] font-sans text-[var(--jw-ink)]",
  darkBar: "bg-[var(--jw-dark)] text-[var(--jw-on-dark)]",
  darkElevated: "bg-[var(--jw-dark-elevated)] text-[var(--jw-on-dark)]",
  surface: "bg-[var(--jw-surface)]",
  border: "border-[var(--jw-border)]",
  borderStrong: "border-[var(--jw-border-strong)]",
  muted: "text-[var(--jw-muted)]",
  accentCta:
    "bg-[var(--jw-accent)] font-bold text-[var(--jw-on-accent)] transition-[filter] hover:brightness-95",
  darkCta:
    "bg-[var(--jw-dark)] font-bold text-[var(--jw-on-dark)] transition-colors hover:bg-[#1f1d1b]",
  ghostOnDark:
    "border border-white/25 font-semibold text-[var(--jw-on-dark)] transition-colors hover:border-white/55 hover:bg-white/5",
  ghostOnLight:
    "border border-[var(--jw-border-strong)] font-semibold text-[var(--jw-ink)] transition-colors hover:border-[var(--jw-ink)] hover:bg-[var(--jw-surface)]",
  field:
    "border border-[var(--jw-border)] bg-[var(--jw-surface)] text-[var(--jw-ink)] outline-none [color-scheme:light] placeholder:text-[var(--jw-muted)] focus:border-[var(--jw-accent)]",
  /** Sticky header offset — match header h-14 / sm:h-[4.25rem] so prior sections do not peek. */
  scrollTarget: "scroll-mt-14 sm:scroll-mt-[4.25rem]",
} as const;
