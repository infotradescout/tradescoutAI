import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { safeStorage } from "../utils/safeStorage";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { applyTheme, getThemeById, LOCKED_TRADESCOUT_THEME_ID, type Theme } from "@/lib/themes";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeId: string) => void;
  customColors: Partial<Theme["colors"]> | null;
  updateCustomColors: (colors: Partial<Theme["colors"]>) => void;
  isCustomTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const savedCustomColors = useMemo(() => {
    try {
      if (user?.customThemeColors) return JSON.parse(user.customThemeColors);
      const local = typeof window !== "undefined" ? safeStorage.get("customColors") : null;
      return local ? JSON.parse(local) : null;
    } catch (err) {
      console.warn("Failed to parse saved custom colors", err);
      return null;
    }
  }, [user]);

  const resolveTheme = useCallback(() => {
    // Global app chrome is locked to the TradeScout charcoal/orange palette.
    // Profile identity surfaces remain scoped through ThemeScope instead of changing app chrome.
    const baseTheme = getThemeById(LOCKED_TRADESCOUT_THEME_ID);
    return { theme: baseTheme, custom: null, themeId: LOCKED_TRADESCOUT_THEME_ID };
  }, [savedCustomColors, user]);

  const initialTheme = useMemo(() => resolveTheme(), [resolveTheme]);

  const [currentTheme, setCurrentTheme] = useState<Theme>(initialTheme.theme);
  const [customColors, setCustomColors] = useState<Partial<Theme["colors"]> | null>(
    initialTheme.custom
  );

  // Save theme preference mutation
  const saveThemeMutation = useMutation({
    mutationFn: async ({ themeId, colors }: { themeId: string; colors?: string }) => {
      if (!user) {
        // Save to localStorage if not logged in
        safeStorage.set("themeId", themeId);
        if (colors) safeStorage.set("customColors", colors);
        return null;
      }

      return apiRequest("PATCH", "/api/user/theme", {
        themePreference: themeId,
        customThemeColors: colors || null,
      });
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
    },
  });

  const setTheme = (themeId: string) => {
    void themeId;
    const newTheme = getThemeById(LOCKED_TRADESCOUT_THEME_ID);
    setCurrentTheme(newTheme);
    setCustomColors(null);
    applyTheme(newTheme);
    if (typeof window !== "undefined") {
      safeStorage.set("themeId", LOCKED_TRADESCOUT_THEME_ID);
      localStorage.removeItem("customColors");
    }
    saveThemeMutation.mutate({ themeId: LOCKED_TRADESCOUT_THEME_ID });
  };

  const updateCustomColors = (colors: Partial<Theme["colors"]>) => {
    void colors;
    const lockedTheme = getThemeById(LOCKED_TRADESCOUT_THEME_ID);
    setCurrentTheme(lockedTheme);
    setCustomColors(null);
    applyTheme(lockedTheme);
    if (typeof window !== "undefined") {
      safeStorage.set("themeId", LOCKED_TRADESCOUT_THEME_ID);
      localStorage.removeItem("customColors");
    }
    saveThemeMutation.mutate({
      themeId: LOCKED_TRADESCOUT_THEME_ID,
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
    if (typeof window !== "undefined") {
      safeStorage.set("themeId", themeId);
      if (custom) {
        safeStorage.set("customColors", JSON.stringify(custom));
      } else {
        localStorage.removeItem("customColors");
      }
    }
  }, [user, savedCustomColors]);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        setTheme,
        customColors,
        updateCustomColors,
        isCustomTheme: currentTheme.id === "custom",
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
