import { useEffect } from "react";
import { applyTheme, getThemeById, LOCKED_TRADESCOUT_THEME_ID, type ThemeId } from "@/lib/themes";
import { useAuth } from "@/hooks/useAuth";
import { safeStorage } from "@/utils/safeStorage";

const GUEST_THEME_KEY = "ts:theme:session";

export function setGuestTheme(themeId: ThemeId) {
  try {
    safeStorage.set(GUEST_THEME_KEY, themeId);
  } catch {
    // ignore storage issues for guests
  }
}

/**
 * Applies the viewer's active theme globally by resolving, then delegating to
 * applyTheme so all semantic tokens and legacy vars are set on :root.
 */
export function ThemeApplier() {
  const { user } = useAuth();

  useEffect(() => {
    const themeId: ThemeId = LOCKED_TRADESCOUT_THEME_ID;

    const theme = getThemeById(themeId);
    applyTheme(theme);
  }, [user]);

  return null;
}
