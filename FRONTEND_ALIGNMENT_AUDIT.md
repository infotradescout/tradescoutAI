# Frontend Alignment Audit

Goal: make every page accurately reflect what the backend + doctrine already do — no more, no less.

This is a **doctrine + tracking** doc, not a design spec. It is safe during the freeze because it classifies existing UI behavior; fixes that follow are treated as bugs (when they contradict doctrine) or scheduled upgrades (when they are purely visual).

---

## 1. Method

For each major surface:

1. Identify the **backend truth** it represents (objects, states, roles).
2. Describe any **frontend issues**:
   - Wrong or legacy language
   - Extra/hidden states vs DIRECT_CONNECT_STATE_VOCABULARY
   - Misleading ownership (acting like it owns state it doesn’t)
   - Outdated or inconsistent UI that harms trust
3. Assign a **severity**:
   - **High** – contradicts doctrine, misroutes users, or confuses core flows.
   - **Medium** – mostly correct but creates friction or mixed mental models.
   - **Low** – cosmetic / polish only.

Bugs (doctrine violations) are allowed to be fixed during the freeze. Upgrades are queued.

---

## 2. Core surfaces

### Table: initial classification

| Page / Route        | Backend Truth (what it really is)                                             | Frontend Issue (today)                                                                                  | Severity |
|---------------------|-------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|----------|
| Scout (/scout)      | Scout orchestration over multiple objects (Direct Connect requests, community, providers); no primary state ownership. | Largely aligned but historically suggested legacy concepts (projects/boards); some copy still needs ongoing hygiene to always speak in Direct Connect + outcomes terms. | High     |
| Direct Connect (/tasks) | Direct Connect requests (work_requests) and their canonical states; requester-side coordination hub. | Copy and layout now mostly aligned with coordination engine story, but older mental model (“tasks/board”) still implied in adjacent surfaces; must be the **only** place new coordination starts. | High     |
| Community (/community, feeds) | Community posts + limited surfacing of Direct Connect requests for distribution/visibility. | Generally correct but can over-emphasize posting as a way to get help instead of reinforcing Direct Connect as the hub with community as amplification. | Medium  |
| Contractors (/contractors) | Provider profiles (organizations) that respond to Direct Connect requests; conceptually the **Contractors tab** that hangs off the Direct Connect hub. | Still feels like a standalone marketplace in some flows; needs copy and navigation context that clearly frame this as a tab under Direct Connect, not a separate job board. | Medium  |
| Helpers (/helpers or worker marketplace) | Individual responder profiles (Helpers) that **should** respond to Direct Connect requests alongside contractors. | Currently feels like a side product; UI and language do not clearly state “Helpers are first-class responders to Direct Connect requests” and may imply a separate marketplace. | High     |
| Dashboard(s)        | Aggregated views over Direct Connect requests, provider activity, finances, etc. | Legacy widgets and removed tours still shape expectations; some labels (e.g., “My Projects”) point to pro pipelines while requesters see “projects” language that conflicts with the new vocabulary. | Medium  |

This table is a **starting point**; additional rows should be added for pages like:

- Profile / Settings
- Outcome summary / staff views
- Exchange / Marketplace
- Admin tooling

---

## 3. Bug vs Upgrade tags

For each surface, issues should be tagged as:

- **Bug** – contradicts:
  - DIRECT_CONNECT_VISION.md
  - DIRECT_CONNECT_REQUEST_MODEL.md
  - REQUESTER_VOCABULARY.md
  - SCOUT_READ_ORCHESTRATION_CHARTER.md
  - UNIVERSAL_USER_TOUR_SPEC.md

- **Upgrade** – UI/UX polish, layout, and consistency improvements that do *not* change flows or doctrine.

Only **Bug** items are eligible for immediate, freeze-safe fixes.

---

## 4. Next actions

1. Expand this table incrementally (one surface at a time).
2. For each row, list specific bugs vs upgrades under sub-bullets when needed.
 3. Use this doc as the source of truth when deciding:
    - What to clean up now as trust/clarity bugs.
    - What to schedule later as part of a structured frontend modernization pass.

---

## 5. Per-surface notes (in progress)

### Scout (/scout)

**Backend truth**

- Scout is an orchestrator and narrator over existing objects (Direct Connect requests, community posts, contractors, helpers, exchange listings).
- It does not own primary state; it reads from APIs and sends users to the correct surfaces (e.g., `/tasks`, `/community`, `/contractors`, `/exchange`).

**Bugs (fixed earlier)**

- Main input placeholder previously centered "projects"; it now says "Ask Scout about work, pros, or issues near you…" to avoid teaching "projects" as the canonical requester concept.
- Onboarding quick action for getting started used legacy phrasing; it now offers "Start a Direct Connect request" with prefilled text "Help me start a Direct Connect request for this." and treats that phrase as a direct navigation to `/tasks` instead of a separate surface.
- Guest account prompt originally framed value around saving projects; it now says "Save your area and requests" and explicitly mentions keeping **Direct Connect requests** synced.
- The "Your Active Coordination" and "What Scout Has Already Done" side panels were updated to:
   - Speak in terms of Direct Connect, active coordination, and the Direct Connect board.
   - Make clear that Scout explains and routes, while Direct Connect remains the state owner.

**Current status (audit)**

- No remaining requester-facing copy in the Scout surface references "project tracker", "task board", or "trackable project" as a primary concept.
- All deterministic quick actions and tiles that start new coordination route to `/tasks` and describe this as starting a **Direct Connect request**.
- Contextual tiles that mention "projects" or "active projects" are limited to contractor/pro modes backed by `/api/dashboard → myProjects`, which is allowed per REQUESTER_VOCABULARY for pro-side pipelines.
- Scout front-end code only reads Direct Connect state (e.g., `/api/work-requests` in `ScoutDirectConnectPanel`) and never posts new work requests directly; it navigates users into Direct Connect instead, honoring SCOUT_READ_ORCHESTRATION_CHARTER.

**Upgrades (queued)**

- Clarify Scout's role even more explicitly in the hero area for first-time guests (e.g., a short line that says "Scout reads what’s already in motion and suggests where to go" without adding new flows).
- Eventually surface more of the DIRECT_CONNECT_STATE_VOCABULARY phrases in Scout’s summaries so status labels match the requester's view in Direct Connect.

### Direct Connect (/tasks)

**Backend truth**

- Represents WorkRequest records (the internal schema) surfaced to the requester as **Direct Connect requests**.
- Shows active coordination and basic state (status, budget, created date) for each request.

**Bugs (fixed)**

- Toast after creating a request used non-canonical language:
   - "Work request posted" and "Your request is now on your board." → now: "Direct Connect request posted" and "This is now on your Direct Connect board." (REQUESTER_VOCABULARY alignment).
- Error toast said "Couldn't create work request" → now "Couldn't create Direct Connect request".
- Empty state copy in Active coordination referenced "a project, service, or help" → now softened to "something big, a service, or help" to avoid overloading "project" for requesters.
- Request creation header and body copy were framed around "Work Request" → now "Create a new Direct Connect request" and description explains this as the request object Scout and community use.
- Unauthenticated message said "create Work Requests" → now "create Direct Connect requests".
- Form label "Task type" (with internal `taskTaskType`) → now user-facing label "Request type" to avoid treating "task" as the primary concept.
- Pay type option label "Per task" → now "Per job" while keeping internal enum `per_task` untouched.
- Primary submit button used "Post Work Request" → now "Post Direct Connect request".

**Upgrades (queued)**

- Visual/UI is modern and mostly consistent but could eventually:
   - Explain state more explicitly using DIRECT_CONNECT_STATE_VOCABULARY phrases instead of raw status strings.
   - Offer clearer summaries of "Active coordination" vs resolved history.
   - Add richer feedback around routing (e.g., when Scout or community has taken specific actions).

### Community (/community and related feeds)

**Backend truth**

- Community surfaces (community landing and feed) represent county-scoped posts, comments, and system updates.
- They are **distribution and conversation surfaces**: places to share updates, ask for recommendations, and see what’s happening locally.
- Direct Connect remains the coordination hub; community can send posts into Direct Connect (e.g., "Send to Direct Connect" on posts) but does not own work request state.

**Bugs (fixed)**

- Community empty state copy led with "Share a project update" and an example phrase "Sharing before/after photos from a recent project", which reinforces "project" as the core requester concept instead of coordination via Direct Connect.
   - Updated to "Share an update, ask for a recommendation, or post a tip for your neighbors." and "Sharing before/after photos from a recent repair or upgrade". This keeps community framed as conversation while avoiding misuse of "project" for requesters.

**Current status (audit)**

- Community posting flows talk about posts, alerts, recommendations, and discussions, not about trackers or boards.
- Posts can be escalated into Direct Connect through the existing "Send to Direct Connect" action on CommunityPostCard, which:
   - Creates a WorkRequest server-side via `/api/community/posts/:id/send-to-board`.
   - Shows a "✓ Sent to Direct Connect" acknowledgement and a "View Direct Connect" navigation that routes to `/tasks`.
- No community copy claims to be the place where work is coordinated; it positions itself as a feed for conversation and visibility.

**Upgrades (queued)**

- Consider a short explainer near the composer or in a pinned system post that makes the relationship explicit: Direct Connect for coordination, community for visibility and discussion.
- Over time, align community system posts (like "How projects stay local") to mention Direct Connect by name where appropriate, so users can see the connection between the local project language and the Direct Connect request model.

### Helpers (/helpers, /worker-marketplace)

**Backend truth**

- Represents individual Helper profiles and helper-side task listings.
- Conceptually the **Helpers tab under Direct Connect**: helpers respond to Direct Connect requests and contractor crew needs instead of owning a separate task marketplace.

**Bugs (fixed)**

- Helpers landing header framed the surface as a "Two-way marketplace" where homeowners and contractors post generic tasks/jobs, weakening Direct Connect as the canonical coordination hub.
   - Updated header to "Helpers · Direct Connect Responders" and copy that states: "This is the Helpers tab under Direct Connect" and emphasizes helpers responding to homeowner Direct Connect requests.
- Primary CTA on Helpers previously said "Start a project (Direct Connect)" while linking to `/tasks`, mixing project language with the Direct Connect concept.
   - Now reads "Go to Direct Connect" and remains a straight navigation to `/tasks`.

**Current status (audit)**

- Helpers page and nav labels consistently use "Helpers" and reference Direct Connect as the coordination owner.
- Contractor dashboard card for crew/helpers now speaks about coordinating crew and helpers alongside Direct Connect jobs (rather than "Post a job"), keeping requester coordination vocabulary consistent.
- Task posting within Helpers still uses internal `/api/tasks` schema; this is treated as a pro/helper-side mechanism and is not presented as the primary requester coordination path.

**Upgrades (queued)**

- Longer term, converge helper-side task objects and Direct Connect requests more explicitly (or clearly segment them as pro-side only) so Helpers reads purely as a responder tab off Direct Connect.
- Consider shallow explainer text that connects Helpers and Direct Connect for both homeowners and helpers.

### Dashboards (/dashboard and role dashboards)

**Backend truth**

- Dashboards aggregate state across Direct Connect requests, provider activity, finances, and community signals to give role-specific overviews (homeowner, contractor, HOA, staff).
- They are **views over coordination and activity**, not the source of coordination objects.

**Bugs (fixed)**

- Homeowner dashboard empty state told users it would fill in as they "post projects" and suggested starting by "posting a job" via Helpers.
   - Message now says the dashboard fills in as they start Direct Connect requests and work with contractors, and the primary CTA is "Open Direct Connect" → `/tasks` (secondary CTA remains "Browse contractors").
- Community-first dashboard empty state described itself as a place to keep track of "projects, saved pros, and activity".
   - Now refers to "your Direct Connect requests, saved pros, and activity" so the canonical requester object stays in view.

**Current status (audit)**

- Core dashboard widgets (RecentProjectsWidget, etc.) remain pro-side concepts and are not exposed as requester coordination tools.
- Homeowner dashboard and main dashboard no longer advertise projects/jobs as the primary way to start coordination; they point users toward Direct Connect and supporting surfaces (contractors, community) instead.

**Upgrades (queued)**

- Clarify per-role dashboard copy to explicitly state their relationship to Direct Connect (e.g., "view across your Direct Connect requests" for homeowners, "pipeline across Direct Connect jobs" for contractors).
- Continue replacing any remaining generic "projects" wording in requester-visible dashboard summaries with Direct Connect language, while leaving pro pipelines intact.