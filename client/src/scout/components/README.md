# Scout OS — Reusable UI Components

All components and CSS classes in this system are annotated with `@reusable` tags in source code.
This file is the master index for finding and reusing any Scout OS UI element across the TradeScout platform.

---

## CSS Classes (index.css)

All classes below are defined in `client/src/index.css` and can be used anywhere in the app.

| Class | Purpose | Reuse Context |
|---|---|---|
| `scout-user-bubble` | User message bubble (right-aligned, orange avatar) | Any chat/thread surface |
| `scout-user-bubble__meta` | User bubble header row (name + time + avatar) | Any chat/thread surface |
| `scout-user-bubble__avatar` | Orange gradient user avatar circle | Any user identity display |
| `scout-user-bubble__body` | User message text container | Any chat/thread surface |
| `scout-assistant-bubble` | Scout/assistant message bubble (left-aligned) | Any chat/thread surface |
| `scout-assistant-bubble__meta` | Scout bubble header row (avatar + name + badge + time) | Any chat/thread surface |
| `scout-assistant-bubble__avatar` | Scout dog avatar circle with orange border | Any Scout identity display |
| `scout-assistant-bubble__badge` | "Community-Powered" pill badge | Any Scout identity display |
| `scout-assistant-bubble__body` | Scout message text container | Any chat/thread surface |
| `scout-live-status` | Orange heartbeat strip (real-time processing state) | Any active Scout surface |
| `scout-live-status__icon` | Orange heartbeat icon | Any live indicator |
| `scout-live-status__dot` | Pulsing orange dot | Any live indicator |
| `scout-intelligence-card` | Full-width Intelligence Layer card | Any Scout result surface |
| `scout-intelligence-card__accent-line` | Orange gradient top line | Any card with accent |
| `scout-intelligence-card__heading` | Large bold white heading (22px) | Any result card heading |
| `scout-intelligence-card__subtext` | Secondary body text | Any result card body |
| `scout-command-bar` | Persistent input/command bar (orange glow on focus) | Any Scout input surface |
| `scout-command-bar__sparkle` | Orange sparkle icon (left of input) | Any Scout input surface |
| `scout-command-bar__input` | Auto-growing textarea | Any Scout input surface |
| `scout-command-bar__mic` | Mic button (subtle circle) | Any Scout input surface |
| `scout-command-bar__send` | Orange circle send arrow | Any Scout input surface |
| `scout-cluster-card` | Dark result card (replaces legacy .scout-result-card) | Any Scout result surface |
| `scout-cluster-card--featured` | Hard orange border + glow (top recommendation) | Featured result items |
| `scout-cluster-card__tag` | "Top Recommendation" pill tag | Featured result items |
| `scout-cluster-card__title` | Card title (17px, bold, white) | Any result card |
| `scout-cluster-card__subtitle` | Card subtitle (12px, muted) | Any result card |
| `scout-cluster-card__open-badge` | "Open Now" green badge | Service/business cards |
| `scout-cluster-card__meta-row` | Distance/time/availability meta row | Service/business cards |
| `scout-tool-tray` | 3-button action tray (2 dark + 1 orange) | Any Scout result surface |
| `scout-tool-tray__btn--secondary` | Dark gray action button | Any action tray |
| `scout-tool-tray__btn--primary` | Solid orange primary action button | Any action tray |
| `scout-section-label` | Uppercase section label with icon | Any Scout module header |
| `scout-section-label__live` | "Live Results" green indicator | Any live data section |
| `scout-trust-footer` | Neutral community-powered attribution footer | Any Scout result surface |
| `morphic-card` | Base dark card (16px radius, subtle border) | Any card surface |
| `morphic-button-primary` | Orange primary button (48px min-height) | Any CTA |
| `morphic-button-secondary` | Dark secondary button | Any secondary action |
| `morphic-status-badge` | Status pill (success=green, warning=orange) | Any status indicator |
| `morphic-data-tile` | Dark data tile (12px radius) | Any data display |

---

## React Components

### `ScoutThread` (`client/src/scout/ScoutThread.tsx`)
The main message thread. Renders user and assistant bubbles, cluster cards, action chips, suggestions, and the live status bar.

**Sub-components (all exported and reusable):**
- `ScoutLiveStatus` — the orange heartbeat strip. Props: `label: string`, `progress: number (0-1)`
- `ClusterCard` — a single result cluster card. Props: `cluster: ScoutCluster`, `onAction?: (action) => void`
- `EvidenceStrip` — collapsible "Why this answer" provenance strip. Props: `msg: ScoutMessage`, `enabled: boolean`
- `MessageExtras` — action chips, cluster cards, override options, suggestions below any message
- `AssistantStreamedText` — animated character-by-character text reveal

### `ScoutInputRow` (`client/src/scout/ScoutInputRow.tsx`)
The Morphic command bar. Orange border glow on focus, sparkle icon, auto-growing textarea, mic button, orange send arrow.

**Key props:**
- `isBusy: boolean` — disables input during processing
- `heroLocationLabel?: string` — shows location pill above bar
- `onSend: (value: string) => void` — called on submit
- `quickStartPrompts?: string[]` — shows up to 3 prompt chips above bar
- `enableAutoDemo?: boolean` + `autoDemoText?: string` — auto-types a demo query on first visit

### `ScoutHome` (`client/src/scout/ScoutHome.tsx`)
The default home surface (no-query state). Location pill, ready card, local snapshot tiles, trending prompts, recent activity, trust footer.

**Key props:**
- `onPromptSelect: (text: string) => void` — called when user taps a prompt chip
- `location: ScoutLocationState` — from `useScoutLocation` hook

### `IntelligenceLayer` (`client/src/scout/IntelligenceLayer.tsx`)
The full-width Intelligence Layer card shown after a Scout response. Orange accent line, large heading, subtext, particle graphic, footer badge.

---

## Hooks

### `useScoutLocation` (`client/src/scout/hooks/useScoutLocation.ts`)
Bridges `useLocationContext` (profile/session) with browser → IP → manual fallback chain.
Returns: `{ county, state, city, displayLabel, isLoading, error, requestBrowserGeo, setManual }`

### `useScoutHomeSnapshot` (`client/src/scout/hooks/useScoutHomeSnapshot.ts`)
Fetches real local data for the home surface (listings, pros, events, members, trending prompts).
Returns: `{ data, isLoading, error }`

---

## Design Tokens

All tokens are defined as CSS custom properties in `client/src/index.css` and as Tailwind extensions in `tailwind.config.ts`.

| Token | Value | Use |
|---|---|---|
| `--ts-orange` / `ts-orange` | `#f97316` | Primary brand accent |
| `--ts-orange-dark` | `#ea580c` | Hover/active state |
| `--ts-surface-card` | `#111111` | Card backgrounds |
| `--ts-surface-elevated` | `#141414` | Elevated card backgrounds |
| `--ts-surface-input` | `#1a1a1a` | Input backgrounds |
| `--ts-border-subtle` | `rgba(255,255,255,0.08)` | Default card borders |
| `--ts-border-active` | `rgba(249,115,22,0.35)` | Active/focus borders |
| `--ts-text-primary` | `#fafafa` | Primary text |
| `--ts-text-secondary` | `rgba(250,250,250,0.6)` | Secondary text |
| `--ts-text-muted` | `rgba(250,250,250,0.35)` | Muted/caption text |
| `--ts-green` | `#10b981` | Open/success states |
