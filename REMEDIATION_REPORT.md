# Theme Lock Remediation Report

**Date:** Dec 25, 2025  
**Status:** Phase 2 - Audit Complete, Ready for Remediation

---

## Summary

**Violations Found:** ~15 inline hardcoded hex colors across components  
**Severity:** Medium (mostly in RightToolsPanel and layout files)  
**Action:** Convert all to CSS variable references

---

## Violations by File

### 1. **AppShell.tsx** (2 violations)

**Line 123:** Top nav header background
```tsx
// ❌ CURRENT
<header style={{ backgroundColor: '#0b0f14', borderColor: 'rgba(255,255,255,0.06)' }}>

// ✅ CORRECTED
<header style={{ backgroundColor: 'var(--surface-frame)', borderColor: 'var(--surface-frame-border)' }}>
```

**Line 311:** Right panel background
```tsx
// ❌ CURRENT
<div style={{ backgroundColor: '#141b26' }}>

// ✅ CORRECTED
<div style={{ backgroundColor: 'var(--surface-intermediate)' }}>
```

### 2. **RightToolsPanel.tsx** (6 violations)

**Lines 39, 42, 45, 49, 84, 87, 90, 94:** Inline hardcoded colors
```tsx
// ❌ CURRENT
backgroundColor: '#1a2230',
(e.currentTarget as HTMLElement).style.backgroundColor = '#1f2a39';
(e.currentTarget as HTMLElement).style.backgroundColor = '#1a2230';

// ✅ CORRECTED
backgroundColor: 'var(--surface-intermediate)',
(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-card)',
(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-intermediate)',
```

### 3. **Navigation/MobileAppBar.tsx** (1 violation)

```tsx
// ❌ CURRENT
style={{ backgroundColor: '#0b0f14', borderColor: 'rgba(255,255,255,0.06)' }}

// ✅ CORRECTED
style={{ backgroundColor: 'var(--surface-frame)', borderColor: 'var(--surface-frame-border)' }}
```

---

## Remediation Plan

### Batch 1: Layout Files (AppShell.tsx, RightToolsPanel.tsx)
- [ ] Replace `#0b0f14` with `var(--surface-frame)`
- [ ] Replace `#141b26` with `var(--surface-intermediate)`
- [ ] Replace `#1a2230` with `var(--surface-intermediate)`
- [ ] Replace `#1f2a39` with `var(--surface-card)` (hover state)
- [ ] Keep `rgba(255,255,255,0.06)` as-is (already uses rgba)

### Batch 2: Navigation Files (MobileAppBar.tsx)
- [ ] Replace `#0b0f14` with `var(--surface-frame)`
- [ ] Replace border rgba with `var(--surface-frame-border)`

### Batch 3: Other Components (Post-Audit)
- [ ] Run full audit to identify remaining violations
- [ ] Categorize by type (frame, app, card, input)
- [ ] Convert systematically

---

## Next Steps

1. Apply Batch 1 & 2 fixes immediately
2. Run audit again to verify violations reduced
3. Create remediation tickets for remaining violations
4. Document patterns in CONTRIBUTING.md

---

## Mapping Guide

**Frame colors (Navs):**
- `#0b0f14` → `var(--surface-frame)`

**Intermediate/Subtle surfaces:**
- `#141b26` → `var(--surface-intermediate)`
- `#1a2230` → `var(--surface-intermediate)`

**Card surfaces (Elevated):**
- `#1f2a39` → `var(--surface-card)` (for hover/active states)
- `#161e2b` → `var(--surface-card)` (standard)

**Text colors (for reference):**
- `#fff` / white → `var(--text-primary)`
- `#ccc` / light gray → `var(--text-secondary)`
- `#999` / medium gray → `var(--text-tertiary)`

**Borders (for reference):**
- `rgba(255,255,255,0.06)` → `var(--border-subtle)`
- `rgba(255,255,255,0.12)` → `var(--border-active)`
- `rgba(255,255,255,0.18)` → `var(--border-focus)`

---

**Owner:** Scout Visual Architecture  
**Deadline:** Before next feature branch  
**Enforcement:** All PRs must pass audit script
