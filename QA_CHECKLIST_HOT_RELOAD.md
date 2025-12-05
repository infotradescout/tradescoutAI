# Manual QA Checklist - System Prompt Hot Reload

## Pre-Testing Setup

- [ ] Database is running and DATABASE_URL is set
- [ ] GEMINI_API_KEY is configured
- [ ] Server is running (`npm run dev`)
- [ ] Frontend is accessible at http://localhost:5173
- [ ] Super admin account is created with `super_admin` or `head_admin` role

## 1. Authentication & Access Control

### Admin Page Access
- [ ] **Logged out user**: Navigate to `/admin/system-prompt` → Should redirect to login
- [ ] **Regular homeowner**: Log in, navigate to `/admin/system-prompt` → Should show 403 Forbidden
- [ ] **Super admin**: Log in, navigate to `/admin/system-prompt` → Page loads successfully
- [ ] **Head admin**: Log in, navigate to `/admin/system-prompt` → Page loads successfully

### Permission Display
- [ ] Super admin sees the prompt editor fully functional
- [ ] 403 page shows: "Your role: [actual role]"
- [ ] 403 page shows: "Required roles: super_admin, head_admin"

## 2. Prompt Editor Functionality

### Initial Load
- [ ] Page loads with current system prompt content
- [ ] Character count displays (e.g., "25,432 characters")
- [ ] Line count displays (e.g., "186 lines")
- [ ] Status panel shows:
  - [ ] `cached: true` or `false`
  - [ ] `lastLoaded: [timestamp]`
  - [ ] `reloadInterval: 30000` (30 seconds)
  - [ ] `exists: true`

### Editing
- [ ] Text can be typed/edited in the textarea
- [ ] Character count updates in real-time
- [ ] Line count updates as you edit
- [ ] Discard button clears unsaved edits
- [ ] Content reverts to last saved after discard

### Saving Changes
- [ ] Click "Save Prompt" button
- [ ] Button shows loading state (disabled, spinner)
- [ ] Success message appears: "✓ Prompt saved successfully"
- [ ] Message auto-dismisses after 3 seconds
- [ ] File is written to `server/cache/manual/system_prompt.md`

### Reload from Disk
- [ ] Make edits to the textarea
- [ ] Click "Reload from Disk" button
- [ ] Content reverts to file contents (undoes all local changes)
- [ ] Info message shows: "✓ Reloaded from disk"

## 3. Hot Reload Verification

### No Server Restart Required
- [ ] Edit system prompt in UI
- [ ] Save the prompt
- [ ] Do NOT restart server
- [ ] Check server logs: Should show "System prompt reloaded" or similar
- [ ] Start a NEW conversation with the AI assistant
- [ ] AI uses NEW prompt rules (not old ones)

### Cache Window (30 Seconds)
- [ ] Edit and save prompt at time T=0s
- [ ] New conversations from T=0s to T=30s use updated prompt ✓
- [ ] At T=35s, prompt is reloaded automatically from disk ✓
- [ ] Any changes made to file between T=0s and T=35s are picked up ✓

### Stale Prompt Prevention
- [ ] Edit system prompt (add test text like "TESTING-123")
- [ ] Save it
- [ ] Start 3 new conversations
- [ ] ALL conversations should reference the NEW prompt
- [ ] No conversations should have the OLD prompt

## 4. Knowledge Hierarchy Enforcement

### Layer 1 - Admin Cache (Highest Priority)
- [ ] Add admin override to `server/cache/manual/system_prompt.md`
- [ ] Save via UI
- [ ] Test assistant with related query
- [ ] Verify admin data is used (not DB/web)

### Layer 2 - Local Data
- [ ] Remove admin override
- [ ] Save via UI
- [ ] Test assistant query
- [ ] Verify local database is used (if data exists)

### Layer 3 - Internet Search
- [ ] Clear local data scenario
- [ ] Test assistant query
- [ ] Verify response says "based on wider web" or similar
- [ ] Verify attribution is clear

### Layer 4 - Honest Unknown
- [ ] Query something not in any layer
- [ ] Verify response is honest "I don't know"
- [ ] Verify next steps are suggested
- [ ] NO fabricated data

## 5. Error Handling

### Missing Files
- [ ] Temporarily delete `server/cache/manual/system_prompt.md`
- [ ] Try to load admin page → Should show error or load empty
- [ ] Restore file
- [ ] Page should work again

### Permission Denied
- [ ] Try to open `/admin/system-prompt` without proper role
- [ ] Should show 403 with clear message
- [ ] NOT a generic error page

### Network Errors
- [ ] Edit prompt, click Save
- [ ] Disconnect network mid-request
- [ ] Should show error: "Failed to save prompt"
- [ ] Reconnect, try again → Should work

### Validation
- [ ] Try to save empty prompt
- [ ] Should show error or warning
- [ ] NOT allow empty save

## 6. Concurrent Access

### Multiple Admins
- [ ] Admin A opens `/admin/system-prompt` in browser 1
- [ ] Admin B opens same page in browser 2
- [ ] Admin A edits and saves prompt
- [ ] Admin B's page still shows old content
- [ ] Admin B refresh page → Shows new content from Admin A
- [ ] NO data corruption or conflicts

### New Conversations During Edit
- [ ] Start editing prompt (don't save yet)
- [ ] Meanwhile, another user starts AI conversation
- [ ] Conversation uses OLD prompt (not in-progress edit)
- [ ] Admin saves prompt
- [ ] NEW conversation uses updated prompt
- [ ] OLD conversation keeps original context

## 7. Fail-Safes Verification

### No Mock Data Anywhere
- [ ] Search codebase for `MOCK_DATA`, `mockData`, `fake`
- [ ] Results should only be in tests or comments
- [ ] NO production code uses mock fallbacks
- [ ] Database connection is required (no fallback)

### System Prompt is Single Source of Truth
- [ ] Update system_prompt.md with a rule
- [ ] Save via UI
- [ ] Verify ALL new conversations follow the rule
- [ ] NO hardcoded rules in code override system prompt

### Assistant Never Invents Data
- [ ] Query for non-existent contractor
- [ ] Response: "I don't know about that contractor" (NOT fake data)
- [ ] Query for non-existent property
- [ ] Response: "I don't have that listing" (NOT invented data)

### Internet Never Overrides Local
- [ ] Set local data for a topic
- [ ] Internet has different data for same topic
- [ ] Assistant uses local data, mentions it clearly
- [ ] Does NOT mix sources

### Transactions Don't Leak State
- [ ] Multiple simultaneous requests to assistant
- [ ] Each keeps separate knowledge context
- [ ] NO conversations see each other's overrides

## 8. Performance Checks

### No Downtime During Update
- [ ] Monitor CPU/memory during save
- [ ] Should have NO server restart
- [ ] Existing connections remain stable
- [ ] New requests are served without delay

### Cache Efficiency
- [ ] First conversation after server start: measures load time
- [ ] Second conversation (uses cache): Should be faster
- [ ] Difference visible in browser DevTools or logs

### Reload Timing
- [ ] Time the hot reload operation (save button to cache updated)
- [ ] Should complete in < 100ms
- [ ] No perceptible delay in UI

## 9. Integration Points

### Navigation Link
- [ ] Admin navbar/menu has link to "System Prompt" or similar
- [ ] Link only visible to super_admin/head_admin
- [ ] Link routes to `/admin/system-prompt`

### Assistant Integration
- [ ] System prompt is loaded before each conversation
- [ ] Prompt content is passed to Gemini API
- [ ] Responses follow prompt rules

### Audit Trail (if implemented)
- [ ] Admin makes edit and saves
- [ ] Logs show: `userId, timestamp, action, changes`
- [ ] Useful for compliance/debugging

## 10. Browser Compatibility

- [ ] Chrome/Chromium: Page loads and functions
- [ ] Firefox: Prompt saves and reloads
- [ ] Safari: No UI glitches
- [ ] Mobile/responsive: Editor accessible on tablet

## Sign-Off

**Tested by:** ___________________________

**Date:** ___________________________

**Notes:** 

```
[Space for observations, issues, or improvements]
```

**Overall Status:**
- [ ] PASS - All tests succeeded
- [ ] PASS WITH NOTES - Minor issues, acceptable
- [ ] FAIL - Critical issues found, do not deploy
