# AI Parallel Execution

TradeScout work can run in parallel only when every slice has a clear lane, branch, file boundary, validation plan, and review path. Parallel work increases throughput; it does not relax doctrine, testing, or merge discipline.

## Operating Authority

- Gawain defines doctrine, slice scope, and merge order.
- Codex implements one assigned lane per session.
- Gemini reviews and criticizes each PR.
- Gawain reconciles Gemini criticism and issues corrected prompts.
- Gemini criticism is not optional. If Gemini identifies a real doctrine, test, scope, or merge risk, Codex must address it or Gawain must explicitly override it.

## Core Rules

- Run one lane per Codex session.
- Use one branch per lane.
- Do not stack unrelated work in a branch.
- Create and approve a Truth Lock before scoping any campaign, public page, pricing model, product surface, offer, brand initiative, or user-facing strategic page for Codex.
- Inspect first. Read the relevant code, tests, docs, and current git state before editing.
- Make the smallest safe slice that satisfies the assigned lane.
- Add or strengthen contracts/tests before behavior changes when possible.
- Do not touch files outside the lane unless the need is discovered, documented, and reported.
- If required work crosses a lane boundary, stop and report instead of expanding scope.
- Validate before commit with the lane-specific tests and the repo's normal check command.
- Do not commit if required validation was not run or failed unless the failure is documented as the purpose of the slice.
- Require Gemini review before merge.
- Gawain controls merge order.

## Truth Lock Gate

Any lane for a campaign, public page, pricing model, product surface, offer, brand initiative, or user-facing strategic page is structurally invalid until Gawain records an owner-approved Truth Lock. The Truth Lock must exist before Codex implementation prompts, Gemini pre-flight reviews, contract test planning, visual review, or merge approval.

Truth Lock schema:

1. `Page / Surface Purpose`
   - One sentence only.
2. `Confirmed Facts`
   - Facts sourced only from direct user input, existing repo docs, or explicitly cited sources.
3. `Explicit Negatives`
   - Things the page or surface must not imply or claim.
4. `Unknowns / Banned Assumptions`
   - Areas where Gawain, Codex, Gemini, or other agents may not fill gaps.
5. `Approved CTAs`
   - Exact allowed user actions.
6. `Forbidden Claims / Language`
   - Words, claims, mechanics, metrics, or statuses that must not appear.
7. `Data / State Boundary`
   - What data may be shown, what must not be invented, and whether live state exists.
8. `Review Owner Sign-Off`
   - System owner approval before implementation starts.

Truth Lock rules:

- Any Codex prompt based on unverified assumptions fails closed.
- Any Gemini review that validates an unverified premise is invalid.
- Any contract tests enforcing an unverified premise are invalid.
- Contract tests must enforce the Truth Lock; they do not replace it.
- Passing tests/builds do not prove business alignment.
- Visual polish cannot override product truth.
- If a false premise is discovered after merge, emergency truth correction takes priority over feature continuation.
- Governance-impacting workflow changes require 3/3 approval under the active AI Council / Albion / High Court approval process before merge.

Concise example:

- Bad premise: `Campaign-branded items are listed for purchase as a catalog.`
- Correct Truth Lock: `Trade-Up For Trade Schools is a TradeScout-run video/content series starting with one carpenter's pencil and trading up through consecutive swaps toward $250,000 in trade school scholarships.`

## Truthfulness Rules

- No fake status.
- No fake commits.
- No fake PR links.
- No fake test results.
- Report skipped or blocked validation honestly.
- Report dirty git status honestly.
- Do not claim production behavior is proven unless a live smoke actually ran and passed.

## Brand and Doctrine Rules

- No cross-brand imports.
- Do not import MealScout, Trader's Corner, Sway, Albion, AutoBott, or other brand assets, copy, concepts, or doctrine into TradeScout.
- Do not copy doctrine from another brand unless Gawain explicitly approves it as a documented exception.
- Keep TradeScout production-facing copy TradeScout-only.
- Preserve TradeScout law:
  - Visibility does not equal access.
  - Contact is gated: Intent -> Decision Card -> Contact.
  - Claims-first signup; verification is adaptive/contextual.
  - Counties are operational containers.
  - No pay-to-play.
  - No lead selling.
  - Read-only global community view is allowed; global action is not.
  - Trust/CVS governs exposure.
  - Scout bridges discovery to action without becoming a chatbot framing.

## Parallel Safety

Parallel lanes are safe only when they do not touch the same files, doctrine boundary, route authority, data shape, or public copy surface.

Safe parallel work usually has:
- Separate branches.
- Separate file ownership.
- Separate contracts.
- Separate validation commands.
- Clear non-goals.
- Gemini review per PR.
- Gawain-controlled merge order.

Unsafe parallel work includes:
- Two public landing/page-copy tasks at the same time.
- Two Direct Connect behavioral tasks at the same time.
- Direct Connect behavior changes paired with onboarding route changes.
- SEO route changes paired with route refactors.
- Database schema changes paired with backend behavior changes.
- Shared navigation changes paired with public CTA copy changes.

## Standard Codex Lane Flow

1. Confirm repo, branch, baseline SHA, and git status.
2. Confirm whether the lane requires a Truth Lock; stop if it does and one is missing.
3. Confirm the assigned lane and branch name.
4. Create or switch to the assigned branch.
5. Inspect relevant files and tests.
6. Identify the smallest safe slice.
7. Add or update contracts/tests first when possible, and align them to the Truth Lock when one exists.
8. Make only lane-scoped edits.
9. Run lane-specific validation.
10. Run the repo's normal check command.
11. Commit with the assigned message.
12. Push the lane branch if requested.
13. Return the global lane report format.

## Global Return Format

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

## Merge Order Guidance

Gawain should generally merge in this order:

1. Docs-only or tests-only PRs.
2. Low-risk server smoke/contracts.
3. Public copy/contracts.
4. Direct Connect behavior.
5. Shared route/navigation/onboarding changes.
6. Database schema and migrations only when their dependent behavior is ready.

The merge order can change when Gemini finds a dependency, hidden conflict, or doctrine risk.
