# Scout Streaming Support Decision

## Summary
**Decision:** Defer Server-Sent Events (SSE) streaming until higher-priority features are complete.

## Rationale

### 1. Tool Wiring Provides Immediate Value
- Users can now ask "find plumbers near me" and get **real contractor results** with clusters, ratings, and navigation.
- Marketplace search works end-to-end: "find used furniture" → actual listings with price, location, seller info.
- **Impact:** Scout now DOES things instead of just talking. This is the #1 user complaint resolved.

### 2. Current Progress Bar is Adequate
- Phase-based progress animation (resolving_context → checking_documents → executing_action → ready) provides visual feedback.
- Status messages rotate based on mode (contractors, marketplace, admin, default).
- Users see "Matching local contractors..." when tools run, not a blank screen.

### 3. SSE Requires Major Backend Changes
Implementing true streaming would require:
- Refactor `server/routes/scout.ts` POST handler to support `res.write()` chunks
- Add SSE headers (`Content-Type: text/event-stream`, `Connection: keep-alive`)
- Change LLM provider calls to stream tokens instead of waiting for full response
- Update client `sendToScout()` to handle `EventSource` or `fetch` with `ReadableStream`
- Handle reconnection logic, error recovery, and partial message rendering
- Test edge cases: connection drops, tab switches, mobile background/foreground

**Estimated effort:** 2-3 days of focused work + testing.

### 4. Eval Suite is Higher Priority
Before adding more features, we need to:
- Ensure current tool calls return valid actions (no hallucinated links)
- Verify personalization works (draft includes user.name, locality.county)
- Check latency budgets (tools complete within timeout)
- Prevent regressions when adding new intents

**Impact:** Without evals, future changes risk breaking existing flows.

## Next Steps
1. ✅ Wire contractor + marketplace search intents (COMPLETE)
2. ⏭️ Defer streaming → Build eval suite first (task 4)
3. ⏭️ Test and verify locally (task 5)
4. 🔄 Return to streaming after stable foundation

## Future Streaming Implementation Notes
When we do add streaming, prioritize:
- Token-by-token rendering for long Scout answers (reduces perceived latency)
- Phase events: `{type: "phase", phase: "checking_documents"}` → update progress bar from server, not timers
- Tool status: `{type: "tool_start", tool: "searchContractors"}` → show "Working with searchContractors..." badge
- Incremental clusters: `{type: "cluster", cluster: {...}}` → append contractor cards as they load

Keep existing fallback: if streaming fails, use current non-streaming flow (graceful degradation).
