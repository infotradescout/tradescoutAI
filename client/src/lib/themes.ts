/**
 * TradeScout Universal Theme System
 * 
 * Users can fully customize ALL colors including the charcoal base.
 * Charcoal is the DEFAULT but users can replace every color.
 * 
 * 3-Layer Color Hierarchy (all customizable):
 * - bgTertiary (charcoal-900): Structural chrome (top/bottom nav bars only)
 * - bgPrimary (charcoal-800): Primary canvas (page backgrounds)
 * - bgSecondary (charcoal-700): Interactive surfaces (cards, inputs, dropdowns)
 */

// Backwards-compatible Theme shape used by ThemeContext and settings.
// Internally we now drive a semantic token contract (ThemeTokens) but keep
// this interface so existing code continues to compile.
export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgGradient?: string;
  textPrimary: string;
  textSecondary: string;
  accentPrimary: string;
  accentSecondary: string;
  accentTertiary?: string;
  borderPrimary: string;
  borderSecondary?: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
  backgroundGradient?: string;
}

// New semantic token contract for 6 locked theme IDs.
export type ThemeId =
  | "charcoal"
  | "graphite"
  | "sand"
  | "sage"
  | "midnight"
  | "ember";

export type ThemeTokens = {
  "--ts-bg": string;
  "--ts-surface": string;
  "--ts-surface-strong": string;
  "--ts-surface-hover": string;
  "--ts-border-subtle": string;
  "--ts-border-strong": string;
  "--ts-text": string;
  "--ts-text-muted": string;
  "--ts-accent": string;
  "--ts-accent-strong": string;
  "--ts-accent-soft": string;
  "--ts-text-on-accent": string;
  "--ts-input-bg": string;
  "--ts-input-border": string;
  "--ts-focus-ring": string;
  "--ts-success": string;
  "--ts-warning": string;
  "--ts-danger": string;
  "--ts-shadow-soft": string;
};

export const THEME_IDS: ThemeId[] = [
  "charcoal",
  "graphite",
  "sand",
  "sage",
  "midnight",
  "ember",
];

export const THEME_LABELS: Record<ThemeId, string> = {
  charcoal: "Charcoal",
  graphite: "Graphite",
  sand: "Sand",
  sage: "Sage",
  midnight: "Midnight",
  ember: "Ember",
};

export const THEMES: Record<ThemeId, ThemeTokens> = {
  charcoal: {
    "--ts-bg": "#0B0F14",
    "--ts-surface": "#121A24",
    "--ts-surface-strong": "#0F1620",
    "--ts-surface-hover": "#1A2432",
    "--ts-border-subtle": "rgba(255,255,255,0.10)",
    "--ts-border-strong": "rgba(255,255,255,0.18)",
    "--ts-text": "#E6EDF6",
    "--ts-text-muted": "rgba(230,237,246,0.68)",
    "--ts-accent": "#FF6A00",
    "--ts-accent-strong": "#FF8A3D",
    "--ts-accent-soft": "rgba(255,106,0,0.16)",
    "--ts-text-on-accent": "#0B0F14",
    "--ts-input-bg": "#0F1620",
    "--ts-input-border": "rgba(255,255,255,0.14)",
    "--ts-focus-ring": "rgba(255,106,0,0.55)",
    "--ts-success": "#22C55E",
    "--ts-warning": "#F59E0B",
    "--ts-danger": "#EF4444",
    "--ts-shadow-soft": "0 10px 30px rgba(0,0,0,0.45)",
  },
  graphite: {
    "--ts-bg": "#10141B",
    "--ts-surface": "#171E29",
    "--ts-surface-strong": "#121824",
    "--ts-surface-hover": "#202A3A",
    "--ts-border-subtle": "rgba(255,255,255,0.10)",
    "--ts-border-strong": "rgba(255,255,255,0.18)",
    "--ts-text": "#EEF2F8",
    "--ts-text-muted": "rgba(238,242,248,0.70)",
    "--ts-accent": "#FF6A00",
    "--ts-accent-strong": "#FF8A3D",
    "--ts-accent-soft": "rgba(255,106,0,0.14)",
    "--ts-text-on-accent": "#10141B",
    "--ts-input-bg": "#121824",
    "--ts-input-border": "rgba(255,255,255,0.14)",
    "--ts-focus-ring": "rgba(255,106,0,0.55)",
    "--ts-success": "#22C55E",
    "--ts-warning": "#F59E0B",
    "--ts-danger": "#EF4444",
    "--ts-shadow-soft": "0 10px 30px rgba(0,0,0,0.40)",
  },
  sand: {
    "--ts-bg": "#0E1116",
    "--ts-surface": "#141A22",
    "--ts-surface-strong": "#0F141B",
    "--ts-surface-hover": "#1B2330",
    "--ts-border-subtle": "rgba(255,255,255,0.10)",
    "--ts-border-strong": "rgba(255,255,255,0.18)",
    "--ts-text": "#F3F1EA",
    "--ts-text-muted": "rgba(243,241,234,0.68)",
    "--ts-accent": "#D97706",
    "--ts-accent-strong": "#F59E0B",
    "--ts-accent-soft": "rgba(217,119,6,0.16)",
    "--ts-text-on-accent": "#0E1116",
    "--ts-input-bg": "#0F141B",
    "--ts-input-border": "rgba(255,255,255,0.14)",
    "--ts-focus-ring": "rgba(245,158,11,0.55)",
    "--ts-success": "#22C55E",
    "--ts-warning": "#F59E0B",
    "--ts-danger": "#EF4444",
    "--ts-shadow-soft": "0 10px 30px rgba(0,0,0,0.45)",
  },
  sage: {
    "--ts-bg": "#0B1110",
    "--ts-surface": "#111B19",
    "--ts-surface-strong": "#0E1715",
    "--ts-surface-hover": "#192623",
    "--ts-border-subtle": "rgba(255,255,255,0.10)",
    "--ts-border-strong": "rgba(255,255,255,0.18)",
    "--ts-text": "#EAF3EF",
    "--ts-text-muted": "rgba(234,243,239,0.70)",
    "--ts-accent": "#34D399",
    "--ts-accent-strong": "#10B981",
    "--ts-accent-soft": "rgba(52,211,153,0.16)",
    "--ts-text-on-accent": "#0B1110",
    "--ts-input-bg": "#0E1715",
    "--ts-input-border": "rgba(255,255,255,0.14)",
    "--ts-focus-ring": "rgba(16,185,129,0.55)",
    "--ts-success": "#22C55E",
    "--ts-warning": "#F59E0B",
    "--ts-danger": "#EF4444",
    "--ts-shadow-soft": "0 10px 30px rgba(0,0,0,0.45)",
  },
  midnight: {
    "--ts-bg": "#05070A",
    "--ts-surface": "#0B0F14",
    "--ts-surface-strong": "#070A0F",
    "--ts-surface-hover": "#121A24",
    "--ts-border-subtle": "rgba(255,255,255,0.10)",
    "--ts-border-strong": "rgba(255,255,255,0.18)",
    "--ts-text": "#F6F7FB",
    "--ts-text-muted": "rgba(246,247,251,0.68)",
    "--ts-accent": "#60A5FA",
    "--ts-accent-strong": "#3B82F6",
    "--ts-accent-soft": "rgba(96,165,250,0.16)",
    "--ts-text-on-accent": "#05070A",
    "--ts-input-bg": "#070A0F",
    "--ts-input-border": "rgba(255,255,255,0.14)",
    "--ts-focus-ring": "rgba(59,130,246,0.55)",
    "--ts-success": "#22C55E",
    "--ts-warning": "#F59E0B",
    "--ts-danger": "#EF4444",
    "--ts-shadow-soft": "0 10px 30px rgba(0,0,0,0.55)",
  },
  ember: {
    "--ts-bg": "#0B0F14",
    "--ts-surface": "#121A24",
    "--ts-surface-strong": "#0F1620",
    "--ts-surface-hover": "#1A2432",
    "--ts-border-subtle": "rgba(255,255,255,0.10)",
    "--ts-border-strong": "rgba(255,255,255,0.18)",
    "--ts-text": "#FFEFE6",
    "--ts-text-muted": "rgba(255,239,230,0.70)",
    "--ts-accent": "#FB7185",
    "--ts-accent-strong": "#F43F5E",
    "--ts-accent-soft": "rgba(244,63,94,0.16)",
    "--ts-text-on-accent": "#0B0F14",
    "--ts-input-bg": "#0F1620",
    "--ts-input-border": "rgba(255,255,255,0.14)",
    "--ts-focus-ring": "rgba(244,63,94,0.55)",
    "--ts-success": "#22C55E",
    "--ts-warning": "#F59E0B",
    "--ts-danger": "#EF4444",
    "--ts-shadow-soft": "0 10px 30px rgba(0,0,0,0.45)",
  },
};

export function isThemeId(x: unknown): x is ThemeId {
  return typeof x === "string" && (THEME_IDS as string[]).includes(x);
}

/**
 * All available themes for TradeScout
 * NOTE: Users can FULLY CUSTOMIZE all colors including the charcoal base.
 * Charcoal is the default, but users can replace every single color.
 */
export const PRESET_THEMES: Theme[] = [
  // ======== DEFAULT: CHARCOAL (can be customized) ========
  {
    id: 'charcoal',
    name: 'Charcoal (Default)',
    description: 'Default: charcoal system with orange accents. Fully customizable.',
    colors: {
      // Palette: charcoal background + white text + orange accents
      bgPrimary: '#0B0F14',      // Background (Charcoal)
      bgSecondary: '#121A24',    // UI surface
      bgTertiary: '#0F1620',     // Chrome/frame surface
      textPrimary: '#F6F7FB',    // Near-white
      textSecondary: 'rgba(246,247,251,0.70)', // Muted
      accentPrimary: '#FF6A00',  // Orange accent
      accentSecondary: '#FF8A3D', // Accent hover/secondary
      accentTertiary: 'rgba(255,106,0,0.16)',
      borderPrimary: 'rgba(255,255,255,0.12)',
      borderSecondary: 'rgba(255,255,255,0.08)',
    },
    backgroundGradient: 'radial-gradient(1200px 800px at 20% 10%, rgba(255,106,0,0.16), transparent 60%), linear-gradient(180deg, #0B0F14, #0B0F14)',
  },

  // ======== ALTERNATIVE THEMES (users can customize all colors) ========
  {
    id: 'tradescout-blue',
    name: 'TradeScout Blue',
    description: 'Blue accent theme. Customize all colors including backgrounds.',
    colors: {
      bgPrimary: '#0f172a',      // Slate-900
      bgSecondary: '#1e293b',    // Slate-800
      bgTertiary: '#09111f',     // Slate-950
      textPrimary: '#ffffff',
      textSecondary: '#cbd5e1',
      accentPrimary: '#3b82f6',
      accentSecondary: '#1e40af',
      accentTertiary: '#60a5fa',
      borderPrimary: '#334155',
      borderSecondary: '#1e293b',
    },
    backgroundGradient: 'linear-gradient(135deg, #0f172a, #1e293b)',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep midnight blue with cyan accents. All colors customizable.',
    colors: {
      bgPrimary: '#0a0e14',
      bgSecondary: '#141820',
      bgTertiary: '#090b0f',
      textPrimary: '#ffffff',
      textSecondary: '#a8b2d1',
      accentPrimary: '#00d4ff',
      accentSecondary: '#0099cc',
      accentTertiary: '#4de3ff',
      borderPrimary: '#1a2430',
      borderSecondary: '#141820',
    },
  },
  {
    id: 'forest',
    name: 'Forest Green',
    description: 'Forest greens with emerald accents. Fully customizable.',
    colors: {
      bgPrimary: '#0d1b12',
      bgSecondary: '#1a2e23',
      bgTertiary: '#091410',
      textPrimary: '#ffffff',
      textSecondary: '#c5e1d4',
      accentPrimary: '#10b981',
      accentSecondary: '#047857',
      accentTertiary: '#34d399',
      borderPrimary: '#1a3630',
      borderSecondary: '#1a2e23',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm sunset with purple-pink accents. All colors customizable.',
    colors: {
      bgPrimary: '#1a0f1e',
      bgSecondary: '#2d1b33',
      bgTertiary: '#130a16',
      textPrimary: '#ffffff',
      textSecondary: '#e4d4ea',
      accentPrimary: '#e879f9',
      accentSecondary: '#c026d3',
      accentTertiary: '#f0abfc',
      borderPrimary: '#3d2445',
      borderSecondary: '#2d1b33',
    },
  },
  {
    id: 'warm',
    name: 'Warm Amber',
    description: 'Warm browns with amber accents. Customize every color.',
    colors: {
      bgPrimary: '#1c1410',
      bgSecondary: '#2d2318',
      bgTertiary: '#0f0a07',
      textPrimary: '#ffffff',
      textSecondary: '#e7d4c5',
      accentPrimary: '#f59e0b',
      accentSecondary: '#d97706',
      accentTertiary: '#fbbf24',
      borderPrimary: '#3d3020',
      borderSecondary: '#2d2318',
    },
  },
];

/**
 * Apply a theme to the entire site
 * Call this in App.tsx useEffect to initialize or when user changes theme
 * Users can customize ALL colors including backgrounds, text, borders, and accents.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;

  // Drive semantic tokens from the actual active colors (including custom/user themes).
  // This ensures the new UI token layer stays in sync with user customization.
  const bg = theme.colors.bgPrimary;
  const surface = theme.colors.bgSecondary;
  const surfaceStrong = theme.colors.bgTertiary;
  const text = theme.colors.textPrimary;
  const textMuted = theme.colors.textSecondary;
  const accent = theme.colors.accentPrimary;
  const accentStrong = theme.colors.accentSecondary;

  const derivedTokens: Partial<ThemeTokens> = {
    "--ts-bg": bg,
    "--ts-surface": surface,
    "--ts-surface-strong": surfaceStrong,
    "--ts-surface-hover": `color-mix(in oklab, ${surface} 88%, ${text} 12%)`,
    "--ts-border-subtle": `color-mix(in oklab, ${text} 12%, transparent)`,
    "--ts-border-strong": `color-mix(in oklab, ${text} 20%, transparent)`,
    "--ts-text": text,
    "--ts-text-muted": textMuted,
    "--ts-accent": accent,
    "--ts-accent-strong": accentStrong,
    "--ts-accent-soft": `color-mix(in oklab, ${accent} 18%, transparent)`,
    "--ts-text-on-accent": "#0B0F14",
    "--ts-input-bg": surfaceStrong,
    "--ts-input-border": `color-mix(in oklab, ${text} 14%, transparent)`,
    "--ts-focus-ring": `color-mix(in oklab, ${accent} 55%, transparent)`,
    "--ts-success": "#22C55E",
    "--ts-warning": "#F59E0B",
    "--ts-danger": "#EF4444",
    "--ts-shadow-soft": "0 10px 30px rgba(0,0,0,0.45)",
  };

  // Fill any missing tokens from a built-in theme when available.
  const fallbackThemeId: ThemeId = isThemeId(theme.id) ? theme.id : "charcoal";
  const fallback = THEMES[fallbackThemeId];
  const tokens: ThemeTokens = { ...fallback, ...derivedTokens } as ThemeTokens;

  Object.entries(tokens).forEach(([key, value]) => root.style.setProperty(key, value));

  // Maintain legacy --theme-* variables for existing CSS that still
  // references them (e.g. scout-suggestion styles).
  root.style.setProperty('--theme-bg-primary', theme.colors.bgPrimary);
  root.style.setProperty('--theme-bg-secondary', theme.colors.bgSecondary);
  root.style.setProperty('--theme-bg-quaternary', theme.colors.bgTertiary);
  root.style.setProperty('--theme-text-primary', theme.colors.textPrimary);
  root.style.setProperty('--theme-text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--theme-text-muted', theme.colors.textSecondary);
  root.style.setProperty('--theme-accent-primary', theme.colors.accentPrimary);
  root.style.setProperty('--theme-accent-secondary', theme.colors.accentSecondary);
  if (theme.colors.accentTertiary) {
    root.style.setProperty('--theme-accent-tertiary', theme.colors.accentTertiary);
  }
  root.style.setProperty('--theme-border-primary', theme.colors.borderPrimary);
  root.style.setProperty('--theme-border-secondary', theme.colors.borderSecondary || theme.colors.bgSecondary);

  if (theme.backgroundGradient) {
    root.style.setProperty('--theme-bg-gradient', theme.backgroundGradient);
  } else if (theme.colors.bgGradient) {
    root.style.setProperty('--theme-bg-gradient', theme.colors.bgGradient);
  } else {
    root.style.setProperty('--theme-bg-gradient', `linear-gradient(135deg, ${theme.colors.bgPrimary}, ${theme.colors.bgSecondary})`);
  }

  // Save to localStorage for persistence
  try {
    localStorage.setItem('ts-active-theme', theme.id);
  } catch (e) {
    // Ignore localStorage errors (might be disabled or full)
  }
}

/**
 * Get a theme by ID
 */
export function getThemeById(id: string): Theme {
  return PRESET_THEMES.find(t => t.id === id) || PRESET_THEMES[0];
}

/**
 * Get the currently active theme ID from localStorage
 */
export function getActiveThemeId(): string {
  try {
    const stored = localStorage.getItem('ts-active-theme');
    if (stored && PRESET_THEMES.find(t => t.id === stored)) {
      return stored;
    }
  } catch (e) {
    // Ignore
  }
  return 'charcoal'; // Always default to charcoal
}

/**
 * Initialize theme on app startup
 * Call this once in your App.tsx useEffect with empty dependency array
 * 
 * Example:
 * useEffect(() => {
 *   initializeTheme();
 * }, []);
 */
export function initializeTheme() {
  const themeId = getActiveThemeId();
  const theme = getThemeById(themeId);
  applyTheme(theme);
}

/**
 * Create a completely custom theme with full control over all colors
 * Users can override the charcoal base and customize EVERYTHING
 * 
 * Example:
 * const myTheme = createCustomTheme('my-theme', {
 *   bgPrimary: '#1a1a2e',
 *   bgSecondary: '#16213e',
 *   bgTertiary: '#0f3460',
 *   textPrimary: '#eaeaea',
 *   textSecondary: '#aaaaaa',
 *   accentPrimary: '#e94560',
 *   accentSecondary: '#c92c3d',
 *   borderPrimary: '#2a3d56',
 * });
 * applyTheme(myTheme);
 */
export function createCustomTheme(
  id: string,
  colors: Partial<ThemeColors> & {
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    textPrimary: string;
    textSecondary: string;
    accentPrimary: string;
    accentSecondary: string;
    borderPrimary: string;
  },
  options?: {
    name?: string;
    description?: string;
    backgroundGradient?: string;
  }
): Theme {
  return {
    id,
    name: options?.name || 'Custom Theme',
    description: options?.description || 'Custom color theme',
    colors: {
      accentTertiary: colors.accentSecondary,
      borderSecondary: colors.borderPrimary,
      ...colors,
    },
    backgroundGradient: options?.backgroundGradient,
  };
}
