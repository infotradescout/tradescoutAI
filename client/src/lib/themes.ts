// Theme configuration for TradeScout
export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  textPrimary: string;
  textSecondary: string;
  accentPrimary: string;
  accentSecondary: string;
  border: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
  backgroundGradient?: string; // Optional gradient for full-page backgrounds
}

export const PRESET_THEMES: Theme[] = [
  {
    id: 'tradescout',
    name: 'TradeScout Premium',
    description: 'Charcoal to blue gradient with orange accents',
    colors: {
      bgPrimary: '#020617',
      bgSecondary: '#1a2332',
      bgTertiary: '#2d3748',
      textPrimary: '#ffffff',
      textSecondary: '#cbd5e1',
      accentPrimary: '#f97316',
      accentSecondary: '#fb923c',
      border: '#2d3748',
    },
    backgroundGradient: 'radial-gradient(1200px 600px at 50% -200px, #0b2a44 0%, #020617 45%, #020617 100%)',
  },
  {
    id: 'default',
    name: 'TradeScout Dark',
    description: 'Classic dark navy with orange accents',
    colors: {
      bgPrimary: '#0f1419',
      bgSecondary: '#1a2332',
      bgTertiary: '#2d3748',
      textPrimary: '#ffffff',
      textSecondary: '#cbd5e1',
      accentPrimary: '#ff7f50',
      accentSecondary: '#ff9a76',
      border: '#2d3748',
    }
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    description: 'Deep blue with cyan accents',
    colors: {
      bgPrimary: '#0a0e27',
      bgSecondary: '#1a1f3a',
      bgTertiary: '#2a2f4a',
      textPrimary: '#ffffff',
      textSecondary: '#a8b2d1',
      accentPrimary: '#00d4ff',
      accentSecondary: '#4de3ff',
      border: '#2a2f4a',
    },
    backgroundGradient: 'radial-gradient(1200px 600px at 50% -200px, #1e3a8a 0%, #0a0e27 55%, #020617 100%)',
  },
  {
    id: 'forest',
    name: 'Forest Green',
    description: 'Deep green with emerald accents',
    colors: {
      bgPrimary: '#0d1b12',
      bgSecondary: '#1a2e23',
      bgTertiary: '#2d4a3e',
      textPrimary: '#ffffff',
      textSecondary: '#c5e1d4',
      accentPrimary: '#10b981',
      accentSecondary: '#34d399',
      border: '#2d4a3e',
    }
  },
  {
    id: 'sunset',
    name: 'Sunset Purple',
    description: 'Dark purple with pink accents',
    colors: {
      bgPrimary: '#1a0f1e',
      bgSecondary: '#2d1b33',
      bgTertiary: '#4a2f52',
      textPrimary: '#ffffff',
      textSecondary: '#e4d4ea',
      accentPrimary: '#e879f9',
      accentSecondary: '#f0abfc',
      border: '#4a2f52',
    }
  },
  {
    id: 'slate',
    name: 'Modern Slate',
    description: 'Clean slate gray with blue accents',
    colors: {
      bgPrimary: '#0f172a',
      bgSecondary: '#1e293b',
      bgTertiary: '#334155',
      textPrimary: '#ffffff',
      textSecondary: '#cbd5e1',
      accentPrimary: '#3b82f6',
      accentSecondary: '#60a5fa',
      border: '#334155',
    }
  },
  {
    id: 'warm',
    name: 'Warm Amber',
    description: 'Warm brown with amber accents',
    colors: {
      bgPrimary: '#1c1410',
      bgSecondary: '#2d2318',
      bgTertiary: '#4a3829',
      textPrimary: '#ffffff',
      textSecondary: '#e7d4c5',
      accentPrimary: '#f59e0b',
      accentSecondary: '#fbbf24',
      border: '#4a3829',
    }
  },
];

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty('--theme-bg-primary', theme.colors.bgPrimary);
  root.style.setProperty('--theme-bg-secondary', theme.colors.bgSecondary);
  root.style.setProperty('--theme-bg-tertiary', theme.colors.bgTertiary);
  root.style.setProperty('--theme-text-primary', theme.colors.textPrimary);
  root.style.setProperty('--theme-text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--theme-accent-primary', theme.colors.accentPrimary);
  root.style.setProperty('--theme-accent-secondary', theme.colors.accentSecondary);
  root.style.setProperty('--theme-border', theme.colors.border);
  
  // Apply background gradient if available
  if (theme.backgroundGradient) {
    root.style.setProperty('--theme-bg-gradient', theme.backgroundGradient);
    document.documentElement.style.background = theme.backgroundGradient;
  } else {
    root.style.setProperty('--theme-bg-gradient', `linear-gradient(135deg, ${theme.colors.bgPrimary}, ${theme.colors.bgSecondary})`);
    document.documentElement.style.background = theme.colors.bgPrimary;
  }
}

export function getThemeById(id: string): Theme {
  return PRESET_THEMES.find(t => t.id === id) || PRESET_THEMES[0];
}
