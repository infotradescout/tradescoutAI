# Decision Card: Scout Welcome Copy Source

**Date**: January 8, 2026  
**Status**: Awaiting Approval  
**Context**: Scout welcome messaging is currently server-driven (dynamic). To complete the approved "Start with Scout" CTA + trust framing, we need to decide where the Scout welcome one-liner lives.

---

## Current State

- Scout messages are generated server-side and rendered dynamically in ScoutThread
- No static welcome banner or header currently exists in the Scout UI shell
- Landing page now says "Start with Scout" → "Tell Scout what you need. Get a Decision Card."

---

## Goal

Add the approved one-liner **"Decisions before contact."** to the Scout interface so users see it immediately upon opening Scout.

---

## Options

### Option A: Client-Side Static Banner (Fastest, Lowest Risk)

**What**: Add a simple static one-liner above the chat thread in the Scout UI shell component.

**Where**: `client/src/scout/ScoutOS.tsx` or `client/src/scout/ScoutThread.tsx` (as a persistent header)

**Implementation**:
```tsx
// In ScoutOS or ScoutThread, add above message thread:
<div className="scout-welcome-banner">
  <p className="text-sm text-gray-400">Decisions before contact.</p>
</div>
```

**Pros**:
- Copy-only, no server changes
- Always visible, no conditional logic
- Trivial to revert
- Ships immediately

**Cons**:
- Not server-controlled (can't A/B test or personalize later)
- Requires client redeploy to change copy

**Guardrails**:
- Pure UI, no behavior change
- No contact/browse bypass
- Aligns with approved CTA framing

---

### Option B: Server-Controlled Welcome Banner (More Flexible)

**What**: Add a `welcomeBanner` field in the Scout bootstrap payload (server provides the copy).

**Where**: Server-side in `/api/scout/chat` response; client renders if present.

**Implementation**:

**Server** (`server/scout/index.ts` or equivalent):
```typescript
// In Scout bootstrap response:
{
  messages: [...],
  welcomeBanner: "Decisions before contact.",
  // ... rest of response
}
```

**Client** (`client/src/scout/ScoutOS.tsx`):
```tsx
// Render banner if server provides it:
{state.welcomeBanner && (
  <div className="scout-welcome-banner">
    <p className="text-sm text-gray-400">{state.welcomeBanner}</p>
  </div>
)}
```

**Pros**:
- Server-controlled (can A/B test, personalize, or remove dynamically)
- Still copy-only (no routing/claims changes)
- Future-proof for conditional messaging

**Cons**:
- Requires server + client changes
- Slightly more complex
- Needs server redeploy to change copy

**Guardrails**:
- Banner is informational only
- No actions/links embedded
- No contact/browse bypass

---

### Option C: Leave As-Is (Dynamic Only)

**What**: Do not add a static welcome banner. Scout messages remain fully server-driven.

**Rationale**: The trust framing is already complete on the landing page and signup form. Scout's dynamic messaging is sufficient.

**Pros**:
- Zero additional changes
- Maintains current server-first architecture

**Cons**:
- No immediate "Decisions before contact" reinforcement when Scout loads
- Misses opportunity to align Scout UI with landing CTA promise

---

## Recommendation

**Option A** (client-side static banner) is the best fit because:

1. **Speed**: Ships immediately with zero server changes
2. **Risk**: Trivial to revert if needed
3. **Consistency**: Reinforces landing page promise ("Start with Scout" → see "Decisions before contact" immediately)
4. **Simplicity**: No conditional logic, no A/B complexity

If Thomas wants server-controlled messaging later, we can migrate to Option B without breaking anything.

---

## Approval Required

Choose one:

- [ ] ✅ **Approve Option A** (client-side static banner)
- [ ] ✅ **Approve Option B** (server-controlled welcome banner)
- [ ] ✅ **Approve Option C** (leave as-is, dynamic only)
- [ ] ❌ **Request edits** (specify below)

---

## Implementation Plan (If Option A Approved)

1. Add static banner in `ScoutThread.tsx` or `ScoutOS.tsx` (above message thread)
2. Style as subtle, non-intrusive (gray text, small font, top of chat area)
3. No links, no actions, pure informational copy
4. Test rendering in mobile + desktop
5. Run forbidden-patterns check
6. Commit as "Scout welcome banner: Decisions before contact (copy-only)"

**Estimated time**: 10 minutes  
**Risk**: Near-zero (pure UI, no behavior)

---

## Fail-Safes

1. ✅ Banner is informational only (no actions)
2. ✅ No contact/browse bypass
3. ✅ Copy matches approved framing
4. ✅ Easily reversible via git revert
5. ✅ No server changes required (Option A)

---

## Notes

- If Option B is chosen, we'll need to define server logic for when/how to show the banner (always? first-time users only? conditional on mode?)
- Option A keeps it simple and aligns with "copy-only" constraint from approval
