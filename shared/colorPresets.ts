/**
 * Color Scheme Presets for User Profile Customization
 *
 * YOUR PROFILE IS YOUR WEBSITE
 * ============================
 * Every TradeScout user profile functions as a complete, customizable website.
 * When visitors view a public profile, they see:
 * - The user's selected color scheme applied to the entire page
 * - Content and layout automatically generated based on user types
 * - Activity, reviews, and listings that build reputation
 * - A shareable URL that replaces the need for a traditional website
 *
 * This system allows professionals to have a web presence without:
 * - Building and maintaining a separate website
 * - Paying for hosting or domain names
 * - Learning web development
 * - Managing multiple platforms
 *
 * Users can select a preset or create their own custom color scheme.
 * Eligible, published profiles can be included in Scout discovery.
 */

export interface ColorScheme {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  // Optional richer tokens used by the in-app palette editor (not required by legacy profile renderer).
  surface?: string;
  textMuted?: string;
  accent?: string;
  border?: string;
}

export type ProfileBrandColors = {
  primary: string;
  primaryDark: string;
  accent: string;
  secondary: string;
  background: string;
  surface: string;
};

export const COLOR_PRESETS: Record<string, ColorScheme> = {
  default: {
    primary: "#f97316", // ts-orange (matches landing)
    secondary: "#fb923c", // ts-orange-light
    // Match the universal "charcoal" default theme (neutral, not navy/blue-cast).
    background: "#07090B", // --ts-bg (charcoal)
    surface: "#111418", // --ts-surface (charcoal)
    text: "#ffffff", // Pure white (matches landing)
    textMuted: "rgba(255,255,255,0.70)", // white/70 (matches landing)
    accent: "#f97316",
    border: "rgba(255,255,255,0.10)",
  },
  warm: {
    primary: "#dc2626", // Red
    secondary: "#f59e0b", // Amber
    background: "#1c1917", // Warm Dark
    text: "#fef3c7", // Warm Light
    accent: "#fb923c", // Orange
    border: "#292524", // Warm Border
  },
  cool: {
    primary: "#3b82f6", // Blue
    secondary: "#06b6d4", // Cyan
    background: "#0c1222", // Cool Dark
    text: "#e0f2fe", // Cool Light
    accent: "#0284c7", // Sky
    border: "#1e3a5f", // Blue Border
  },
  vibrant: {
    primary: "#ec4899", // Pink
    secondary: "#a855f7", // Purple
    background: "#18181b", // Deep Dark
    text: "#fdf4ff", // Light Purple
    accent: "#d946ef", // Fuchsia
    border: "#3f3f46", // Gray Border
  },
  minimal: {
    primary: "#64748b", // Slate
    secondary: "#94a3b8", // Light Slate
    background: "#0f172a", // Slate Dark
    text: "#f1f5f9", // Slate Light
    accent: "#475569", // Medium Slate
    border: "#1e293b", // Slate Border
  },
  forest: {
    primary: "#10b981", // Emerald
    secondary: "#34d399", // Light Emerald
    background: "#064e3b", // Forest Dark
    text: "#d1fae5", // Mint Light
    accent: "#059669", // Deep Green
    border: "#065f46", // Forest Border
  },
  sunset: {
    primary: "#f59e0b", // Amber
    secondary: "#fbbf24", // Yellow
    background: "#451a03", // Brown Dark
    text: "#fef3c7", // Amber Light
    accent: "#d97706", // Orange
    border: "#78350f", // Brown Border
  },
  ocean: {
    primary: "#0ea5e9", // Sky Blue
    secondary: "#22d3ee", // Cyan
    background: "#0c4a6e", // Ocean Dark
    text: "#e0f2fe", // Sky Light
    accent: "#0284c7", // Deep Blue
    border: "#075985", // Ocean Border
  },
  royal: {
    primary: "#8b5cf6", // Violet
    secondary: "#a78bfa", // Light Violet
    background: "#2e1065", // Purple Dark
    text: "#f3e8ff", // Violet Light
    accent: "#7c3aed", // Deep Purple
    border: "#4c1d95", // Purple Border
  },
};

export const DEFAULT_COLOR_SCHEME = COLOR_PRESETS.default;

const isSixDigitHex = (color: unknown): color is string =>
  typeof color === "string" && /^#[0-9A-F]{6}$/i.test(color);

/**
 * Resolve a palette into the six-digit tokens accepted by profile persistence.
 * A preset without an explicit surface uses that preset's own background.
 */
export function getProfileBrandColorsForPreset(presetName: string): ProfileBrandColors {
  const fallback = COLOR_PRESETS.default;
  const preset = COLOR_PRESETS[presetName] || fallback;
  const primary = isSixDigitHex(preset.primary) ? preset.primary : fallback.primary;
  const secondary = isSixDigitHex(preset.secondary) ? preset.secondary : fallback.secondary;
  const background = isSixDigitHex(preset.background) ? preset.background : fallback.background;
  const surfaceCandidate = preset.surface || preset.background;

  return {
    primary,
    primaryDark: primary,
    accent: isSixDigitHex(preset.accent) ? preset.accent : primary,
    secondary,
    background,
    surface: isSixDigitHex(surfaceCandidate) ? surfaceCandidate : background,
  };
}

/**
 * Get color scheme from user preferences or default
 */
export function getUserColorScheme(preferences?: any): ColorScheme {
  if (!preferences?.colorScheme) {
    return DEFAULT_COLOR_SCHEME;
  }

  const { preset, primary, secondary, background, text } = preferences.colorScheme;

  // If custom colors are provided, use them
  if (preset === "custom" && primary && secondary && background && text) {
    return {
      primary,
      secondary,
      background,
      text,
      accent: primary,
      border: background,
    };
  }

  // Otherwise use preset
  return COLOR_PRESETS[preset] || DEFAULT_COLOR_SCHEME;
}

/**
 * Generate CSS custom properties string from color scheme
 */
export function generateColorCSS(colorScheme: ColorScheme): string {
  return `
    --user-primary: ${colorScheme.primary};
    --user-secondary: ${colorScheme.secondary};
    --user-background: ${colorScheme.background};
    --user-text: ${colorScheme.text};
    --user-accent: ${colorScheme.accent || colorScheme.primary};
    --user-border: ${colorScheme.border || colorScheme.background};
  `.trim();
}

/**
 * Validate hex color format
 */
export function isValidHexColor(color: string): boolean {
  // Allow 6-digit or 8-digit hex (with alpha) to match preset usage
  return /^#[0-9A-F]{6}([0-9A-F]{2})?$/i.test(color);
}

/**
 * Get preset names for UI selection
 */
export function getPresetNames(): string[] {
  return Object.keys(COLOR_PRESETS);
}
