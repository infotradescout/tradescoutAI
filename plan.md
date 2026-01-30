# TradeScout Browser Extension — Plan

## Goal
Ship a lightweight TradeScout browser extension that:
- Surfaces TradeScout context/actions while users browse (contractor lookup, notes, share-to-TradeScout).
- Improves capture-to-trust workflows (save pages, screenshots, contact info) into TradeScout.
- Supports both consumer use (homeowners) and internal/admin workflows (moderation, QA, ops).

## Target Browsers
- Chrome + Chromium (Chrome, Edge, Brave) via Manifest V3
- Firefox (MV3 support varies) with a compatibility layer and a Firefox-specific build if needed

## Core Use Cases (MVP)
1. **Quick Search / Lookup**
   - Popup search: county + category + name
   - Open results in `thetradescout.com` (deep links)

2. **Save Page to TradeScout**
   - One-click “Save” that captures:
     - URL, title, selected text, page metadata (OpenGraph where possible)
     - Optional notes + tags (county, category)
   - Sends to TradeScout as a “Saved Item” via API

3. **Context Menu Actions**
   - Right-click on selection/link:
     - “Search TradeScout for selection”
     - “Save link to TradeScout”

4. **Authentication**
   - Uses existing TradeScout auth:
     - Prefer `chrome.identity.launchWebAuthFlow` (Chromium) / equivalent
     - Falls back to “Sign in” web page + token handoff to extension
   - Stores tokens securely (extension storage) and supports logout

## Optional MVP+ Enhancements
- **Detect contractor/contact info on page** (heuristics) and offer “Create lead / profile draft”
- **Screenshot capture** of visible tab region to attach to saved items
- **Notifications** when a saved item is processed (e.g., match found)

## Non-Goals (Initial Release)
- Full in-extension browsing experience
- Automated scraping at scale
- Background crawling/indexing (avoid store-policy and trust issues)

## Architecture
- **Popup UI**: React (or lightweight vanilla) + Tailwind (optional)
- **Background service worker** (MV3): handles auth, API calls, context menus, messaging
- **Content script**: minimal; only for selection extraction, metadata read, optional detection
- **Native host**: none (avoid OS-level complexity for v1)

## Data Flow
1. User triggers action (popup/button/context menu)
2. Extension gathers metadata (URL/title/selection/OG tags via content script)
3. Background worker sends to TradeScout API with auth token
4. API stores as “Saved Item” / “Lead” and returns an ID + deep link
5. Extension shows success + “Open in TradeScout”

## TradeScout API Work Needed
- `POST /api/extension/saved-items`
  - Body: `{ url, title, selection?, notes?, tags?, source: "extension" }`
  - Response: `{ id, link }`
- Token validation compatible with existing auth/session strategy
- Rate limiting + abuse controls (per user)
- Audit logging (who saved what, when)

## Permissions (Keep Minimal)
- `storage` (save auth/session + settings)
- `activeTab` (read current tab URL/title when user initiates)
- `scripting` (inject content script only on demand)
- `contextMenus` (right-click actions)
- Host permissions:
  - `https://www.thetradescout.com/*`
  - `https://thetradescout.com/*`
  - Add staging domains as needed

## UX Requirements
- Fast popup (sub-200ms perceived)
- Clear auth state (signed in/out)
- Explicit user initiation for any page reading/capture
- Transparent “what will be sent” preview before saving (optional toggle)

## Security / Privacy
- No persistent full-page scraping
- No data exfiltration without explicit user action
- Token storage:
  - Prefer short-lived access tokens + refresh
  - Store refresh token with strict scope and rotation
- CSP locked down (no remote code execution)
- Signed builds + reproducible build output where possible

## Repo Layout Proposal
- `extension/`
  - `src/`
    - `background/` (service worker)
    - `content/`
    - `popup/`
    - `shared/` (types, API client)
  - `public/` (manifest, icons)
  - `vite.config.ts` or `tsup` config
  - `package.json`

## Build & Release
1. Build outputs:
   - `extension/dist/chrome/`
   - `extension/dist/firefox/` (if needed)
2. Zip artifacts for store uploads
3. Store listing assets:
   - icons (16/32/48/128)
   - screenshots (1280×800)
   - privacy policy + data use disclosure
4. Versioning:
   - Keep extension version aligned with backend API compatibility

## Milestones
1. **Scaffold**: MV3 extension skeleton + popup + background messaging
2. **Auth**: sign-in flow + token storage + logout
3. **Save Item**: metadata capture + API endpoint + UI success state
4. **Context Menu**: selection/link actions
5. **Hardening**: permissions minimization, logging, error UX
6. **Release Prep**: store assets, privacy disclosures, submission

## Open Questions
- Which exact backend auth mechanism should the extension use (cookie session vs token)?
- Do we want separate “Homeowner mode” vs “Admin mode” features?
- Should saved items land in a new “Inbox” in TradeScout, or integrate with existing flows?
