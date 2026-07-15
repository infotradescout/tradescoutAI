import React, { useEffect, useMemo, useRef } from "react";
import { applyTheme, isThemeId, type ThemeId, getThemeById } from "@/lib/themes";

interface ThemeScopeProps {
  themeId: ThemeId | string | null | undefined;
  children: React.ReactNode;
  className?: string;
}

/**
 * Scoped theming wrapper used for identity surfaces like public profiles.
 * It applies the selected theme's tokens to a container element only,
 * without changing the viewer's global app theme.
 */
export function ThemeScope({ themeId, children, className }: ThemeScopeProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  const resolvedId: ThemeId = useMemo(() => {
    if (themeId && isThemeId(themeId)) return themeId;
    return "charcoal";
  }, [themeId]);

  useEffect(() => {
    if (!ref.current) return;
    // Build a Theme compatible object from the ThemeId and reuse applyTheme
    // logic against this container via CSS variables.
    const theme = getThemeById(resolvedId);
    const el = ref.current;
    const style = el.style;

    // Apply only the semantic --ts-* tokens for the scoped element.
    // We reuse getThemeById colors but set CSS vars directly on the node.
    style.setProperty("--ts-bg", theme.colors.bgPrimary);
    style.setProperty("--ts-surface", theme.colors.bgSecondary);
    style.setProperty("--ts-surface-strong", theme.colors.bgTertiary);
    style.setProperty("--ts-surface-hover", theme.colors.bgSecondary);
    style.setProperty("--ts-border-subtle", theme.colors.borderPrimary);
    style.setProperty(
      "--ts-border-strong",
      theme.colors.borderSecondary || theme.colors.borderPrimary
    );
    style.setProperty("--ts-text", theme.colors.textPrimary);
    style.setProperty("--ts-text-muted", theme.colors.textSecondary);
    style.setProperty("--ts-accent", theme.colors.accentPrimary);
    style.setProperty("--ts-accent-strong", theme.colors.accentSecondary);
    style.setProperty(
      "--ts-accent-soft",
      theme.colors.accentTertiary || theme.colors.accentPrimary
    );
    style.setProperty("--ts-text-on-accent", theme.colors.bgPrimary);

    return () => {
      style.removeProperty("--ts-bg");
      style.removeProperty("--ts-surface");
      style.removeProperty("--ts-surface-strong");
      style.removeProperty("--ts-surface-hover");
      style.removeProperty("--ts-border-subtle");
      style.removeProperty("--ts-border-strong");
      style.removeProperty("--ts-text");
      style.removeProperty("--ts-text-muted");
      style.removeProperty("--ts-accent");
      style.removeProperty("--ts-accent-strong");
      style.removeProperty("--ts-accent-soft");
      style.removeProperty("--ts-text-on-accent");
    };
  }, [resolvedId]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
