# My TradeScout Smoke Test

This checklist is the canonical smoke test for the My TradeScout dashboard. It is designed to be short enough to run frequently while validating truthfulness, suppression-by-default, and relevance.

## How to run it

Treat this as a **binary audit**, not exploratory testing. For each step, mark:

- ✅ Pass
- ❌ Fail (note exact route + screenshot)

Run time: ~10–15 minutes end-to-end.

## Checklist

1. **Auth & access**
   - From any page, click the main nav "My TradeScout" → confirm you land on `/my-tradescout` and never see a login wall if already authenticated.
   - In a private/incognito window, hit `/my-tradescout` directly:
     - Expected: redirect or guard to login (no partial dashboard, no mock content).
     - After login, you should land cleanly on My TradeScout (or your normal post-login flow) and can reach it from the nav.

2. **Context card (location + roles)**
   - With a user that has `location.county` + `location.state`:
     - "Your current context" shows "County, ST".
     - Roles line lists actual roles (comma-separated) or a single primary role.
     - CTAs visible:
       - "Update profile & roles" → `/profile-settings`.
       - "Ask Scout about my next step" → `/scout`.
   - With a user missing county/state:
     - Location line honestly indicates that county is not confirmed (no fallback geo).
     - Recommended Actions should include a "Confirm my address" CTA → `/address-verification`.

3. **In-progress threads**
   - With at least one active project from `/api/dashboard`:
     - "In progress" section appears with 1–4 rows.
     - Each row:
       - Shows project title (or "Project" if no title).
       - Shows type `project`.
       - Has "Open in Project Tracker" button → `/project-tracker`.
   - With no active projects:
     - "In progress" section is completely absent (no empty frame or fake items).

4. **Next best actions**
   - Homeowner-type user, has county/state, no projects:
     - Recommended Actions includes:
       - "Start a project with Direct Connect" → `/direct-connect`.
     - No role-confused language (e.g., contractor-specific phrasing).
   - Contractor user (`contractor_user` or `accelerator_member`) with no projects:
     - Recommended Actions includes:
       - "Browse contractor leads" → `/contractor-leads`.
   - Realtor user with no projects:
     - Recommended Actions includes:
       - "Open real estate marketplace" → `/real-estate-marketplace`.
   - When projects and county are set:
     - Recommendations shrink or disappear; no spammy generic CTAs.

5. **Opportunities section**
   - With `stats.savedContractors > 0`:
     - Opportunities include:
       - "Review your saved contractors" → `/saved-contractors`.
   - With zero saved contractors:
     - "Review your saved contractors" is not shown.
   - In all cases:
     - "See what is happening in your community feed" → `/community-feed` is present.
     - No promotions, deals, or affiliate content appear here.

6. **Right-column widgets**
   - On `/my-tradescout`, right column should include only:
     - `QuickActionsWidget`
     - `RecentProjectsWidget`
     - `SavedContractorsWidget`
     - `CommunityBuilderImpactWidget`
   - Verify:
     - These widgets use real APIs (`/api/dashboard`, `/api/community-builder/profile`) or neutral navigation.
     - No hard-coded earnings, KPIs, or demo metrics are shown.
     - Mock-like widgets (ActivityStats, MessagesPreview, Notifications, AffiliateStats) do not appear on this page.

7. **Promotion gating**
   - On `/my-tradescout`:
     - No TradeDeals, ads, affiliate earnings, or promotions are visible.
     - No banners or tiles mention "deals near you" or similar.
   - Optional spot-check:
     - `/daily-deals/...` and nationwide metrics endpoints behave truthfully (real data or honest "temporarily unavailable"), but My TradeScout itself does **not** surface promo content.

8. **Chat → Dashboard handoff**
   - From `/scout`:
     - Ask "What should I do next in TradeScout?" and "Open my dashboard".
     - Confirm Scout:
       - Refers to My TradeScout conceptually (not role dashboards or KPIs).
       - Suggests actions that exist and are visible on `/my-tradescout`.
       - Avoids promises of analytics, earnings, or performance views that don’t exist.
        - Note: Scout is explicitly instructed in `server/cache/manual/system_prompt.md` to use My TradeScout phrasing and avoid terms like "dashboard metrics", "performance overview", or "earnings/KPIs".

## Log template

Copy this into a note when you run the test:

My TradeScout Smoke Test — [date]

1. Auth & access: PASS / FAIL (notes)
2. Context card: PASS / FAIL (notes)
3. In-progress threads: PASS / FAIL (notes)
4. Next best actions: PASS / FAIL (notes)
5. Opportunities section: PASS / FAIL (notes)
6. Right-column widgets: PASS / FAIL (notes)
7. Promotion gating: PASS / FAIL (notes)
8. Chat → dashboard handoff: PASS / FAIL (notes)

Issues found:
- [route/component]: [what looked wrong]

## Operational guidance

If a failure is found:

1. Identify one component or API causing the issue.
2. Ask: "Should this be suppressed, emptied, or reworded?"
3. Make the smallest possible change that restores truthfulness.

No refactors. No redesigns. All changes must respect the TradeScout Authority Contract and be justified in terms of truthfulness, suppression-by-default, and relevance.

Note: My TradeScout and the public landing hero may show a single line of contextual copy backed by `/api/aggregates/context`. Numbers only appear when that API returns non-null aggregate counts; otherwise, neutral fallback text is shown.
