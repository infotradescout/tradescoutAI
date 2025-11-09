import { createContext, useContext, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PRESET_THEMES, applyTheme, getThemeById, type Theme } from '@/lib/themes';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

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
  
  // Get saved theme from user preferences or localStorage
  const savedThemeId = user?.themePreference || localStorage.getItem('themeId') || 'default';
  const savedCustomColors = user?.customThemeColors ? JSON.parse(user.customThemeColors) : null;
  
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    const baseTheme = getThemeById(savedThemeId);
    if (savedCustomColors) {
      return {
        ...baseTheme,
        id: 'custom',
        name: 'Custom Theme',
        colors: { ...baseTheme.colors, ...savedCustomColors }
      };
    }
    return baseTheme;
  });
  
  const [customColors, setCustomColors] = useState<Partial<Theme['colors']> | null>(savedCustomColors);

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
    saveThemeMutation.mutate({ 
      themeId: 'custom', 
      colors: JSON.stringify(colors) 
    });
  };

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

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
