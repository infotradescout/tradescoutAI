# AGENTS.md — TradeScout (Repo-Specific)

This repo is TradeScout only. Never import MealScout/Trader’s Corner assets, copy, or concepts.

## SI execution law (mandatory)

Optimize for verified forward progress per unit of context, reasoning, tool use, and validation cost.

Before broad inspection, planning from scratch, or repository-wide validation, first locate the latest authoritative checkpoint/handoff, current branch/commit, and the minimum evidence needed for the assigned slice. Interrupted work resumes from the first unproven state transition; it does not restart the audit, roadmap, repository map, or already-proven work.

- Resume before rediscovering. Reuse authoritative project state instead of reconstructing it from scratch.
- Inspect the smallest relevant surface first; expand only when dependencies, ambiguity, or shared-owner impact require it.
- Do not repeat a deep dive because a new chat, Work task, model, or agent started.
- Prefer searches, diffs, exact ranges, and prior evidence over rereading large files.
- During implementation, use targeted validation for the changed behavior. Full release gates belong at integration/release boundaries or after shared-contract changes invalidate broader evidence.
- Independent lanes may move in parallel only with explicit ownership/integration boundaries; they must share authoritative state rather than independently rediscover it.
- If capacity is constrained, preserve active implementation lanes and defer duplicate audits, non-blocking prose, repeated broad reviews, and speculative exploration.
- Before an interrupted run yields, persist a resumable checkpoint whenever write access remains available.

Every checkpoint/handoff must include:

```text
Objective:
Base branch/commit:
Current branch/commit:
Verified completed work:
Changed but unverified work:
Files changed:
Tests/evidence already run:
Tests/evidence invalidated by later changes:
Known blockers/risks:
External side effects and retry safety:
Next exact action:
Actions that must NOT be repeated:
```

The next agent uses the checkpoint as the evidence index and verifies only the minimum state needed to continue safely.

## 0) Release control (read before merging to main)

- Merge/push to `main` **is** the production release path. See `RELEASE_CONTROL.md`.
- Render Auto-Deploy for production must stay **On** (On Commit).
- GitHub Actions is not used. Local verification against the exact commit is the release evidence.
- Minimum executable gate: `npm run gate:minimum-release` (see `docs/release/MINIMUM_RELEASE_CONTRACT.md`). Its GitHub commit status is optional evidence and must never be configured as a required check while there is no always-on status provider.
- This is a one-person development team: `main` requires a pull request, zero approving reviews, and resolution of review conversations. Do not add approval, status-check, deployment, merge-queue, or last-pusher gates that require a second actor or external runner.
- Every pull request must record the commands run, results, known baseline failures, and any unexecuted DB/browser/production proof.
- Do not reintroduce `.github/workflows/` without explicit owner approval.
- Do not rerun `gate:minimum-release` after every bounded implementation edit when its evidence has not been invalidated. Run targeted checks during the slice, then run the minimum release gate against the integration/release candidate commit.

## 1) Platform law (must be preserved)
- Visibility does not equal access: being seen never grants contact or power.
- All contact is gated: Intent → Decision Card → Contact. For requester-submitted Direct Connect requests, submission is the request-scoped contact decision for the receiving providers; it must not be followed by a second requester approval. See section 1b.
- Claims-first signup; verification is adaptive/contextual.
- Counties are operational containers; intelligence precomputes into:
  - county_metrics (facts)
  - county_entities (assignments)
  - county_notes (human context)
- No pay-to-play; no lead selling.
- Read-only global community view allowed; global action is not.
- Scout is the primary guided bridge from discovery to action. Any non-Scout action path must still preserve contact, trust, and county invariants.
- Target contract: Admin/UI reads precomputed intelligence; temporary read-time derived intelligence is allowed only as a documented exception with an owner and removal date.
- Trust/CVS governs exposure.
- AI + SEO ingestion precedes feature expansion.
- Never remove features; fix and harden.

## 1a) Law integrity classification (required)
- Every law statement must be tagged in audit docs as one of:
  - enforced
  - policy_target
  - temporary_exception
- Temporary exceptions must include owner, rationale, and removal date.
- Canonical audit artifacts:
  - `docs/audits/LAW_REALITY_MATRIX.md`
  - `docs/audits/LAW_REWRITE_PROPOSAL.md`
  - `docs/audits/DRIFT_GUARDS.md`

## 1b) Direct Connect submission and contact (owner rule, #665)

Submitting a Direct Connect request gives its legitimate matched/assigned providers permission to contact the requester about that request. Do not restore a second requester-side Approve contact / Release contact step or replace useful authorized request emails with a generic inbox pointer.

- Request-related contact and accepting the job/opening its Messages conversation are distinct actions. Job acceptance is not a second requester contact decision.
- Keep request contact scoped to the request and its actual receiving providers. Public discovery/share pages, unrelated providers, unrelated conversations and general account contact permissions are separate surfaces.
- Preserve current recipient identity, assignment validity, eligibility, cancellation/revocation and delivery-preference checks. A requester-card presentation state is neither a provider permission grant nor evidence that an email was delivered.
- Use the contact captured for the request where available. An Express email match must never expose another account's saved contact; invalid request snapshots must not silently fall back to that account.
- Drafts must not appear sent. Historical denial/closure must not be erased by a display change. Previously submitted email cannot be recalled by changing a card label.
- Track remaining legacy intake/contact paths and production acceptance explicitly. Do not infer whole-product completion from a formatter or component test pass.

## 2) Implementation constraints
- Any change affecting contact flows MUST preserve gating invariants, including the Direct Connect submission rule in section 1b.
- Any change affecting county routing MUST write to the correct containers (no ad-hoc fields).
- Any change affecting trust/exposure MUST route through Trust/CVS logic (no bypass).
- Any production user-facing copy MUST remain TradeScout-only (no cross-product brand mentions) unless explicitly approved and documented as an exception.

## 2a) JW Stone lane isolation (required)
- New JW Stone work MUST use branches named `jw-stone/<topic>` created from `origin/main`.
- Do not put JW marketplace, profile, inventory, passport, demand-brief, or JW strategy work on Dean recovery, non-JW remediation, or unrelated TradeScout platform branches.
- Canonical lane rules and strategy: `docs/jw-stone/`.
- Platform-law fixes that only incidentally help JW stay on TradeScout platform branches, not `jw-stone/*`.

## 3) Definition of done (TradeScout)
- Feature works end-to-end for at least one county path.
- No regressions in gating.
- Tests/build succeed (or document why not and provide the fix path). Critical law-contract suites may not be silently skipped in local release verification.
- Clear migration notes if data shape changes.
