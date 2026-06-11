# TradeScout Repo Lanes

## Repo

- Name: TradeScout
- Repository: `infotradescout/tradescoutAI`
- Default branch: `main`
- Primary local validation command: `npm run check`

## Repo Doctrine

This repository is TradeScout only. Never import MealScout, Trader's Corner, Sway, Albion, AutoBott, or other brand assets, copy, concepts, or doctrine.

TradeScout law must be preserved:

- Visibility does not equal access.
- Contact is gated: Intent -> Decision Card -> Contact.
- Claims-first signup; verification is adaptive/contextual.
- Counties are operational containers.
- County intelligence precomputes into:
  - `county_metrics`
  - `county_entities`
  - `county_notes`
- No pay-to-play.
- No lead selling.
- Read-only global community view is allowed; global action is not.
- Trust/CVS governs exposure.
- AI and SEO ingestion precede feature expansion.
- Never remove features; fix and harden.

Current product-surface doctrine:

- Direct Connect is the primary TradeScout product surface.
- Direct Connect is allowed as public product copy.
- Do not ban the phrase "Direct Connect".
- Ban internal/architecture framing such as:
  - routing algorithm
  - authority layer
  - backend routing system
  - handoff doctrine
  - internal process jargon
- Scout is search, local summary, discovery, and guided bridge. Do not frame Scout as an AI chatbot.
- TradeScout is for businesses and their community. Do not narrow it to only contractors/homeowners unless the slice explicitly targets contractor/homeowner SEO intent.
- Contractor wording is allowed only as SEO/search/trade subset language or legacy compatibility detail.

## Branch Naming Convention

Use one branch per lane:

```text
codex/<lane-name>
```

Examples:

```text
codex/public-discovery-business-entry
codex/direct-connect-kpi-funnel-lock
codex/business-claim-entry-hardening
codex/public-seo-route-contracts
codex/production-smoke-guardrails
codex/parallel-ai-execution-docs
```

Do not stack unrelated work on a lane branch. If a lane uncovers another lane's work, stop and report the dependency.

## Safe Parallel Lanes

### Lane A: Public Discovery + Business Entry

Branch:

```text
codex/public-discovery-business-entry
```

Goal:

Lock `/find-local-businesses` and `/for-businesses` as broad business/community public entry surfaces with Direct Connect as the primary action path.

Allowed files:

- `client/src/pages/find-local-businesses.tsx`
- `client/src/pages/for-businesses.tsx`
- `client/src/pages/for-businesses.contract.test.ts`
- `server/tests/business-genericization.contract.test.ts`
- `server/tests/tradescout-public-discovery-business-entry.contract.test.ts`
- Narrow related public-copy contract files when necessary.

Banned files:

- Direct Connect API behavior files.
- Auth/session/onboarding route logic, unless the lane reports a boundary issue first.
- Database schema and migrations.
- Payment code.
- Merlin, MealScout, Trader's Corner, Sway, Albion, AutoBott docs or assets.

Validation expectations:

- `npm run test:run -- server/tests/business-genericization.contract.test.ts client/src/pages/for-businesses.contract.test.ts`
- Add and run the lane contract if created.
- `npm run check`

### Lane B: Direct Connect KPI Funnel Lock

Branch:

```text
codex/direct-connect-kpi-funnel-lock
```

Goal:

Lock Direct Connect request funnel analytics and contracts from request start through visible/action events.

Allowed files:

- `client/src/pages/direct-connect/**`
- `client/src/lib/analytics*`
- `server/tests/direct-connect-*.test.ts`
- `server/tests/core-product-kpi-event-delivery.contract.test.ts`
- Narrow event contract files directly tied to Direct Connect funnel analytics.

Banned files:

- Public landing copy and CTA doctrine.
- Onboarding route selection.
- Database schema and migrations unless explicitly assigned.
- Production smoke scripts unless the lane is reassigned.
- Payment code unless explicitly assigned.

Hard rules:

- No brokered lead-selling language.
- No anonymous posting restoration.
- No weakening contact gate.
- No bypass around Trust/CVS or Decision Card requirements.

Validation expectations:

- Direct Connect lane contracts relevant to changed files.
- KPI/event contract tests relevant to changed files.
- `npm run check`

### Lane C: Business Claim/Profile Entry Hardening

Branch:

```text
codex/business-claim-entry-hardening
```

Goal:

Align `claim-my-business`, `businesses/apply`, and provider profile entry paths with broad business framing.

Allowed files:

- `client/src/pages/claim-my-business*`
- `client/src/pages/contractor-apply.tsx`
- `client/src/pages/BusinessProfileView.tsx`
- `client/src/AppRoutes.tsx` only for claim/apply/profile route assertions or compatibility aliases.
- `server/tests/business-genericization.contract.test.ts`
- Narrow claim/profile contract tests.

Banned files:

- Direct Connect backend behavior.
- Public landing CTA copy unless Gawain assigns this lane to touch it.
- Database schema and migrations.
- Payment code.
- MealScout or other brand assets/docs.

Hard rules:

- Legacy contractor route names can remain compatibility details only.
- Do not remove working legacy aliases without an explicit migration slice.
- Preserve claims-first signup and adaptive verification.

Validation expectations:

- `npm run test:run -- server/tests/business-genericization.contract.test.ts`
- Claim/profile route or page contracts relevant to changed files.
- `npm run check`

### Lane D: Public SEO Route Contracts

Branch:

```text
codex/public-seo-route-contracts
```

Goal:

Expand public SEO route contract coverage without product behavior changes.

Allowed files:

- `server/tests/core-public-pages-seo.contract.test.ts`
- `server/tests/*seo*.test.ts`
- `server/tests/*public*contract*.test.ts`
- Public page metadata contract files.
- Public page files only when a contract exposes actual drift and the fix is narrowly metadata/copy scoped.

Banned files:

- Route refactors.
- Auth/onboarding route logic.
- Direct Connect behavior.
- Database schema and migrations.
- Production smoke scripts unless reassigned.

Hard rules:

- Tests first.
- Do not rewrite public copy unless the contract exposes actual drift.
- Do not narrow TradeScout to contractors/homeowners only.

Validation expectations:

- `npm run test:run -- server/tests/core-public-pages-seo.contract.test.ts`
- Any affected SEO/public route contracts.
- `npm run check`

### Lane E: Production Smoke/Freshness Guardrails

Branch:

```text
codex/production-smoke-guardrails
```

Goal:

Strengthen deploy freshness and public HTML smoke checks so stale deploys and missing server-rendered public-entry HTML are caught.

Allowed files:

- `scripts/*smoke*`
- `server/tests/*smoke*.test.ts`
- `server/tests/*production*.test.ts`
- `server/publicLandingHtml.ts` only for server-rendered public HTML smoke expectations.
- `package.json` only for smoke script aliases.

Banned files:

- Direct Connect behavior implementation.
- Auth/onboarding route logic.
- Database schema and migrations.
- Product copy rewrites outside smoke-required server HTML.

Hard rules:

- Do not ban "Direct Connect".
- Ban internal architecture framing only.
- GET-only production smoke unless explicitly assigned otherwise.
- No auth mutation, DB mutation, payment calls, or request creation in public-entry smoke.

Validation expectations:

- `npm run test:run -- server/tests/tradescout-production-public-entry-smoke.contract.test.ts`
- Relevant smoke contract tests.
- `npm run check`

### Lane F: Operating Docs / Repo Process

Branch:

```text
codex/parallel-ai-execution-docs
```

Goal:

Maintain repo-level operating documentation for safe parallel AI execution.

Allowed files:

- `docs/AI_PARALLEL_EXECUTION.md`
- `docs/REPO_LANES.md`
- Narrow repo onboarding docs only when explicitly assigned.

Banned files:

- Application source.
- Tests that assert product behavior.
- Product copy.
- Runtime scripts.
- Database schema and migrations.

Validation expectations:

- `npm run check`

## Unsafe Lane Pairings

Do not run these in parallel:

| Pairing | Risk |
| --- | --- |
| Two public landing/page-copy tasks | Copy conflicts and doctrine drift |
| Two Direct Connect behavioral tasks | Request/contact law conflicts |
| Direct Connect behavior + onboarding route changes | Auth and post-login route conflicts |
| SEO route changes + route refactors | Broken public paths |
| Database schema + backend behavior | Migration and rollback risk |
| Shared navigation + public CTA copy | High merge conflict and product hierarchy risk |
| Production smoke + public HTML copy rewrite | Ambiguous smoke failure source |
| Business claim/profile + onboarding funnel route changes | Claims-first signup and verification drift |

## Lane Return Format

Every Codex lane must return:

- Repo
- Lane chosen
- Branch
- Baseline SHA
- Files inspected
- Files changed
- Tests run
- Test results
- Commit SHA if committed
- PR link if opened
- Final git status
- Risks / follow-up needed

## Merge Order

Gawain controls merge order. Default order:

1. Docs-only and tests-only PRs.
2. Low-risk server smoke/contracts.
3. Public copy/contracts.
4. Direct Connect behavior.
5. Shared route/navigation/onboarding changes.
6. Database schema and migrations when dependent behavior is ready.

Gemini review can change this order when it finds hidden dependencies or conflict risk.
