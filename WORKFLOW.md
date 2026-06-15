# TradeScoutPro Workflow

Source of truth: start with `TradeScoutPro_HANDOFF_SPINE.md` before using this workflow.

## Repo Mode

TradeScoutPro is in production cleanup / handoff mode.

The goal is developer clarity, operational stability, and safe handoff. Cleanup work should make the existing repo easier to understand and validate without changing product behavior.

## Standard Codex Prompt Rule

Use this rule at the start of production cleanup tasks:

> You are working in a production repo. Do not add features. Do not change business logic unless explicitly requested. Do not refactor unrelated code. Do not rename routes, roles, events, files, or user-facing product concepts unless explicitly requested. Do not create synthetic operational records, fabricated provider evidence, fabricated metrics, or placeholder production records.

Every cleanup prompt should also name the exact allowed lane and the exact files or doc family expected when possible.

For campaigns, public pages, pricing models, offers, brand initiatives, or strategic user-facing surfaces, a prompt is not valid until it includes an owner-approved Truth Lock. In manual owner-directed workflows, Thomas/operator signs off the Truth Lock; Lancelot/Percival approval is required only when Albion / AI Council / High Court governance mode is explicitly invoked. Gawain is the technical execution and review side for repo safety, Codex handoffs, validation gates, merge discipline, risk classification, and truth-alignment checks, not a replacement for owner approval or a standing 3/3 vote requirement. The Truth Lock must state the one-sentence purpose, confirmed facts, explicit negatives, banned assumptions, approved CTAs, forbidden claims/language, data/state boundary, and owner sign-off. Codex, Gemini when used, visual review, contract planning, and merge approval must stop if the lane relies on an unverified premise. If the owner identifies a premise mismatch, the lane fails closed immediately and truth correction takes priority over feature continuation.

## Safe Edit Rules

- Prefer docs, contracts, and focused tests before code.
- Preserve current behavior, route names, role names, event names, permissions, pricing, payouts, verification, trust flags, contact gates, and deployment order.
- Do not add product surfaces, APIs, data models, seed data, external connector execution, or runtime automation during cleanup.
- Do not rewrite architecture or broad-format files just to improve style.
- Do not touch generated sitemap drift unless the task is explicitly sitemap cleanup.
- Keep commits scoped to the requested lane.

## Zachary QA + DRY/SRP Release Gate Lane

Canonical guide: `docs/ZACHARY_QA_DRY_RELEASE_GATE.md`.

This lane makes front-end QA evidence mandatory before more user-facing work and makes DRY/SRP cleanup a planned follow-up after UX QA and critical/high fixes. It is an operating-policy lane first.

Allowed:

- Docs, templates, release evidence rules, bug reporting rules, DRY/SRP intake rules, and docs contract tests.

Forbidden:

- Runtime refactor, feature work, UI changes, fetch cleanup, try/catch cleanup, oversized file decomposition, schema/storage edits, route changes, role changes, event changes, permission changes, auth changes, Direct Connect changes, trust/CVS changes, claims changes, pricing changes, payout changes, deployment changes, production config changes, or generated sitemap edits.

Required operating order:

1. QA the current user experience.
2. Fix what is broken or confusing.
3. Clean up duplicated/oversized code safely.
4. Re-QA after cleanup.
5. Only then introduce new features.

Release rules:

- No user-facing merge without QA evidence.
- No pure refactor merge without behavior-parity evidence and re-QA.

## Before Editing

1. Inspect `TradeScoutPro_HANDOFF_SPINE.md`.
2. Inspect the relevant existing files for the requested lane.
3. List the exact files intended for changes.
4. Explain the smallest safe change.
5. Stop before editing if production safety appears broken, if a migration is required without deploy order, or if the task would change business logic outside the approved lane.

## Validation Order

Use the narrowest relevant gate first, then broader gates:

1. Run the lane-specific contract or focused test.
2. Run any adjacent existing contract for the same area.
3. Run `npm run check`.
4. Run `npm run verify`.
5. Run DB-backed lanes only when the task touches DB/integration behavior or shipping confidence requires them: `npm run test:run:no-skips`, `npm run verify:db`, or `npm run verify:release`.

For this cleanup-docs lane, the required validation order is:

1. `node scripts/tradescoutpro-cleanup-docs.contract.test.mjs`
2. `node scripts/tradescoutpro-handoff-spine.contract.test.mjs`
3. `npm run check`
4. `npm run verify`

For the Zachary QA + DRY/SRP release gate foundation lane, the required validation order is:

1. `node scripts/zachary-qa-dry-release-gate.contract.test.mjs`
2. `node scripts/tradescoutpro-cleanup-docs.contract.test.mjs`
3. `node scripts/tradescoutpro-handoff-spine.contract.test.mjs`
4. `npm run check`

Do not require full `npm run verify` for that docs-only lane when it is known to enter unrelated DB-backed timeout paths. If skipped, document why.

## Commit Rules

- Commit only after required validation passes.
- Stage only files in the approved lane.
- Do not commit `client/public/sitemap.xml` or `client/public/sitemap-index.xml` unless the task is explicitly sitemap-related.
- Do not commit generated artifact drift from validation unless the task explicitly owns those artifacts.
- Use the requested commit message when provided.

## Sitemap Drift Rule

Known sitemap drift may exist from build or generation workflows:

- `client/public/sitemap.xml`
- `client/public/sitemap-index.xml`

Leave these unstaged unless a task explicitly requests sitemap generation, sitemap integrity repair, or public SEO artifact cleanup.

## When To Stop Before Editing

Stop and report instead of editing when:

- Contact gating, verification, trust/CVS, auth/role permissions, payment, payout, or Direct Connect safety appears broken.
- The smallest fix requires changing business logic beyond the approved lane.
- A schema or migration change is needed but deploy order is not clear.
- The task implies fabricated providers, fabricated metrics, synthetic traction claims, or placeholder production records.
- The task asks for product polish or UI changes before an audit identifies exact existing surfaces and failures.
- The task scopes a campaign, public page, pricing model, offer, brand initiative, or strategic user-facing surface without an owner-approved Truth Lock.

## Return Format After Each Task

Return:

- `DECISION:`
- `FILES INSPECTED:`
- `FILES CHANGED:`
- `SMALLEST SAFE CHANGE:`
- `VALIDATION:`
- `COMMIT:`
- `WORKING TREE:`
- `NOTES:`
- `FOLLOW-UP LANES:`

Do not claim completion if validation fails.
