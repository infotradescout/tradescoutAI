# AGENTS.md — TradeScout (Repo-Specific)

This repo is TradeScout only. Never import MealScout/Trader’s Corner assets, copy, or concepts.

## 0) Release control (read before merging to main)

- Merge/push to `main` **is** the production release path. See `RELEASE_CONTROL.md`.
- Render Auto-Deploy for production must stay **On** (On Commit).
- GitHub Actions is not used. Local verification against the exact commit is the release evidence.
- Minimum executable gate: `npm run gate:minimum-release` (see `docs/release/MINIMUM_RELEASE_CONTRACT.md`). Its GitHub commit status is optional evidence and must never be configured as a required check while there is no always-on status provider.
- This is a one-person development team: `main` requires a pull request, zero approving reviews, and resolution of review conversations. Do not add approval, status-check, deployment, merge-queue, or last-pusher gates that require a second actor or external runner.
- Every pull request must record the commands run, results, known baseline failures, and any unexecuted DB/browser/production proof.
- Do not reintroduce `.github/workflows/` without explicit owner approval.

## 1) Platform law (must be preserved)
- Visibility does not equal access: being seen never grants contact or power.
- All contact is gated: Intent → Decision Card → Contact.
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

## 2) Implementation constraints
- Any change affecting contact flows MUST preserve gating invariants.
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
