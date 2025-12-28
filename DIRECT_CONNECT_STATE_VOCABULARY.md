# Direct Connect State Vocabulary

This document defines the shared language Scout, Direct Connect UI, analytics, and outcome interpretation must use when describing coordination state. It does **not** introduce new schema; it standardizes how we read and talk about what already exists.

---

## 1. Canonical states (no new schema, just interpretation)

These are descriptive, **interpretation** states – not DB enums. Anything that reads or explains Direct Connect must map underlying data into one of these for users.

| State             | Definition                             | Scout phrasing                       |
| ----------------- | -------------------------------------- | ------------------------------------ |
| Created           | Request exists, no routing yet         | "This request is set up and ready." |
| Routing           | Scout/community exposure underway      | "Scout is routing this through Direct Connect." |
| Awaiting responses| Providers/helpers have been notified   | "Waiting for people to respond."    |
| In discussion     | Messages or quotes exchanged           | "You're actively coordinating."     |
| Pending outcome   | Action taken, outcome not confirmed    | "This is in progress."              |
| Resolved          | User confirmed success                 | "This worked."                      |
| Abandoned         | No activity after threshold            | "This didn’t move forward."         |

---

## 2. Scout-approved phrasing rules

When Scout talks about Direct Connect, it must follow these rules:

- Never say **"task completed"** → say **"coordination resolved"** or **"this worked"**.
- Never say **"no activity"** → say **"no responses yet"** or **"no new responses yet"**.
- Never imply failure unless the user has explicitly confirmed failure (e.g., via an outcome or explicit close).
- Prefer **process language** ("routing", "coordinating", "in progress") over static labels ("open", "closed") to reinforce that Direct Connect is an active engine.
- When in doubt between positive vs. negative framing, default to **neutral, process-focused** phrasing ("still routing", "still waiting on responses").

These rules protect trust and keep Scout aligned with the real-world coordination loop instead of over-promising.

---

## 3. Allowed Scout explanations (read-only)

Scout is allowed to **read and explain** Direct Connect state, not mutate it.

### Examples Scout **may** say

- "This is on your Direct Connect board and still routing."
- "Nothing is wrong—this usually takes a bit."
- "You have 2 active coordination items in Direct Connect."
- "One of your requests is waiting for responses; another is in discussion."
- "You can update or close this anytime from your Direct Connect board."
- "Scout has already shared this with your community; now we're waiting on responses."

### Examples Scout **must not** say

- "No one wants this."
- "This didn’t work." (unless the user has marked it as failed)
- "You should repost." (Scout can suggest checks or next steps, not blame)
- Any phrasing that implies **blame, failure, or neglect** without explicit user confirmation.

All Scout explanations must:

- Reflect the canonical state vocabulary above.
- Be **read-only**: explain what is happening, never claim to have changed state.
- Point back to Direct Connect as the place where coordination actually happens.

---

## 4. Outcome alignment

This section ties the interpretation states to **OutcomeConfirmationCard** behavior. It is a contract for how we think about outcomes, not a schema change.

### States that **should trigger** OutcomeConfirmationCard

These are states where we reasonably expect a real-world outcome soon, and where asking the user is appropriate:

- **Pending outcome**  
  - Default trigger state.  
  - Outcome card should appear after meaningful activity (e.g., work done, visit completed, quote accepted) but before the system assumes success or failure.
- **In discussion** (when a clear action just occurred)  
  - If the user performs a concrete action that likely leads to an outcome (e.g., accepts a quote, schedules a visit), the card may be triggered off that action while the state is still interpreted as "in discussion".

### States that should **suppress** OutcomeConfirmationCard

These states are too early or already terminal; we do **not** pester the user:

- **Created**  
  - Request is set up but not routed; too early to ask for an outcome.
- **Routing**  
  - Exposure is happening; coordination is in motion but no response yet.
- **Awaiting responses**  
  - Users are waiting; asking for an outcome here would feel wrong.
- **Resolved**  
  - User already confirmed success; no new card for the same episode.
- **Abandoned**  
  - Coordination effectively stopped without explicit success; outcome for this episode is implicitly "didn’t move forward". We may log this analytically but we do not show a fresh confirmation card for it.

### States that allow **re-asks** later

Re-asks must be rare, respectful, and only when coordination meaningfully changes.

- **Pending outcome**  
  - If a user dismissed or skipped the outcome card while in this state, we may re-ask **once** after a clear subsequent signal of progress (e.g., another visit, another major interaction).
- **In discussion**  
  - Similar to Pending outcome: if the conversation continues and there are new significant actions, a single re-ask is allowed.
- **Abandoned → re-activated**  
  - If a previously abandoned request is revived (new messages, new routing, or a fresh coordination attempt), it should be treated as a **new episode**. OutcomeConfirmationCard can trigger again as the request flows back through Pending outcome.

### Alignment guarantees

- Outcome analytics must classify episodes using these interpretation states so that charts, summaries, and Scout explanations all tell the same story.
- Direct Connect UI should, over time, move its visible labels and chips toward this vocabulary (without changing the underlying schema).
- Scout **reads from** this vocabulary and the OutcomeDecisionCharter, never improvising new state language on the fly.

This vocabulary is the contract: any future Scout panels or Direct Connect UI changes must align with these states and phrases, not invent their own.
