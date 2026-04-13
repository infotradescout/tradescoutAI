# TradeScout Execution Roadmap (Q2 2026 Reset)

## Mission
Ship a stable, crawlable, law-aligned TradeScout that grows both:
- Demand side: people searching for local businesses/services.
- Supply side: contractors and local businesses seeking qualified opportunities.

## Phase 0 (48 hours): Stabilize the release floor
1. TypeScript recovery sprint
- Scope:
  - `server/routes/scout.ts`
  - `client/src/pages/direct-connect/DirectConnectShell.tsx`
  - `client/src/scout/ScoutOS.tsx`
- Definition of done:
  - `npx tsc -p tsconfig.json --noEmit` no critical-path errors.

2. Indexing blocker triage
- Use Search Console buckets as queue:
  - `Server error (5xx)`
  - `Soft 404`
  - `Crawled - currently not indexed` (top templates first)
- Definition of done:
  - top offending templates identified and patched.

## Phase 1 (Week 1): Acquisition architecture hardening
1. SEO template standards
- Enforce title/description conventions by page type:
  - county pages: `Find Contractors in {County}, {ST} | TradeScout`
  - trade-state pages: `{Trade} Contractors in {State} | TradeScout`
  - trade-city pages: `{Trade} in {City}, {ST} | TradeScout`

2. Internal linking graph
- Ensure high-authority pages link into:
  - `/find-local-businesses`
  - `/for-businesses`
  - `/trade`
  - `/county-directory`
  - `/direct-connect`

3. Logo/identity consistency
- Keep favicon/manifest/OG/schema image references synchronized and cache-busted.

## Phase 2 (Week 2): Law-contract enforcement expansion
1. Gate-flow verification suite
- Add/extend contract tests around:
  - intent -> decision -> contact sequence
  - county-context routing consistency
  - trust/CVS exposure controls

2. Law integrity classification maintenance
- All new law statements must include:
  - `enforced` / `policy_target` / `temporary_exception`
- Temporary exceptions must include:
  - owner, rationale, removal date.

## Phase 3 (Weeks 3-4): Growth loops
1. Demand loop
- Publish and interlink new local intent pages (trade/county/city long-tail).
- Improve CTR with query-aligned titles and concise descriptions.

2. Supply loop
- Expand “for businesses” acquisition surfaces.
- Improve conversion path from informational pages to `/contractors/apply` and `/direct-connect`.

3. Measurement
- Weekly KPI review:
  - indexed pages delta
  - impressions/clicks by page group
  - non-brand query growth
  - contractor apply starts/completions

## Ownership Matrix
- Platform stability: backend/scout owners
- SEO templates and metadata: growth + frontend
- Law drift and guardrails: architecture/governance owner
- Search Console operations: growth ops

## Weekly Cadence
1. Monday: blocker review (`tsc`, 5xx, soft 404, law drift)
2. Wednesday: growth implementation check-in (pages/links/metadata)
3. Friday: KPI + release gate decision

## Stop-Doing List
- No parallel “master plan” files.
- No undocumented temporary exceptions.
- No feature expansion before blocker classes are contained.
