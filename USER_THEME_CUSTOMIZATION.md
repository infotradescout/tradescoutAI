# User Theme Customization Guide

## Complete Control Over All Colors

Users can now **fully customize EVERY color** on the site - including replacing the charcoal base completely.

## What Can Be Customized

### Backgrounds (All Customizable)
```
bgPrimary    → Page backgrounds (default: #121722 charcoal-800)
bgSecondary  → Cards, inputs, dropdowns (default: #1a2030 charcoal-700)
bgTertiary   → Navigation bars (default: #0b0e13 charcoal-900)
```

### Text Colors (All Customizable)
```
textPrimary   → Main text (default: #f1f5f9)
textSecondary → Muted text (default: #cbd5e1)
```

### Accent Colors (All Customizable)
```
accentPrimary   → Main accent (default: orange)
accentSecondary → Darker accent (default: dark orange)
accentTertiary  → Lighter accent (default: light orange)
```

### Borders (All Customizable)
```
borderPrimary   → Main borders (default: #2d3645)
borderSecondary → Secondary borders (default: #1a2030)
```

## Examples

### Example 1: Use a Preset Theme

```typescript
import { getThemeById, applyTheme } from "@/lib/themes";

// Use a preset theme
const blueTheme = getThemeById('tradescout-blue');
applyTheme(blueTheme);
```

**Available Presets:**
- `charcoal` (default)
- `tradescout-blue`
- `midnight`
- `forest`
- `sunset`
- `warm`

### Example 2: Create Completely Custom Colors (Replace Charcoal!)

```typescript
import { createCustomTheme, applyTheme } from "@/lib/themes";

// Create a completely custom theme - replace charcoal with whatever colors you want!
const myTheme = createCustomTheme('my-light-theme', {
  // Light backgrounds (not charcoal!)
  bgPrimary: '#f5f5f5',      // Light gray pages
  bgSecondary: '#ffffff',    // White cards
  bgTertiary: '#eeeeee',     // Light gray nav
  
  // Dark text
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  
  // Custom accents
  accentPrimary: '#2563eb',      // Blue
  accentSecondary: '#1e40af',    // Dark blue
  accentTertiary: '#3b82f6',     // Light blue
  
  // Custom borders
  borderPrimary: '#cccccc',
  borderSecondary: '#dddddd',
}, {
  name: 'My Light Theme',
  description: 'A custom light theme'
});

applyTheme(myTheme);
```

### Example 3: User Color Picker (Full Customization)

```tsx
import { createCustomTheme, applyTheme } from "@/lib/themes";
import { useState } from "react";

export function FullColorCustomizer() {
  const [colors, setColors] = useState({
    bgPrimary: '#121722',
    bgSecondary: '#1a2030',
    bgTertiary: '#0b0e13',
    textPrimary: '#f1f5f9',
    textSecondary: '#cbd5e1',
    accentPrimary: '#f97316',
    accentSecondary: '#ea580c',
    borderPrimary: '#2d3645',
  });

  const handleColorChange = (field: string, value: string) => {
    const updated = { ...colors, [field]: value };
    setColors(updated);
    
    // Apply custom theme in real-time
    const custom = createCustomTheme('user-custom', updated, {
      name: 'My Custom Colors',
    });
    applyTheme(custom);
  };

  return (
    <div className="color-customizer">
      <h2>Customize All Colors</h2>
      
      <section>
        <h3>Backgrounds</h3>
        <div>
          <label>Page Background</label>
          <input 
            type="color" 
            value={colors.bgPrimary}
            onChange={(e) => handleColorChange('bgPrimary', e.target.value)}
          />
        </div>
        <div>
          <label>Cards & Inputs</label>
          <input 
            type="color"
            value={colors.bgSecondary}
            onChange={(e) => handleColorChange('bgSecondary', e.target.value)}
          />
        </div>
        <div>
          <label>Navigation Bars</label>
          <input 
            type="color"
            value={colors.bgTertiary}
            onChange={(e) => handleColorChange('bgTertiary', e.target.value)}
          />
        </div>
      </section>

      <section>
        <h3>Text Colors</h3>
        <div>
          <label>Main Text</label>
          <input 
            type="color"
            value={colors.textPrimary}
            onChange={(e) => handleColorChange('textPrimary', e.target.value)}
          />
        </div>
        <div>
          <label>Muted Text</label>
          <input 
            type="color"
            value={colors.textSecondary}
            onChange={(e) => handleColorChange('textSecondary', e.target.value)}
          />
        </div>
      </section>

      <section>
        <h3>Accent Colors</h3>
        <div>
          <label>Primary Accent</label>
          <input 
            type="color"
            value={colors.accentPrimary}
            onChange={(e) => handleColorChange('accentPrimary', e.target.value)}
          />
        </div>
        <div>
          <label>Secondary Accent</label>
          <input 
            type="color"
            value={colors.accentSecondary}
            onChange={(e) => handleColorChange('accentSecondary', e.target.value)}
          />
        </div>
      </section>

      <section>
        <h3>Borders</h3>
        <div>
          <label>Primary Border</label>
          <input 
            type="color"
            value={colors.borderPrimary}
            onChange={(e) => handleColorChange('borderPrimary', e.target.value)}
          />
        </div>
      </section>
    </div>
  );
}
```

### Example 4: Replace Charcoal with a Light Theme

```typescript
import { createCustomTheme, applyTheme } from "@/lib/themes";

// Complete replacement of charcoal with light mode!
const lightTheme = createCustomTheme('light-mode', {
  bgPrimary: '#ffffff',      // White pages
  bgSecondary: '#f9fafb',    // Off-white cards
  bgTertiary: '#f3f4f6',     // Light gray nav
  textPrimary: '#111827',    // Nearly black text
  textSecondary: '#6b7280',  // Gray text
  accentPrimary: '#3b82f6',  // Blue
  accentSecondary: '#1e40af', 
  borderPrimary: '#e5e7eb',  // Light borders
});

applyTheme(lightTheme);
```

## Key Points

✅ **No limits** - Users can customize any color
✅ **Real-time** - Changes apply instantly
✅ **Persistent** - User theme choice is saved to localStorage
✅ **Fallback** - If localStorage fails, charcoal is the default
✅ **Override charcoal** - Users can replace the charcoal base completely
✅ **Easy to implement** - Just 1-2 lines of code to apply a custom theme

## API Reference

```typescript
// Get a preset theme
getThemeById(id: string): Theme

// Create a completely custom theme
createCustomTheme(
  id: string,
  colors: ThemeColors,
  options?: { name?: string; description?: string; backgroundGradient?: string }
): Theme

// Apply theme to the site
applyTheme(theme: Theme): void

// Get the current active theme ID
getActiveThemeId(): string

// Initialize the default theme on app load
initializeTheme(): void
```

## User Scenarios

### Scenario 1: User Wants Dark Mode (Charcoal)
User does nothing - charcoal is the default.

### Scenario 2: User Wants Light Mode
User creates custom theme with light colors and applies it.

### Scenario 3: User Wants Blue Theme
User selects `tradescout-blue` preset.

### Scenario 4: User Wants Exact Brand Colors
User creates custom theme with exact hex codes for brand colors.

### Scenario 5: User Wants Accessibility (High Contrast)
User creates custom theme with high-contrast colors.

---

**Summary:** Users have COMPLETE control over all colors. Nothing is locked down. They can make the site look however they want.
