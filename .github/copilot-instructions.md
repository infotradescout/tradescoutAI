# Copilot Instructions for TradeScout

## 1. Mission: AI as the site controller

- The **AI chat experience is the primary controller** for the TradeScout website.
- Users should be able to:
  - Perform all major site actions **from inside the chat box**.
  - Receive **links and actions attached to chat bubbles** that open the correct pages or trigger flows.
  - Have the agent **read/write to knowledge bases and caches** on their behalf (projects, contractors, communities, etc.).
- When adding or changing features, assume:
  > "How would Scout do this for the user in chat?"  
  and build that path first, then the direct UI.

---

## 2. Repo structure & projects

- This folder contains **at least two front-end surfaces**:
  - An **AI app** (chat controller) – e.g. `App.tsx` + `components/Chatbot.tsx` / `ProjectAssistant.tsx`.
  - A **broader site experience** (pages for community, contractors, projects, etc.) in sibling code.
- Treat the non-AI pages as **tools / surfaces** that the AI orchestrates:
  - The AI decides *what* to do.
  - The site pages/components are *where* the action visually happens.

When wiring new code, prefer:

- AI-side: add intents, tool calls, and message metadata.
- Site-side: expose clean functions / routes that the AI can call.

---

## 3. Chat message model & actions

When working on chat-related code (e.g. `components/Chatbot.tsx`):

- Represent messages with a **typed structure** that can carry actions and links, not just text. For example:

  ```ts
  export type ChatLink = {
    label: string;
    href: string;
    kind: "internal" | "external";
  };

  export type ChatAction =
    | { type: "NAVIGATE"; path: string }
    | { type: "CALL_TOOL"; name: string; args: unknown };

  export interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    text: string;
    links?: ChatLink[];
    actions?: ChatAction[];
    createdAt: string;
  }
  ```

- Do not hide URLs in raw text; prefer links on the message and render them as buttons/chips in the UI.
- Navigation from chat should use `NAVIGATE` actions that call the site router (e.g. go to `/community`, `/projects/:id`, `/hoa-dashboard/...`).
- Any new chat feature must decide:
  - What text to show.
  - What links to attach.
  - What actions (if any) the UI should be able to trigger.

---

## 4. Agent "tools" and site integration

Treat core site capabilities as agent tools exposed via typed wrappers, not ad-hoc fetches scattered across components.

Create and extend a small tool layer, e.g. under `src/agent/tools/`:

```ts
// Example: a typed tool wrapper
export async function searchContractors(args: {
  stateCode: string;
  trade: string;
}) {
  const res = await fetch(
    `/api/contractors/search?state=${args.stateCode}&trade=${args.trade}`
  );
  if (!res.ok) throw new Error("Failed to search contractors");
  return res.json();
}
```

The chat controller should call these tool functions, then:

- Update the conversation with a message summarizing the result.
- Attach links into the site (e.g. `/contractors?trade=plumber&state=TX`) so the user can click through.

When adding new site features, always:

1. Add/extend a tool function (backend interaction).
2. Plug it into the chat agent as an action.
3. Optionally build a dedicated page/component for richer UI.

---

## 5. Knowledge base & caching

All long-lived user or community data (projects, preferences, local context) should go through a knowledge/caching layer, not be stored ad-hoc in React state.

Wrap knowledge-base operations behind functions (e.g. `src/agent/knowledgeBase.ts`) such as:

```ts
export async function upsertUserNote(userId: string, note: string) {
  const res = await fetch("/api/agent/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, note }),
  });
  if (!res.ok) throw new Error("Failed to save note");
  return res.json();
}
```

When the agent learns something about a user’s project or preferences that should persist, call these wrappers from the chat flow.

Avoid writing directly to storage or DB from UI components; go through the agent/knowledge abstractions.

---

## 6. Front-end patterns & conventions

- Use TypeScript React function components in `.tsx` files.
- Match existing styling patterns:
  - If current components use utility classes (e.g. Tailwind-like), copy that approach.
  - Keep layouts clean and “app-like” rather than marketing-page heavy.
- Use a central Agent/Chat context (if present) to share state between:
  - Chat UI (`Chatbot` or `ProjectAssistant` components).
  - Global layout / main site components (for navigation and side effects).

When adding a new page or component, ask:

> “What is the AI version of this?”

and expose:

- Tool function(s).
- Link path(s) the agent can generate.
- Any knowledge-base operations.

---

## 7. Dev, build, and tests

- Always read `package.json` for actual script names; don’t invent new ones in suggestions.
- Use existing scripts like `dev`, `build`, `test` if present.
- If you add new scripts, keep them short and conventional (e.g. `dev:ai`, `dev:site`) and ensure they’re documented in the README.
- If there are tests for chat/agent behavior, mirror their patterns when adding new tools or message flows.

---

## 8. Safety & brand boundaries

- This codebase is for TradeScout. Do not mix Trader’s Corner, MealScout, or unrelated brands/features into this app.
- Keep the mental model:
  - **TradeScout = local trades & community assistant.**
  - **AI chat = Scout controller for everything in this site.**
- When in doubt, route new features through the chat first.
