# OBJECTIVES LAYER — INTEGRATION QUICK START

**For:** Thomas / Development Team  
**Time:** ~30 minutes to wire + test  
**Deliverable:** Scout creates and manages persistent objectives

---

## STEP 1: Wire scout.ts (2-3 Lines)

**File:** `server/routes/scout.ts`

**Location:** Find line ~3000 where the main Scout response is returned (search for `res.json({` before the auth_required check)

**Add these imports at top of file:**

```typescript
import { syncObjectiveFromScoutMessage } from "../scout/objectivesService";
```

**Add this code BEFORE the final `res.json()` response (around line 2995-3005):**

```typescript
// Sync objective from Scout message (NEW — Phase 1)
if (userId) {
  try {
    const objectiveResult = await syncObjectiveFromScoutMessage({
      userId,
      messageText: normalizedMessage,
      userRole: requestUser?.role,
      scoutIntent: synthesized.intent, // From Scout's classifier
      countyFips: normalizedFips,
      stateCode: countyCode,
    });

    // Attach to response metadata for client
    if (objectiveResult?.objectiveId) {
      (aiResponse.metadata ??= {}).objectiveId = objectiveResult.objectiveId;
    }
  } catch (err) {
    console.error("[Scout] Objective sync failed (non-critical):", err);
    // Silent fail — don't break Scout if objective logic fails
  }
}
```

**That's it for scout.ts!**

---

## STEP 2: Wire ScoutOS.tsx (~20 Lines)

**File:** `client/src/scout/ScoutOS.tsx`

### 2.1: Add Import (1 line)

At the top with other imports:

```typescript
import { ObjectiveChip } from "./ObjectiveChip";
import type { Objective } from "@shared/schema";
```

### 2.2: Add State Hooks (5 lines)

Inside the `ScoutOS` component function, early in the state declarations:

```typescript
  const [activeObjective, setActiveObjective] = useState<Objective | null>(null);
  const [objectiveLoading, setObjectiveLoading] = useState(false);
```

### 2.3: Fetch Active Objective on Mount (8 lines)

Inside a `useEffect`:

```typescript
  useEffect(() => {
    if (userId && !objectiveLoading) {
      setObjectiveLoading(true);
      fetch(`/api/objectives/active`)
        .then((r) => r.json())
        .then((data) => {
          setActiveObjective(data.objective || null);
        })
        .catch((err) => console.warn("[Scout] Failed to fetch active objective:", err))
        .finally(() => setObjectiveLoading(false));
    }
  }, [userId]);
```

### 2.4: Render ObjectiveChip (2 lines)

Inside the main JSX, right after `<ScoutHeader>`, add:

```typescript
      {activeObjective && (
        <ObjectiveChip
          objective={activeObjective}
          onStatusChange={async (status) => {
            const result = await fetch(`/api/objectives/${activeObjective.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status }),
            });
            if (result.ok) {
              const updated = await result.json();
              setActiveObjective(updated.objective);
            }
          }}
          onTitleChange={async (title) => {
            const result = await fetch(`/api/objectives/${activeObjective.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title }),
            });
            if (result.ok) {
              const updated = await result.json();
              setActiveObjective(updated.objective);
            }
          }}
          onDelete={async () => {
            await fetch(`/api/objectives/${activeObjective.id}`, { method: "DELETE" });
            setActiveObjective(null);
          }}
          isLoading={objectiveLoading}
        />
      )}
```

### 2.5: Update on Scout Response (2 lines)

After Scout returns a response and you update `messages`, add:

```typescript
      // Refresh objective from response metadata (if new one was created)
      if (response?.metadata?.objectiveId) {
        fetch("/api/objectives/active")
          .then((r) => r.json())
          .then((d) => setActiveObjective(d.objective))
          .catch(() => {});
      }
```

**That's it for ScoutOS!**

---

## STEP 3: Database Migration

```bash
# Apply new schema
npm run db:migrate

# Verify tables exist
npm run db:query "SELECT table_name FROM information_schema.tables WHERE table_name IN ('objectives', 'objective_events');"
```

---

## STEP 4: Run Smoke Tests

```bash
# Install if needed
npm install vitest --save-dev

# Run objectives tests
npm test -- objectives.test.ts

# Expected: 24 tests pass ✅
```

---

## STEP 5: Local Testing Flow

### Start Dev Server

```bash
npm run dev
```

### Test Scenario

1. **Open Scout:** Navigate to `/scout`
2. **Send message:** "I need my kitchen remodeled"
   - Check console: Should see "Created objective" in logs
   - ObjectiveChip should appear at top showing "🔨 Kitchen remodeling..."
3. **Send follow-up:** "Budget is $15k"
   - ObjectiveChip should persist
   - Backend should update existing objective (not create new)
4. **Click ObjectiveChip menu (⋯):**
   - Should show: Rename, Pause, Delete options
5. **Test topic shift:** "Actually, where's a good steakhouse?"
   - ObjectiveChip should update to "🗣️ Local Advice"
   - Previous objective should be marked paused (check DB)
6. **Check API directly:**
   ```bash
   curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/objectives/active
   # Should return current active objective as JSON
   ```

---

## STEP 6: Deployment

### Pre-flight Checklist

```
[ ] Schema migration tested locally
[ ] scout.ts wiring added and builds without errors
[ ] ScoutOS.tsx wiring added and components render
[ ] All 24 tests pass
[ ] E2E flow: Message → Objective → ObjectiveChip → Success
[ ] No TypeScript errors: npm run build
[ ] No console errors in dev server
```

### Deploy

```bash
# Merge changes to main
git add .
git commit -m "feat: add universal objectives layer (CODEX Phase 1)"
git push origin main

# Deploy via your normal pipeline
# (Vercel, Render, Docker, etc.)

# Post-deploy verification
curl https://thetradescout.com/api/objectives/active \
  -H "Authorization: Bearer <test-user-token>"
# Should return active objective or null (if no objective yet)
```

---

## TROUBLESHOOTING

### ObjectiveChip doesn't appear

**Check:**
1. Is `activeObjective` state populated? (Add `console.log(activeObjective)` in render)
2. Did fetch return data? (Check Network tab in DevTools)
3. Is component imported? (Check ScoutOS imports)

**Fix:**
```typescript
console.log("[Scout] Active objective:", activeObjective);
// If null, check /api/objectives/active returns data
```

### Objective not syncing from Scout message

**Check:**
1. Did you add the `syncObjectiveFromScoutMessage()` call in scout.ts?
2. Are there server errors? (Check server logs, search for "Objective sync failed")

**Fix:**
- Ensure scout.ts has the import and the try/catch block
- Check that `userId` variable is available and populated
- Verify database connection works (can you query objectives table?)

### Tests fail

**Check:**
1. Database migrations applied? (`npm run db:migrate`)
2. Are you connected to test database?

**Fix:**
```bash
# Reset test DB
npm run db:reset

# Run tests again
npm test -- objectives.test.ts
```

---

## FILES TOUCHED

| File | Changes | Lines |
|------|---------|-------|
| `server/routes/scout.ts` | Add import + 12-line integration | ~15 lines added |
| `client/src/scout/ScoutOS.tsx` | Add import, state, hooks, render | ~20-30 lines added |
| `server/routes/objectives.ts` | **NEW** (already created) | 370 lines |
| `server/scout/objectivesService.ts` | **NEW** (already created) | 220 lines |
| `server/services/intentsClassifier.ts` | **NEW** (already created) | 270 lines |
| `client/src/scout/ObjectiveChip.tsx` | **NEW** (already created) | 180 lines |
| `tests/objectives.test.ts` | **NEW** (already created) | 380 lines |

---

## SUCCESS CRITERIA

✅ All steps completed when:

1. Scout message creates objective (check DB)
2. ObjectiveChip renders at top of Scout UI
3. User can click ObjectiveChip menu to pause/delete
4. Topic shift auto-pauses previous objective
5. All 24 smoke tests pass
6. E2E: Message → Objective → Chip → Button → Success

---

## TIME ESTIMATE

- Scout.ts wiring: ~2 min
- ScoutOS.tsx wiring: ~5 min
- Database migration: ~1 min
- Local testing: ~10 min
- Smoke tests: ~3 min
- Bug fixes (if any): ~5-10 min

**Total: ~30 minutes to fully deployed & tested**

---

**Questions?** Refer to `OBJECTIVES_PHASE1_IMPLEMENTATION.md` for detailed documentation.

