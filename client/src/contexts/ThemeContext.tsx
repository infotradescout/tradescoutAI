import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PRESET_THEMES, applyTheme, getThemeById, type Theme } from '@/lib/themes';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { getUserColorScheme } from '@shared/colorPresets';

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeId: string) => void;
  customColors: Partial<Theme['colors']> | null;
  updateCustomColors: (colors: Partial<Theme['colors']>) => void;
  isCustomTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const savedCustomColors = useMemo(() => {
    try {
      if (user?.customThemeColors) return JSON.parse(user.customThemeColors);
      const local = typeof window !== 'undefined' ? localStorage.getItem('customColors') : null;
      return local ? JSON.parse(local) : null;
    } catch (err) {
      console.warn('Failed to parse saved custom colors', err);
      return null;
    }
  }, [user]);

  const resolveTheme = useMemo(() => {
    return () => {
      // Priority 1: explicit profile color scheme (used on public profile + should drive in-app look)
      const preferenceScheme = user?.preferences?.colorScheme;
      if (preferenceScheme) {
        const scheme = getUserColorScheme({ colorScheme: preferenceScheme });
        const themeFromProfile: Theme = {
          id: preferenceScheme.preset || 'profile-theme',
          name: 'Profile Color Scheme',
          description: 'Colors synced from profile preferences',
          colors: {
            bgPrimary: scheme.background,
            bgSecondary: scheme.background,
            bgTertiary: scheme.secondary || scheme.background,
            textPrimary: scheme.text,
            textSecondary: scheme.text,
            accentPrimary: scheme.primary,
            accentSecondary: scheme.secondary || scheme.primary,
            borderPrimary: scheme.border || scheme.background,
            borderSecondary: scheme.secondary || scheme.background,
          },
        };
        return { theme: themeFromProfile, custom: preferenceScheme.preset === 'custom' ? preferenceScheme : null, themeId: preferenceScheme.preset || 'profile-theme' };
      }

      // Priority 2: stored theme preference / local storage
      const savedThemeId = user?.themePreference || (typeof window !== 'undefined' ? localStorage.getItem('themeId') : null) || 'default';
      const baseTheme = getThemeById(savedThemeId);

      if (savedCustomColors) {
        const customTheme: Theme = {
          ...baseTheme,
          id: 'custom',
          name: 'Custom Theme',
          colors: { ...baseTheme.colors, ...savedCustomColors },
        };
        return { theme: customTheme, custom: savedCustomColors, themeId: 'custom' };
      }

      return { theme: baseTheme, custom: null, themeId: savedThemeId };
    };
  }, [savedCustomColors, user]);

  const initialTheme = useMemo(() => resolveTheme(), [resolveTheme]);

  const [currentTheme, setCurrentTheme] = useState<Theme>(initialTheme.theme);
  const [customColors, setCustomColors] = useState<Partial<Theme['colors']> | null>(initialTheme.custom);

  // Save theme preference mutation
  const saveThemeMutation = useMutation({
    mutationFn: async ({ themeId, colors }: { themeId: string; colors?: string }) => {
      if (!user) {
        // Save to localStorage if not logged in
        localStorage.setItem('themeId', themeId);
        if (colors) localStorage.setItem('customColors', colors);
        return null;
      }
      
      return apiRequest('PATCH', '/api/user/theme', {
        themePreference: themeId,
        customThemeColors: colors || null
      });
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      }
    }
  });

  const setTheme = (themeId: string) => {
    const newTheme = getThemeById(themeId);
    setCurrentTheme(newTheme);
    setCustomColors(null);
    applyTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('themeId', themeId);
      localStorage.removeItem('customColors');
    }
    saveThemeMutation.mutate({ themeId });
  };

  const updateCustomColors = (colors: Partial<Theme['colors']>) => {
    const baseTheme = getThemeById(currentTheme.id === 'custom' ? 'default' : currentTheme.id);
    const mergedColors = { ...baseTheme.colors, ...colors };
    const customTheme: Theme = {
      id: 'custom',
      name: 'Custom Theme',
      description: 'Your personalized color scheme',
      colors: mergedColors
    };
    
    setCurrentTheme(customTheme);
    setCustomColors(colors);
    applyTheme(customTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('themeId', 'custom');
      localStorage.setItem('customColors', JSON.stringify(colors));
    }
    saveThemeMutation.mutate({ 
      themeId: 'custom', 
      colors: JSON.stringify(colors) 
    });
  };

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  // Re-resolve theme when user preferences update (ensures profile color scheme drives in-app theme)
  useEffect(() => {
    const { theme, custom, themeId } = resolveTheme();
    setCurrentTheme(theme);
    setCustomColors(custom);
    applyTheme(theme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('themeId', themeId);
      if (custom) {
        localStorage.setItem('customColors', JSON.stringify(custom));
      } else {
        localStorage.removeItem('customColors');
      }
    }
  }, [resolveTheme]);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        setTheme,
        customColors,
        updateCustomColors,
        isCustomTheme: currentTheme.id === 'custom',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
