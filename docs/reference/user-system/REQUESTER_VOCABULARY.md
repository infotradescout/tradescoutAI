# Requester-Side Vocabulary Charter

This document locks the **user-facing words** TradeScout uses for people trying to get something done. It sits alongside DIRECT_CONNECT_STATE_VOCABULARY and applies to **Scout copy, Direct Connect UI, and requester surfaces only**.

---

## 1. Canonical concepts & terms

| Concept                         | Canonical term (user-facing)     | Notes |
| --------------------------------| ----------------------------------| ----- |
| User asking for help            | **Direct Connect request**        | This is the primary phrase for users. Scout and UI should say "Direct Connect request" or "request" – not project/task/work order. |
| In-flight work being coordinated| **Active coordination**           | Use this for panels, headings, and summaries (e.g., "Your Active Coordination"). Avoid "open tasks" / "open projects" for requesters. |
| The board/list of requests      | **Direct Connect board**          | When referring to the collection, use "Direct Connect board" (not "Project Tracker", "Work Board", or "Task board"). |
| Individual DB row               | **Work Request** (internal only)  | Safe for staff/admin and docs; avoid in requester-facing copy except where already present and not confusing. |
| Pro-side pipeline record        | **Project** (contractor-only)     | Allowed in contractor dashboards, tours, and accounting contexts. Must not be used for requesters’ own coordination surfaces. |

---

## 2. Allowed vs. disallowed phrases

### Allowed (requester-facing)

- "Start a Direct Connect request"
- "Your active coordination"
- "This is on your Direct Connect board"
- "Direct Connect is where local coordination happens"
- "View this in Direct Connect"

### Disallowed or legacy (requester-facing)

When talking to **requesters**, Scout and UI **must not** use these phrases going forward:

- "Project Tracker" / "Open Project Tracker"
- "Turn this into a trackable project on my board"
- "Task board" / "Work Board" / "Job board" for the same concept
- "Projects" as a synonym for their coordination items

If any of these appear in:

- Scout suggestions or quick actions
- Requester dashboards
- Direct Connect copy

…they are treated as **bugs**, not product ideas, and can be corrected during the observation window.

---

## 3. Scout routing rules (requester intent)

When a user expresses an intent like:

- "I need an estimate"
- "I need help with X"
- "Can someone local do this?"

Scout must:

- Route that intent into **Direct Connect** for coordination (e.g., `/tasks` or existing request-creation flows).
- Describe this as **starting or managing a Direct Connect request**, not as opening a separate "project" surface.

Concretely:

- ✅ "Start a Direct Connect request for this" → `/tasks`
- ❌ "Open Project Tracker" / "Open my project board" as the primary suggestion for requesters

Contractor/pro surfaces (e.g., `/project-tracker`, `/lead-management`, `/contractor-leads`) remain valid **for pros**, but Scout should **not** recommend them as the primary destination when a requester is asking for help.

---

## 4. Application during the freeze

During the current 14-day observation window:

- Bug fixes include:
  - Replacing legacy requester-facing phrasing ("project tracker", "trackable project", "task board", etc.) with the canonical terms above.
  - Adjusting Scout suggestions so requester intent routes and is described via Direct Connect.
- Product evolution remains frozen:
  - No new flows or surfaces.
  - No new prompts or nudges.
  - No structural changes to contractor/pro pages.

This charter is a **language contract**: if Scout or the UI violate it in requester-facing contexts, that is a **bug to fix**, not a new feature to debate.
