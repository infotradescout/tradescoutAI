# Theme Lock Checklist (v1.0)

**Purpose:** Prevent visual fragmentation and architectural debt from inline styles, page-level overrides, and unauthorized gradients.

**Scope:** All TradeScout frontend code (client/)

**Status:** ACTIVE - All developers must follow before committing code.

---

## Part 1: The Visual Contract (4-Surface System)

### CSS Variables (Root)

```css
/* client/src/index.css – add to :root if missing */

:root {
  /* FRAME SURFACES (Darkest – Navigation) */
  --surface-frame: #0b0f14;
  --surface-frame-border: rgba(255,255,255,0.06);

  /* APPLICATION SURFACES */
  --surface-app-bg: #11161f;           /* Main canvas */
  --surface-card: #161e2b;             /* Elevated: cards, suggestions, prompts */
  --surface-intermediate: #1a2230;     /* In-card surfaces (like preview boxes) */
  --surface-input: #1b2332;            /* Lightest: input boxes, text areas */

  /* INTERACTION STATES */
  --border-subtle: rgba(255,255,255,0.06);
  --border-active: rgba(255,255,255,0.12);
  --border-focus: rgba(255,255,255,0.18);

  /* TEXT HIERARCHY */
  --text-primary: rgba(255,255,255,0.95);
  --text-secondary: rgba(255,255,255,0.7);
  --text-tertiary: rgba(255,255,255,0.5);

  /* ACCENT (Scout only) */
  --theme-accent-primary: #5d8adb;
}
```

### Component Placement (by Surface)

| Component | Surface | Rule | Example |
|-----------|---------|------|---------|
| Top nav | `--surface-frame` | Always darkest, solid border bottom | AppShell header |
| Bottom nav | `--surface-frame` | Always darkest, solid border top | MobileAppBar |
| Page background | `--surface-app-bg` | Default for all page content | AppShell children |
| Cards, list items | `--surface-card` | Elevated, subtle border, 0.9 opacity default | SuggestedPrompts, ContractorCard |
| Input boxes, text areas | `--surface-input` | Lightest, only for user interaction zones | ScoutInput textarea, form fields |
| Intermediate surfaces | `--surface-intermediate` | Preview boxes, nested containers | Inside cards or dialogs |
| Scout shell | Special gradient | Linear-gradient only, top-focused blue hint | ScoutInputRow wrapper |

---

## Part 2: Banned Patterns

### ❌ Inline Colors

**BANNED:**
```tsx
// ❌ DO NOT DO THIS
<div style={{ backgroundColor: '#1a2230', color: '#fff' }}>
<Button className="bg-blue-600 text-white" />
```

**ALLOWED:**
```tsx
// ✅ Use CSS variables or Tailwind + CSS
<div style={{ backgroundColor: 'var(--surface-card)', color: 'var(--text-primary)' }}>
<Button className="bg-blue-600 text-white" style={{ color: 'var(--text-primary)' }} />
```

### ❌ Page-Level Color Overrides

**BANNED:**
```tsx
// ❌ DO NOT DO THIS
// pages/Community.tsx
export function Community() {
  return (
    <div style={{ backgroundColor: '#0a1419' }}> {/* Different from --surface-app-bg */}
      ...
    </div>
  );
}
```

**ALLOWED:**
```tsx
// ✅ Use the standard surface color
export function Community() {
  return (
    <div style={{ backgroundColor: 'var(--surface-app-bg)' }}>
      ...
    </div>
  );
}
```

### ❌ Unauthorized Gradients

**BANNED:**
```css
/* ❌ DO NOT USE GRADIENTS except Scout */
.contractor-card {
  background: linear-gradient(135deg, #1a2230, #0f1419);
}

.community-header {
  background: radial-gradient(circle, rgba(93,138,219,0.1), transparent);
}
```

**ALLOWED:**
```css
/* ✅ Only Scout shell gets a gradient */
.scout-shell {
  background: linear-gradient(180deg, 
    rgba(40,60,110,0.12) 0%, 
    rgba(17,22,31,0.95) 45%, 
    #11161f 100%);
}

/* Everything else: solid surface color */
.contractor-card {
  background: var(--surface-card);
}
```

### ❌ Backdrop Blur on Navigation

**BANNED:**
```css
/* ❌ DO NOT BLUR NAVS */
.top-nav {
  backdrop-filter: blur(10px);
  background: rgba(11,15,20,0.8);
}
```

**ALLOWED:**
```css
/* ✅ Solid colors for frames */
.top-nav {
  background-color: var(--surface-frame);
  border-color: var(--surface-frame-border);
}
```

### ❌ Glows, Shadows on Input Focus

**BANNED:**
```css
/* ❌ DO NOT ADD GLOW OR BOX-SHADOW */
.scout-input:focus {
  box-shadow: 0 0 20px rgba(93,138,219,0.3);
  border: 1px solid rgba(93,138,219,0.6);
}
```

**ALLOWED:**
```css
/* ✅ Simple border brighten only */
.scout-input:focus {
  border-color: var(--border-active);
}
```

---

## Part 3: Component Patterns (Before/After)

### Pattern 1: Card Component

**BEFORE:**
```tsx
export function ContractorCard({ name, rating }) {
  return (
    <div style={{ backgroundColor: '#1a1f2b', borderColor: '#2a3442' }}>
      <h3 style={{ color: '#fff' }}>{name}</h3>
      <p style={{ color: '#aaa' }}>{rating}</p>
    </div>
  );
}
```

**AFTER:**
```tsx
export function ContractorCard({ name, rating }) {
  return (
    <div style={{ 
      backgroundColor: 'var(--surface-card)',
      borderColor: 'var(--border-subtle)',
    }}>
      <h3 style={{ color: 'var(--text-primary)' }}>{name}</h3>
      <p style={{ color: 'var(--text-secondary)' }}>{rating}</p>
    </div>
  );
}
```

### Pattern 2: Form Input

**BEFORE:**
```tsx
<input
  type="text"
  className="bg-gray-900 text-white border border-gray-700"
  placeholder="Search..."
/>
```

**AFTER:**
```tsx
<input
  type="text"
  className="rounded-lg px-4 py-2 border"
  style={{
    backgroundColor: 'var(--surface-input)',
    color: 'var(--text-primary)',
    borderColor: 'var(--border-subtle)',
  }}
  placeholder="Search..."
/>
```

### Pattern 3: Page Background

**BEFORE:**
```tsx
function CommunityPage() {
  return (
    <div style={{ backgroundColor: '#0d1117' }}>
      <CommunityContent />
    </div>
  );
}
```

**AFTER:**
```tsx
function CommunityPage() {
  return (
    <div style={{ backgroundColor: 'var(--surface-app-bg)' }}>
      <CommunityContent />
    </div>
  );
}
```

### Pattern 4: Button with Accent

**BEFORE:**
```tsx
<button style={{ 
  backgroundColor: '#4a7fd3', 
  color: 'white',
  borderRadius: '8px',
}}>
  Send
</button>
```

**AFTER:**
```tsx
<button style={{ 
  backgroundColor: 'var(--theme-accent-primary)',
  color: 'var(--text-primary)',
  borderRadius: '0.5rem',
}}>
  Send
</button>
```

---

## Part 4: Audit Script

Run this regularly to catch violations:

### Quick Shell Script (PowerShell)

```powershell
# scripts/audit-theme-lock.ps1
# Detects inline colors, unauthorized gradients, and theme violations

Write-Output "🔍 Theme Lock Audit Running..."

$violations = @()

# Search for inline hex colors (suspicious pattern)
$hexPattern = "backgroundColor:|borderColor:|color:\s*['`"]#[0-9a-fA-F]{6}"
$hexMatches = Get-ChildItem -Path "client/src/components" -Recurse -Include "*.tsx" |
  Select-String -Pattern $hexPattern |
  Where-Object { $_ -notmatch "Scout|scout" }  # Allow Scout-specific styles

if ($hexMatches) {
  Write-Output "⚠️  Found inline hex colors (should use CSS variables):"
  $hexMatches | ForEach-Object { Write-Output "  $_" }
  $violations += $hexMatches
}

# Search for unauthorized gradients
$gradientPattern = "background:\s*linear-gradient|background:\s*radial-gradient|background:\s*conic-gradient"
$gradientMatches = Get-ChildItem -Path "client/src/components" -Recurse -Include "*.tsx", "*.css" |
  Select-String -Pattern $gradientPattern |
  Where-Object { $_ -notmatch "scout-shell" }  # Allow only scout-shell gradient

if ($gradientMatches) {
  Write-Output "⚠️  Found unauthorized gradients (only Scout allowed):"
  $gradientMatches | ForEach-Object { Write-Output "  $_" }
  $violations += $gradientMatches
}

# Search for page-level background overrides
$pageOverridePattern = "background.*\(.*function.*\)|function.*\(\).*{.*background"
$pageMatches = Get-ChildItem -Path "client/src" -Recurse -Include "*.tsx" |
  Select-String -Pattern "backgroundColor:\s*['\"]#" |
  Where-Object { $_.Filename -match "pages/" }

if ($pageMatches) {
  Write-Output "⚠️  Found page-level color overrides (use --surface-app-bg):"
  $pageMatches | ForEach-Object { Write-Output "  $_" }
  $violations += $pageMatches
}

# Summary
Write-Output ""
if ($violations.Count -eq 0) {
  Write-Output "✅ Theme Lock Audit PASSED - No violations found"
  exit 0
} else {
  Write-Output "❌ Theme Lock Audit FAILED - Found $($violations.Count) violations"
  exit 1
}
```

### Run Before Commit

```bash
# Add to .git/hooks/pre-commit or your CI
npm run audit:theme
```

### Add to package.json

```json
{
  "scripts": {
    "audit:theme": "powershell -ExecutionPolicy Bypass -File scripts/audit-theme-lock.ps1"
  }
}
```

---

## Part 5: Checklist for New Components

Before committing any new component:

- [ ] **Background color:** Uses `var(--surface-*)` (not hardcoded hex)
- [ ] **Text color:** Uses `var(--text-primary/secondary/tertiary)` (not hardcoded white/gray)
- [ ] **Borders:** Uses `var(--border-subtle/active/focus)` (not hardcoded gray)
- [ ] **No inline hex:** Grep component for `#[0-9a-fA-F]{6}` pattern outside allowed files
- [ ] **No unauthorized gradients:** Grep component for `linear-gradient|radial-gradient` outside `scout-shell`
- [ ] **No backdrop-blur on navs:** Checked AppShell and MobileAppBar don't have blur
- [ ] **No glow/shadow on input focus:** Checked ScoutInput focus state is just border brighten
- [ ] **Page backgrounds:** Use `var(--surface-app-bg)`, not custom colors
- [ ] **Cards/suggestions:** Use `var(--surface-card)`, not inline colors
- [ ] **Input boxes:** Use `var(--surface-input)`, not custom backgrounds

---

## Part 6: Rollout Plan

### Phase 1: Lock Current (DONE)
- ✅ Scout chat fully compliant
- ✅ Navs fully compliant
- ✅ Lock document created (SCOUT_AND_NAVS_LOCKED.md)

### Phase 2: Audit Existing (THIS CHECKLIST)
- [ ] Run audit script against all pages
- [ ] Document violations found
- [ ] Create remediation tickets

### Phase 3: Remediate (NEXT)
- [ ] Update violating components to use CSS variables
- [ ] Convert hardcoded colors to theme variables
- [ ] Remove unauthorized gradients

### Phase 4: Enforce (FINAL)
- [ ] Add audit to pre-commit hook
- [ ] Add audit to CI/CD pipeline
- [ ] Document in CONTRIBUTING.md

---

## Part 7: Questions & Decisions

### Q: What if a component needs a custom color?

**A:** Add it to `:root` CSS variables as a new `--surface-*` or `--text-*` variable, document why it's needed, and get approval before using.

```css
/* Example: add a new accent surface if truly needed */
--surface-accent-secondary: #2d4a7a;
```

### Q: What about third-party components?

**A:** Wrap them in a div with theme colors, or override their styles in your component's scoped CSS using the theme variables.

```tsx
<div style={{ backgroundColor: 'var(--surface-card)' }}>
  <ThirdPartyComponent />
</div>
```

### Q: Scout gradient is allowed, but what about other "special" cases?

**A:** No. Scout is the one exception. Any other special gradient requires explicit approval and a new rule in this checklist.

### Q: Can I use Tailwind utility classes?

**A:** Yes, but prefer CSS variables for colors. If you must use Tailwind (e.g., `bg-gray-900`), also set an inline `style` with the CSS variable as fallback.

```tsx
<div className="bg-gray-900" style={{ backgroundColor: 'var(--surface-card)' }}>
```

---

## Part 8: Enforcement (Team Rules)

### Pull Request Review

Reviewer checklist before approving:

- [ ] No new hardcoded hex colors
- [ ] No new gradients outside Scout
- [ ] All backgrounds use `var(--surface-*)`
- [ ] All text uses `var(--text-*)`
- [ ] All borders use `var(--border-*)`
- [ ] Audit script passes (if added)

### Pre-Commit Hook (Optional Setup)

```bash
# .git/hooks/pre-commit
#!/bin/bash
npm run audit:theme || exit 1
```

### CI/CD Integration

Add to GitHub Actions or Render deployment:

```yaml
- name: Audit Theme Lock
  run: npm run audit:theme
```

---

## Summary: The Rule

✅ **Allowed:**
- CSS variables from `:root`
- Scout linear-gradient (180deg, top-focused)
- Text colors from `--text-*`
- Border colors from `--border-*`
- Surface colors from `--surface-*`

❌ **Banned:**
- Inline hex colors (except Scout)
- Gradients outside Scout
- Page-level overrides
- Backdrop-blur on navs
- Glows/shadows on input focus

🔒 **Locked:**
- Scout chat (can't change)
- Top nav (can't change)
- Bottom nav (can't change)
- Color hierarchy (must conform)

---

## Files to Update

1. **Add to `client/src/index.css`:** CSS variables block (Part 1)
2. **Create `scripts/audit-theme-lock.ps1`:** Audit script (Part 4)
3. **Update `package.json`:** Add `audit:theme` script
4. **Create/update `.git/hooks/pre-commit`:** Run audit before commit (optional)
5. **Update `CONTRIBUTING.md`:** Link to this checklist

---

## Maintenance

**Review quarterly** or when:
- Adding a new page
- Major component refactor
- Visual regression complaints
- Bundle size audit

**Update this checklist when:**
- New surface color needed
- New pattern discovered
- Violation type found
- Rule clarification needed

---

**Last Updated:** Dec 25, 2025  
**Version:** 1.0  
**Owner:** Scout Visual Architecture  
**Status:** ACTIVE & ENFORCED
