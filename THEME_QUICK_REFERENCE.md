# Theme Lock Quick Reference

**For Developers Building on TradeScout**

---

## 🎨 The 5-Surface System

Use **ONLY** these CSS variables for colors:

```tsx
// Surfaces (darkest → lightest)
backgroundColor: 'var(--surface-frame)'           // #0b0f14 — Nav bars
backgroundColor: 'var(--surface-app-bg)'          // #11161f — Page backgrounds
backgroundColor: 'var(--surface-card)'            // #161e2b — Cards, suggestions
backgroundColor: 'var(--surface-intermediate)'    // #1a2230 — Nested containers
backgroundColor: 'var(--surface-input)'           // #1b2332 — Input boxes
```

---

## ✍️ Text Colors

```tsx
color: 'var(--text-primary)'      // rgba(255,255,255,0.95) — Main text
color: 'var(--text-secondary)'    // rgba(255,255,255,0.7) — Secondary text
color: 'var(--text-tertiary)'     // rgba(255,255,255,0.5) — Disabled/hint
```

---

## 🔲 Borders

```tsx
borderColor: 'var(--border-subtle)'   // rgba(255,255,255,0.06) — Default
borderColor: 'var(--border-active)'   // rgba(255,255,255,0.12) — Hover
borderColor: 'var(--border-focus)'    // rgba(255,255,255,0.18) — Focus
```

---

## 🎯 Common Patterns

### New Card Component

```tsx
export function MyCard() {
  return (
    <div style={{
      backgroundColor: 'var(--surface-card)',
      borderColor: 'var(--border-subtle)',
      borderRadius: '0.75rem',
      padding: '1rem',
    }} className="border">
      <h3 style={{ color: 'var(--text-primary)' }}>Title</h3>
      <p style={{ color: 'var(--text-secondary)' }}>Content</p>
    </div>
  );
}
```

### New Input Component

```tsx
<input
  className="rounded-lg px-3 py-2 border"
  style={{
    backgroundColor: 'var(--surface-input)',
    color: 'var(--text-primary)',
    borderColor: 'var(--border-subtle)',
  }}
  onFocus={(e) => {
    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-active)';
  }}
  onBlur={(e) => {
    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
  }}
  placeholder="Type here..."
/>
```

### Page Layout

```tsx
function MyPage() {
  return (
    <div style={{ backgroundColor: 'var(--surface-app-bg)' }}>
      {/* Content goes here */}
      <MyCard />
    </div>
  );
}
```

---

## ❌ NEVER DO THIS

```tsx
// ❌ WRONG - inline hex color
backgroundColor: '#1a2230'

// ❌ WRONG - hardcoded white/gray
color: '#ffffff'
color: '#cccccc'

// ❌ WRONG - unauthorized gradient
background: 'linear-gradient(135deg, #1a2230, #0f1419)'

// ❌ WRONG - page-level override
function CommunityPage() {
  return <div style={{ backgroundColor: '#0d1117' }}>  {/* Wrong! */}
}
```

---

## ✅ DO THIS INSTEAD

```tsx
// ✅ RIGHT - use CSS variable
backgroundColor: 'var(--surface-card)'

// ✅ RIGHT - use text variable
color: 'var(--text-primary)'

// ✅ RIGHT - use border variable
borderColor: 'var(--border-subtle)'

// ✅ RIGHT - standard surface
function CommunityPage() {
  return <div style={{ backgroundColor: 'var(--surface-app-bg)' }}>
}
```

---

## 🧪 Check Your Work

Before committing:

```bash
npm run audit:theme
```

Should output:
```
✅ Theme Lock Audit PASSED
   No violations found in XX files
```

If it fails:
1. Review the file listed
2. Replace hardcoded colors with CSS variables
3. Run audit again
4. Commit

---

## 📚 Need More Info?

- **Full reference:** [THEME_LOCK_CHECKLIST.md](THEME_LOCK_CHECKLIST.md)
- **Code patterns:** See Part 3 of checklist
- **Common questions:** See Part 8 of checklist
- **Violations found:** [REMEDIATION_REPORT.md](REMEDIATION_REPORT.md)

---

## 🔒 What's Locked

Can't change without approval:
- Scout chat UI
- Top navigation bar
- Bottom navigation bar
- 4-surface color hierarchy
- Text color hierarchy
- Border color states

---

## 🆘 Questions?

Ask in #design-system Slack channel or open issue with `theme-lock` label.

---

**Keep it simple. Use the variables. The theme will stay coherent.**
