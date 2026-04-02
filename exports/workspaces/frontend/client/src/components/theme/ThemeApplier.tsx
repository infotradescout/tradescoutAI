import { useEffect } from "react";
import { applyTheme, getThemeById, isThemeId, type ThemeId } from "@/lib/themes";
import { useAuth } from "@/hooks/useAuth";
import { safeStorage } from "@/utils/safeStorage";

const GUEST_THEME_KEY = "ts:theme:session";

function getGuestTheme(): ThemeId | null {
  try {
    const raw = safeStorage.get(GUEST_THEME_KEY) ?? null;
    if (!raw) return null;
    return isThemeId(raw) ? raw : null;
  } catch {
    return null;
  }
}

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
    const preferred: unknown = (user as any)?.preferences?.themeId || (user as any)?.themePreference;
    const guest = getGuestTheme();

    const themeId: ThemeId =
      (isThemeId(preferred) ? preferred : null) ??
      guest ??
      "charcoal";

    const theme = getThemeById(themeId);
    applyTheme(theme);
  }, [user]);

  return null;
}
