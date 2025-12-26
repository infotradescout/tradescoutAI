# Scout Contextual Tiles - Verification Checklist

**Purpose**: Prevent AI-UX bullshit by enforcing deterministic, traceable tile personalization.

---

## ✅ Pre-Merge Checklist

### 1. Code-Level Verification

- [ ] **Single choke points enforced**
  - Tile definitions exist only in `scoutActionTiles.ts`
  - Resolution logic exists only in `resolveScoutTiles.ts`
  - Context assembly exists only in `ScoutOS.tsx` (or one helper)
  - No duplicate tile logic in other files
  
- [ ] **Intent immutability verified**
  - Run: `npm run test:run -- scoutTiles.test.ts`
  - All intent ID tests must pass
  - Resolved tiles NEVER change `id` or `action` fields

### 2. Data-Truth Verification

- [ ] **Every variant documents provenance**
  - Each variant has a `// Proven by:` comment
  - Comment specifies exact API endpoint or data source
  - No "heuristics", "LLM", or "probably" allowed
  
- [ ] **Hard failure modes tested**
  - API returns 500 → defaults render
  - API returns empty array → defaults render
  - Resolver throws error → defaults render
  - User logged out → defaults render (or no fetch)

### 3. Runtime Verification

- [ ] **Dev-mode logging active**
  - Start dev server: `npm run dev`
  - Visit `/scout` in browser
  - Open console, verify tile resolution logs appear (if variants trigger)
  - Logs must explain *why* variant rendered
  
- [ ] **Feature kill switch works**
  - Set `VITE_DISABLE_CONTEXTUAL_TILES=true` in `.env`
  - Restart dev server
  - Verify all tiles show defaults only
  - Remove flag, restart, verify variants work again

### 4. User-Perception Verification

- [ ] **The "lie detector" test**
  - User saves 2 contractors
  - User visits `/scout`
  - Tile says "View 2 saved contractors"
  - Ask user: "Why does it say that?"
  - ✅ Pass: "Because I saved two contractors"
  - ❌ Fail: "I don't know" → fix immediately
  
- [ ] **The reversal test**
  - User unsaves all contractors (or deletes test data)
  - User refreshes `/scout`
  - Tile reverts to "Find local professionals"
  - If tile still shows old count → **FAIL** (stale data)

### 5. No AI/LLM Leakage

- [ ] **Synchronous resolution only**
  - No `async/await` in resolver
  - No `fetch()` in variant conditions
  - No LLM calls anywhere in tile layer
  - Resolution must complete in <10ms
  
- [ ] **Pure function behavior**
  - Same context → same output (always)
  - No hidden state dependencies
  - No global variables affect tiles

---

## 🚫 Anti-Bullshit Rules (Permanent)

| Rule | What It Means | Enforcement |
|------|---------------|-------------|
| **Variants reflect facts, not intent** | Don't guess what user wants; show what's true | Code review |
| **Fallback is the truth** | Default tiles are always correct | Tests enforce |
| **Labels adapt, actions never do** | Intent IDs and routes must be stable | Tests enforce |
| **No personalization without provenance** | Every variant must cite its data source | Code review |
| **If it's wrong once, it's removed** | Zero tolerance for hallucinated tiles | Manual testing |

---

## 📊 When You Can Say "100% Real"

Check all before shipping:

- [ ] Every variant maps to a real API endpoint
- [ ] Every variant disappears when data disappears
- [ ] No LLM output affects tiles
- [ ] No role selection affects tiles
- [ ] No prompt generation affects tiles
- [ ] Feature can be disabled instantly via env var
- [ ] You can explain every variant in one sentence

**If all checked → this is state-aware software, not "AI magic."**

---

## 🔧 Quick Audit Commands

```bash
# Verify single choke points (should only find 3 files)
rg "scoutActionTiles" --type ts --type tsx

# Verify provenance comments exist
rg "Proven by:" client/src/scout/scoutActionTiles.ts

# Run determinism tests
npm run test:run -- scoutTiles.test.ts

# Test with feature disabled
VITE_DISABLE_CONTEXTUAL_TILES=true npm run dev
```

---

## 🚨 Red Flags (STOP Immediately If You See These)

- [ ] Variant condition calls an API
- [ ] Variant uses `Math.random()` or timestamps for logic
- [ ] Variant depends on LLM-generated text
- [ ] Variant changes based on "user intent" (not data)
- [ ] Resolver has `try/catch` that hides errors instead of falling back
- [ ] Tile labels don't match reality when tested manually

**If any red flag appears → revert changes immediately.**

---

**Last Updated**: December 25, 2025  
**Maintained By**: TradeScout Engineering  
**Review Frequency**: On every tile-related PR
