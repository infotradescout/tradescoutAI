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

export interface ThemeColors {
  // Background Colors - All Customizable
  bgPrimary: string;      // Page background (charcoal-800 by default)
  bgSecondary: string;    // Cards, inputs, modals (charcoal-700 by default)
  bgTertiary: string;     // Nav bars (charcoal-900 by default)
  bgGradient?: string;    // Optional custom gradient
  
  // Text Colors - All Customizable
  textPrimary: string;    // Main text
  textSecondary: string;  // Muted text
  
  // Accent Colors - All Customizable
  accentPrimary: string;   // Main accent color
  accentSecondary: string; // Darker accent
  accentTertiary?: string; // Lighter accent
  
  // Border Colors - All Customizable
  borderPrimary: string;   // Main borders
  borderSecondary?: string; // Secondary borders
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
  backgroundGradient?: string; // Optional full-page gradient override
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
      bgPrimary: '#121722',      // charcoal-800
      bgSecondary: '#1a2030',    // charcoal-700
      bgTertiary: '#0b0e13',     // charcoal-900
      textPrimary: '#f1f5f9',    // Light text
      textSecondary: '#cbd5e1',  // Muted text
      accentPrimary: 'hsl(25, 85%, 54%)',    // Orange
      accentSecondary: 'hsl(19, 80%, 47%)',  // Dark orange
      accentTertiary: 'hsl(27, 85%, 60%)',   // Light orange
      borderPrimary: '#2d3645',
      borderSecondary: '#1a2030',
    },
    backgroundGradient: 'linear-gradient(135deg, #121722, #1a2030)',
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
  
  // Background colors - ALL CUSTOMIZABLE
  root.style.setProperty('--theme-bg-primary', theme.colors.bgPrimary);
  root.style.setProperty('--theme-bg-secondary', theme.colors.bgSecondary);
  root.style.setProperty('--theme-bg-quaternary', theme.colors.bgTertiary);
  
  // Text colors - ALL CUSTOMIZABLE
  root.style.setProperty('--theme-text-primary', theme.colors.textPrimary);
  root.style.setProperty('--theme-text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--theme-text-muted', theme.colors.textSecondary);
  
  // Accent colors - ALL CUSTOMIZABLE
  root.style.setProperty('--theme-accent-primary', theme.colors.accentPrimary);
  root.style.setProperty('--theme-accent-secondary', theme.colors.accentSecondary);
  if (theme.colors.accentTertiary) {
    root.style.setProperty('--theme-accent-tertiary', theme.colors.accentTertiary);
  }
  
  // Border colors - ALL CUSTOMIZABLE
  root.style.setProperty('--theme-border-primary', theme.colors.borderPrimary);
  root.style.setProperty('--theme-border-secondary', 
    theme.colors.borderSecondary || theme.colors.bgSecondary);
  
  // Background gradient - OPTIONAL OVERRIDE
  if (theme.backgroundGradient) {
    root.style.setProperty('--theme-bg-gradient', theme.backgroundGradient);
  } else if (theme.colors.bgGradient) {
    root.style.setProperty('--theme-bg-gradient', theme.colors.bgGradient);
  } else {
    root.style.setProperty('--theme-bg-gradient', 
      `linear-gradient(135deg, ${theme.colors.bgPrimary}, ${theme.colors.bgSecondary})`);
  };
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
