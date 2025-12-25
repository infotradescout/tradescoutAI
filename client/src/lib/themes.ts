/**
 * TradeScout Universal Theme System
 * 
 * EVERY PAGE uses Charcoal as the base theme by default.
 * Users can customize via theme selection, but charcoal is the foundation.
 * 
 * 3-Layer Charcoal Hierarchy:
 * - charcoal-900: Structural chrome (top/bottom nav bars only)
 * - charcoal-800: Primary canvas (page backgrounds)
 * - charcoal-700: Interactive surfaces (cards, inputs, dropdowns)
 */

export interface ThemeColors {
  bgPrimary: string;      // Page background
  bgSecondary: string;    // Cards, inputs, modals
  bgTertiary: string;     // Nav bars (charcoal-900 only)
  textPrimary: string;    // Main text
  textSecondary: string;  // Muted text
  accentPrimary: string;  // Main accent color
  accentSecondary: string; // Darker accent
  accentTertiary?: string; // Lighter accent
  border: string;         // Border colors
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
  backgroundGradient?: string;
}

/**
 * All available themes for TradeScout
 * NOTE: Charcoal is always the default. Users can switch, but charcoal is the base.
 */
export const PRESET_THEMES: Theme[] = [
  // ======== DEFAULT: CHARCOAL (3-layer system) ========
  {
    id: 'charcoal',
    name: 'Charcoal (Default)',
    description: 'Universal default: charcoal system with orange accents',
    colors: {
      bgPrimary: '#121722',      // charcoal-800 (page backgrounds)
      bgSecondary: '#1a2030',    // charcoal-700 (cards, inputs)
      bgTertiary: '#0b0e13',     // charcoal-900 (nav bars only)
      textPrimary: '#f1f5f9',    // Light text
      textSecondary: '#cbd5e1',  // Muted text
      accentPrimary: 'hsl(25, 85%, 54%)',    // Orange primary
      accentSecondary: 'hsl(19, 80%, 47%)',  // Orange darker
      accentTertiary: 'hsl(27, 85%, 60%)',   // Orange lighter
      border: '#2d3645',
    },
    backgroundGradient: 'linear-gradient(135deg, #121722, #1a2030)',
  },

  // ======== ALTERNATIVE THEMES (optional) ========
  {
    id: 'tradescout-blue',
    name: 'TradeScout Blue',
    description: 'Charcoal base with blue accents',
    colors: {
      bgPrimary: '#121722',
      bgSecondary: '#1a2030',
      bgTertiary: '#0b0e13',
      textPrimary: '#ffffff',
      textSecondary: '#cbd5e1',
      accentPrimary: '#3b82f6',
      accentSecondary: '#1e40af',
      accentTertiary: '#60a5fa',
      border: '#2d3645',
    },
    backgroundGradient: 'linear-gradient(135deg, #121722, #1a2030)',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep charcoal with cyan accents',
    colors: {
      bgPrimary: '#0a0e14',
      bgSecondary: '#141820',
      bgTertiary: '#090b0f',
      textPrimary: '#ffffff',
      textSecondary: '#a8b2d1',
      accentPrimary: '#00d4ff',
      accentSecondary: '#0099cc',
      accentTertiary: '#4de3ff',
      border: '#1a2430',
    },
  },
  {
    id: 'forest',
    name: 'Forest Green',
    description: 'Charcoal base with emerald accents',
    colors: {
      bgPrimary: '#0d1b12',
      bgSecondary: '#1a2e23',
      bgTertiary: '#091410',
      textPrimary: '#ffffff',
      textSecondary: '#c5e1d4',
      accentPrimary: '#10b981',
      accentSecondary: '#047857',
      accentTertiary: '#34d399',
      border: '#1a3630',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Charcoal base with purple-pink accents',
    colors: {
      bgPrimary: '#1a0f1e',
      bgSecondary: '#2d1b33',
      bgTertiary: '#130a16',
      textPrimary: '#ffffff',
      textSecondary: '#e4d4ea',
      accentPrimary: '#e879f9',
      accentSecondary: '#c026d3',
      accentTertiary: '#f0abfc',
      border: '#3d2445',
    },
  },
  {
    id: 'warm',
    name: 'Warm Amber',
    description: 'Charcoal base with amber accents',
    colors: {
      bgPrimary: '#1c1410',
      bgSecondary: '#2d2318',
      bgTertiary: '#0f0a07',
      textPrimary: '#ffffff',
      textSecondary: '#e7d4c5',
      accentPrimary: '#f59e0b',
      accentSecondary: '#d97706',
      accentTertiary: '#fbbf24',
      border: '#3d3020',
    },
  },
];

/**
 * Apply a theme to the entire site
 * Call this in App.tsx useEffect to initialize or when user changes theme
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  
  // Primary background colors
  root.style.setProperty('--theme-bg-primary', theme.colors.bgPrimary);
  root.style.setProperty('--theme-bg-secondary', theme.colors.bgSecondary);
  root.style.setProperty('--theme-bg-quaternary', theme.colors.bgTertiary);
  
  // Text colors
  root.style.setProperty('--theme-text-primary', theme.colors.textPrimary);
  root.style.setProperty('--theme-text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--theme-text-muted', theme.colors.textSecondary);
  
  // Accent colors
  root.style.setProperty('--theme-accent-primary', theme.colors.accentPrimary);
  root.style.setProperty('--theme-accent-secondary', theme.colors.accentSecondary);
  if (theme.colors.accentTertiary) {
    root.style.setProperty('--theme-accent-tertiary', theme.colors.accentTertiary);
  }
  
  // Borders
  root.style.setProperty('--theme-border-primary', theme.colors.border);
  root.style.setProperty('--theme-border-secondary', theme.colors.bgSecondary);
  
  // Background gradient
  if (theme.backgroundGradient) {
    root.style.setProperty('--theme-bg-gradient', theme.backgroundGradient);
  } else {
    root.style.setProperty('--theme-bg-gradient', 
      `linear-gradient(135deg, ${theme.colors.bgPrimary}, ${theme.colors.bgSecondary})`);
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
