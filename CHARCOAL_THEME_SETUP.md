# Charcoal Universal Theme Setup Guide

## What Changed

The entire TradeScout site now uses the **Charcoal system** as the universal default theme. No page is left unstyled.

### Key Points:
✅ **Charcoal is the default** - Every page automatically uses charcoal colors
✅ **Simplified theme system** - Users can switch themes, but charcoal is the fallback
✅ **No hardcoded slate colors** - Core layout components updated
✅ **Easy customization** - Just update CSS variables in `client/src/lib/themes.ts`

## How to Use

### 1. Initialize Theme in App.tsx

Add this to your main App component's `useEffect`:

```tsx
import { initializeTheme } from "@/lib/themes";

export function App() {
  useEffect(() => {
    // Initialize theme on app load
    initializeTheme();
  }, []);

  return (
    <div className="app-shell">
      {/* Your app content */}
    </div>
  );
}
```

### 2. Theme Colors Are Automatic

Once `initializeTheme()` is called, all components automatically use:

```
--bg-primary:        #121722  (charcoal-800, page backgrounds)
--bg-secondary:      #1a2030  (charcoal-700, cards & inputs)
--bg-tertiary:       #0b0e13  (charcoal-900, nav bars only)
--text-primary:      #f1f5f9  (light text)
--text-secondary:    #cbd5e1  (muted text)
--border-primary:    #2d3645  (borders)
```

### 3. Component Usage (No Changes Needed!)

All components already use the right colors:

```tsx
// ✅ This automatically gets charcoal colors:
<div style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
  My content
</div>

// ✅ Tailwind classes also work (via CSS variables):
<div className="bg-slate-950">...</div>  // Falls back to charcoal defaults
```

## For Developers: Adding Custom Themes

To add a new custom theme, edit `client/src/lib/themes.ts`:

```ts
export const PRESET_THEMES: Theme[] = [
  {
    id: 'charcoal',        // Always keep charcoal first
    // ... charcoal theme
  },
  
  // Add new theme:
  {
    id: 'my-custom-theme',
    name: 'My Custom Theme',
    description: 'My custom colors',
    colors: {
      bgPrimary: '#your-color',
      bgSecondary: '#your-color',
      bgTertiary: '#your-color',
      textPrimary: '#your-color',
      textSecondary: '#your-color',
      accentPrimary: '#your-accent',
      accentSecondary: '#your-accent',
      border: '#your-border',
    },
  },
];
```

## For Users: Switching Themes

Create a theme switcher component:

```tsx
import { PRESET_THEMES, applyTheme, getThemeById } from "@/lib/themes";

export function ThemeSwitcher() {
  const handleThemeChange = (themeId: string) => {
    const theme = getThemeById(themeId);
    applyTheme(theme);
  };

  return (
    <select onChange={(e) => handleThemeChange(e.target.value)}>
      {PRESET_THEMES.map(theme => (
        <option key={theme.id} value={theme.id}>
          {theme.name}
        </option>
      ))}
    </select>
  );
}
```

## CSS Variable Reference

All pages have access to these variables:

```css
/* Background Colors */
--bg-primary         /* Page backgrounds (charcoal-800) */
--bg-secondary       /* Cards, inputs (charcoal-700) */
--bg-tertiary        /* Nav bars (charcoal-900) */
--bg-gradient        /* Full-page gradient */

/* Text Colors */
--text-primary       /* Main text */
--text-secondary     /* Muted text */
--text-muted         /* Very muted text */

/* Accent Colors */
--orange-primary     /* Main accent (orange by default) */
--orange-secondary   /* Darker accent */
--orange-tertiary    /* Lighter accent */

/* Borders */
--border-primary     /* Main borders */
--border-secondary   /* Secondary borders */

/* Status */
--success
--warning
--error
```

## Current Theme Implementation

| Theme | Base Colors | Accent |
|-------|------------|--------|
| **Charcoal (Default)** | Dark charcoal (#121722) | Orange |
| TradeScout Blue | Charcoal base | Blue |
| Midnight | Deep charcoal | Cyan |
| Forest | Charcoal base | Emerald |
| Sunset | Charcoal base | Purple-Pink |
| Warm Amber | Charcoal base | Amber |

All themes use charcoal as the base. Users can customize just the accent colors.

## Troubleshooting

**Colors not changing?**
→ Make sure `initializeTheme()` is called in your App component

**Theme resets on page load?**
→ Check localStorage is enabled in browser settings

**Want to disable theme switching?**
→ Remove the theme switcher, `initializeTheme()` will always load charcoal

## Files to Know

- `client/src/index.css` - Root CSS variables (charcoal defaults)
- `client/src/lib/themes.ts` - Theme definitions & functions
- `client/src/components/layout/AppShell.tsx` - Main layout (uses charcoal)
- `THEME_SYSTEM.md` - Folder structure documentation
