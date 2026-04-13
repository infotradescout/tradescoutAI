# TradeScout Top-Down Repo Audit (2026-04-13)

## Scope
- Repository-wide operational audit across `client`, `server`, `shared`, tests, docs, and build/runtime surfaces.
- Focus: production readiness, law-contract integrity, SEO growth readiness, and execution risk.

## Snapshot
- Tracked files: `3886`
- App code file counts:
  - `client/src`: `715`
  - `server`: `485`
  - `shared`: `31`
- Test-ish files discovered: `181`
- Core platform scripts are extensive (`package.json` includes verify/audit/guard rails).

## Law Integrity Checkpoints
- Visibility != access: `enforced` (contact surfaces remain gated by decision/intent flows).
- Contact is gated: `enforced` (Direct Connect and messaging contracts still present).
- Counties as operational containers: `enforced` (county/state routing and county surfaces present).
- Trust/CVS governs exposure: `policy_target` (widely referenced, but enforcement consistency should be re-audited by route-level tests).
- Admin/UI uses precomputed intelligence: `temporary_exception`
  - owner: platform-eng
  - rationale: read-time fallbacks still appear in some public/directory paths
  - removal date: 2026-06-30

## Findings (Severity Ordered)

### Critical
1. Type safety regression in critical scout path
- `npx tsc -p tsconfig.json --noEmit` prints persistent TypeScript errors concentrated in:
  - `server/routes/scout.ts`
  - `client/src/pages/direct-connect/DirectConnectShell.tsx`
  - `client/src/scout/ScoutOS.tsx`
- Risk: release confidence and regression detection are materially reduced.

2. Search/index health still unstable
- Search Console issues reported: `5xx`, `soft 404`, and large `crawled - currently not indexed`.
- Risk: acquisition ceiling and crawl-budget waste.

### High
3. Architectural concentration around scout route
- `server/routes/scout.ts` is carrying too many responsibilities (routing, decisioning, fallback, response composition).
- Risk: brittle changes and slow onboarding.

4. Documentation sprawl / stale planning artifacts (partially remediated)
- Legacy plan-doc clutter was causing execution drift and conflicting directives.
- Action in this change set: old plan files removed and replaced with one current audit + one current plan.

### Medium
5. Inconsistent metadata quality across public pages
- Recent fixes improved canonical and title behavior, but page-level intent copy still requires staged uplift.

6. Lint warning volume remains high in touched zones
- Commit hooks pass with warnings, but warning density is still high in community/county/scout-adjacent areas.

## Strengths
- Strong script-based governance (`verify`, `audit:*`, `guard:*`).
- Good breadth of route and contract test files.
- Clear domain model for county/trust/contact constraints.
- SEO scaffolding exists on both client and server public-html paths.

## Recommended Operating Model (Immediate)
1. Stabilize compile reliability (TS errors to zero in core path).
2. Close crawl blockers (`5xx`, `soft 404`) before further SEO surface expansion.
3. Continue intent-page program (consumer + business) with strict internal-linking hierarchy.
4. Enforce law drift guard in release gates as a non-optional pass.

## Exit Criteria For “Green” State
- `tsc --noEmit` clean for app-critical paths.
- Search Console `5xx` and `soft 404` materially reduced and trending down.
- Canonical/indexing validation pass confirmed post-recrawl.
- One source-of-truth roadmap active (no shadow plan files).
