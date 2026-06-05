# TradeScoutPro Cleanup Map

Source of truth: `TradeScoutPro_HANDOFF_SPINE.md`.

This map sequences cleanup lanes around the existing product. It does not authorize feature work, behavior changes, route changes, role changes, trust changes, payment changes, or new product surfaces.

## Current Cleanup State

- Handoff spine: complete in `TradeScoutPro_HANDOFF_SPINE.md`.
- Handoff contract: complete in `scripts/tradescoutpro-handoff-spine.contract.test.mjs`.
- Repo-wide verify: expected cleanup gate is `npm run verify`.
- Product polish: not started; must begin as an audit before any UI edits.
- Known working tree drift to keep out of cleanup commits: `client/public/sitemap.xml`, `client/public/sitemap-index.xml`.

## Allowed Cleanup Lanes

### 1. Docs Cleanup Lane

Allowed:

- Create or refine docs that point to `TradeScoutPro_HANDOFF_SPINE.md`.
- Clarify where existing docs live and when to use them.
- Add contract tests that prove docs exist and contain required safety boundaries.

Blocked:

- Product copy rewrites on active surfaces.
- Route, role, event, or behavior changes.
- Generated sample content or fake operational proof.

### 2. Validation Cleanup Lane

Allowed:

- Document validation lanes and when to run them.
- Add narrow contract tests for docs or cleanup rules.
- Clarify deterministic vs DB-backed release gates.

Blocked:

- Weakening gates, skipping critical tests, suppressing safety failures, or reclassifying failures without evidence.
- Changing business logic to make unrelated validation pass.

### 3. Route Ownership Cleanup Lane

Allowed:

- Map existing client pages and server route groups to owners/domains.
- Document large files and route registrars such as `client/src/AppRoutes.tsx`, `server/index.ts`, `server/routes.ts`, and `server/routes/direct-connect.ts`.

Blocked:

- Renaming routes, splitting route files, changing route order, changing permissions, or moving API behavior.

### 4. Admin Surface Mapping Lane

Allowed:

- Inventory existing admin/operator pages, API groups, and expected role boundaries.
- Document confusion risks and ownership questions.

Blocked:

- Changing admin permissions, hiding actions, adding controls, adding publish/delete/archive behavior, or changing impersonation/user-control logic.

### 5. Upload / Storage Audit Lane

Allowed:

- Document current storage paths, object key flows, R2/local fallback behavior, generated artifact locations, and retention questions.
- Add read-only inventory tooling only after a separate explicit task.

Blocked:

- Moving files, deleting files, archiving to Drive, enabling live Drive execution, changing upload ACLs, or changing attachment access behavior.

### 6. Migration / Deploy Checklist Lane

Allowed:

- Document migration order, Render pre-deploy behavior, runtime migration assumptions, and test DB bootstrap impact.

Blocked:

- Adding migrations, changing schema, changing `RUNTIME_MIGRATIONS_MODE`, or changing deploy commands without an explicit migration task.

### 7. Product Polish Audit Lane

Allowed:

- Create a read-only audit of existing active surfaces, labels, layout risks, trust/safety risks, and top polish issues.

Blocked:

- UI edits before the audit.
- New product surfaces, new actions, new workflow states, or visual redesigns.

## Blocked Areas During Cleanup

Do not touch during cleanup unless explicitly requested and separately validated:

- Contact gating: Intent -> Decision Card -> Contact.
- Direct Connect safety, dispatch ledger, request lifecycle, attachment access, provider visibility, and contact release.
- Trust/CVS, verification flags, address/identity/business verification, claims-first signup, and exposure logic.
- Auth, roles, admin permissions, impersonation, protected admin users, and privileged audit logging.
- Pricing, payments, payouts, affiliate payout behavior, wallet mutation behavior, checkout behavior, and financial records.
- Runtime migrations, production deploy commands, database schema, and migration journal.
- External connector execution, crawler behavior, AI auto-fix/write behavior, and live import execution.
- Product route names, role names, event names, user-facing product concepts, and public SEO route names.
- Generated sitemap drift unless the task is explicitly sitemap-related.

## Recommended Cleanup Sequence

1. Finish cleanup orientation docs and contracts.
2. Build a docs index linked to `TradeScoutPro_HANDOFF_SPINE.md`.
3. Normalize validation lane docs into one canonical table.
4. Map route/API ownership without moving code.
5. Map admin/operator surfaces without changing permissions.
6. Document upload/storage retention and archive candidates without moving files.
7. Document migration/deploy checklist for future schema work.
8. Start product polish as `PRODUCT_POLISH_AUDIT.md` only, with no UI edits until the audit is accepted.

## Completion Rule

A cleanup lane is complete only when its contract passes, `npm run check` passes, `npm run verify` passes, a scoped commit exists, and sitemap drift remains unstaged unless sitemap cleanup was the approved task.
