# Charcoal Universal Theme Setup Guide

> **Note (2026-07-21):** This doc predates the current `--surface-*`/`--charcoal-*`
> token system described in `docs/reference/theme/TOKEN_ADOPTION_PACKET_2026-07-20.md`.
> `--bg-tertiary` and `--orange-primary` below were deleted as dead tokens
> (zero real consumers) during that packet's Lane 1 -- do not reintroduce them.

## What Changed

The entire TradeScout site now uses the **Charcoal system** as the universal default theme, BUT users can **fully customize ALL colors** including replacing the charcoal base.

### Key Points:
✅ **Charcoal is the default** - Every page automatically uses charcoal colors
✅ **Full customization** - Users can replace ANY color (backgrounds, text, borders, accents)
✅ **Simplified theme system** - Users can switch themes or create completely custom ones
✅ **No hardcoded slate colors** - Core layout components use variables only
✅ **Easy to override** - Replace charcoal completely if desired

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

### Option 1: Add a Preset Theme

Edit `client/src/lib/themes.ts`:

```ts
export const PRESET_THEMES: Theme[] = [
  {
    id: 'charcoal',        // Keep charcoal first
    // ... charcoal theme
  },
  
  // Add new theme - customize ALL colors:
  {
    id: 'my-custom-theme',
    name: 'My Custom Theme',
    description: 'All my custom colors',
    colors: {
      // Backgrounds - fully customizable
      bgPrimary: '#your-page-bg',
      bgSecondary: '#your-card-bg',
      bgTertiary: '#your-nav-bg',
      
      // Text - fully customizable
      textPrimary: '#your-text-color',
      textSecondary: '#your-muted-color',
      
      // Accents - fully customizable
      accentPrimary: '#your-accent',
      accentSecondary: '#your-accent-dark',
      accentTertiary: '#your-accent-light',
      
      // Borders - fully customizable
      borderPrimary: '#your-border',
      borderSecondary: '#your-border-light',
    },
  },
];
```

### Option 2: Create Custom Themes at Runtime

Let users create completely custom themes programmatically:

```tsx
import { createCustomTheme, applyTheme } from "@/lib/themes";

export function ThemeCustomizer() {
  const handleApplyCustomTheme = (colors: any) => {
    const customTheme = createCustomTheme('user-custom', {
      bgPrimary: colors.bgPrimary,        // Replace charcoal-800
      bgSecondary: colors.bgSecondary,    // Replace charcoal-700
      bgTertiary: colors.bgTertiary,      // Replace charcoal-900
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      accentPrimary: colors.accentPrimary,
      accentSecondary: colors.accentSecondary,
      borderPrimary: colors.borderPrimary,
    }, {
      name: 'My Custom Colors',
      description: 'Fully custom color scheme'
    });
    
    applyTheme(customTheme);
  };

  return (
    <div>
      <input type="color" onChange={(e) => handleApplyCustomTheme({
        bgPrimary: e.target.value,
        // ... other colors
      })} />
    </div>
  );
}
```

## For Users: Switching Themes & Custom Colors

Create a theme switcher that lets users fully customize all colors:

```tsx
import { PRESET_THEMES, applyTheme, getThemeById, createCustomTheme } from "@/lib/themes";
import { useState } from "react";

export function ThemeSwitcher() {
  const [showCustomizer, setShowCustomizer] = useState(false);
  
  const handleThemeChange = (themeId: string) => {
    const theme = getThemeById(themeId);
    applyTheme(theme);
  };
  
  const handleCreateCustom = (colors: Record<string, string>) => {
    const custom = createCustomTheme('user-custom', {
      bgPrimary: colors.bgPrimary,
      bgSecondary: colors.bgSecondary,
      bgTertiary: colors.bgTertiary,
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      accentPrimary: colors.accentPrimary,
      accentSecondary: colors.accentSecondary,
      borderPrimary: colors.borderPrimary,
    }, {
      name: 'My Custom Theme',
      description: 'User created custom theme'
    });
    applyTheme(custom);
  };

  return (
    <div className="theme-switcher">
      <h3>Choose a Theme</h3>
      
      {/* Preset themes */}
      <select onChange={(e) => handleThemeChange(e.target.value)}>
        {PRESET_THEMES.map(theme => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>

      {/* Custom color picker */}
      <button onClick={() => setShowCustomizer(!showCustomizer)}>
        Create Custom Colors
      </button>
      
      {showCustomizer && (
        <div className="color-customizer">
          <label>
            Page Background
            <input type="color" onChange={(e) => handleCreateCustom({
              bgPrimary: e.target.value,
              // ... other colors
            })} />
          </label>
          {/* More color inputs... */}
        </div>
      )}
    </div>
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

| Theme | Backgrounds | Accents | Status |
|-------|------------|---------|--------|
| **Charcoal (Default)** | Dark charcoal | Orange | Default, fully customizable |
| TradeScout Blue | Slate blue | Blue | Fully customizable |
| Midnight | Deep blue | Cyan | Fully customizable |
| Forest | Dark green | Emerald | Fully customizable |
| Sunset | Purple-brown | Purple-pink | Fully customizable |
| Warm Amber | Brown | Amber | Fully customizable |

**Important:** Users can completely replace ANY color in ANY theme, including the charcoal backgrounds.

## Complete Color Reference (All Customizable)

```
BACKGROUNDS (all replaceable):
  bgPrimary    - Page backgrounds (charcoal-800 default)
  bgSecondary  - Cards, inputs (charcoal-700 default)
  bgTertiary   - Nav bars (charcoal-900 default)
  bgGradient   - Optional full-page gradient

TEXT COLORS (all replaceable):
  textPrimary   - Main text
  textSecondary - Muted/secondary text

ACCENT COLORS (all replaceable):
  accentPrimary   - Main accent color
  accentSecondary - Darker variant
  accentTertiary  - Lighter variant

BORDER COLORS (all replaceable):
  borderPrimary   - Main borders
  borderSecondary - Secondary borders
```

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
