# Action-first recommendations

Selecting Recommend opens the experience form before sign-up. A guest can write
and save a draft on the current device, then create an account using name, email,
password, and terms acceptance. The account returns to the same recommendation
without completing outcome onboarding or address/professional verification.

After authentication the server saves the recommendation privately. Confirming
email makes it eligible for moderation. Only approved recommendations with
current, matching email confirmation are public or counted. Email confirmation
does not approve a recommendation or establish professional/business credentials.

## Scope and invariants

| Contract | Classification | Implementation |
| --- | --- | --- |
| Capture an experience before full onboarding | enforced | Existing RecommendationForm, device draft, scoped auth continuation |
| Publication requires current email confirmation and moderation | enforced | Canonical repository predicates, moderation transaction, public DTO |
| Public recommendation counts are precomputed | enforced | Migration 0136 projection functions and triggers; no read-time count exception |
| Visibility never grants contact | enforced | No contact permissions granted; existing Direct Connect decision gates retained |
| Incomplete accounts cannot use a recommendation URL to bypass unrelated onboarding | enforced | Strict same-origin recommendation/verification path allowlist |
| Extend capture-and-hold to other actions and modernize address/professional verification | policy_target | Separate remaining product work; no new provider or generalized exemption introduced |

The guest draft expires after seven days. A tab-scoped sign-in handoff expires
after thirty minutes and is consumed when its first authenticated account is
observed, including storage failures or conflicting drafts. Other accounts must
explicitly restore a device draft. Drafts are scoped by business and account;
request responses cannot overwrite another account's editor or newer saved text.
Server-generated authority controls identity, confirmation and moderation. Stable
submission IDs make retries idempotent; transaction locks enforce duplicate and
IP limits under simultaneous requests.

## Migration

Run the normal `npm run db:migrate` before the updated application. Migration
`0136_recommendation_publication_projection.sql` restores recommendation and
leaderboard columns already expected by the runtime but absent from a journal-only
installation. It preserves legacy star records without inventing a positive or
negative recommendation or moderation decision.

The migration rebuilds derived contractor/leaderboard counts from current public
eligibility, repairs duplicate leaderboard periods, and installs triggers for
recommendation and author confirmation/email changes. Scores use unbounded
numeric columns. Its backfill locks each contractor while replacing that
contractor's derived counts; production execution time has not been measured.

Required-schema readiness checks the added fields, unique period index, all three
function bodies, both enabled triggers and the canonical migration ledger hash.
It fails closed if this publication protection is absent or replaced.

## Local evidence

- `npm run check` passed. The full production build passed before final gate execution.
- Focused auth, continuation, composer, verification, public DTO and profile tests:
  119 passed in the final focused run, including app-shell/navigation contracts.
  The final composer/storage/signup subset passes 42 tests.
- Native PostgreSQL repository/HTTP/projection/schema tests: 62 passed. The
  standalone PGlite backend lane: 35 passed. Bootstrap/schema-preservation checks:
  22 passed. These validate real writes, duplicate races, moderation, private
  identity redaction, current-author eligibility, backfill and invalidation.
- Real Chromium desktop 1440x1000 and mobile 390x844 checks used a dedicated
  loopback PostgreSQL database and synthetic accounts. Each wrote text before
  signup, restored on reload, used an optional selector, created a minimal
  account, returned to a private saved recommendation, rejected premature admin
  approval, confirmed email through the actual token endpoint, then published
  through the moderation API. Revoking confirmation removed public results and
  returned counts to zero. No external email provider was configured.
- Browser evidence and screenshots are under local `artifacts/action-first-*`
  and `artifacts/recommendation-*`. The initial Vite preview produced development
  WebSocket warnings. Screenshot review also found the Start Guide obscuring
  email confirmation; contextual recommendation paths now defer that guide without
  marking it seen. Production-built asset checks exercise the confirmation and
  return controls with fresh local storage at the final checkpoint.
- Broad Vitest snapshot: 6,022 passed, 14 failed, 160 skipped. Eleven JW Stone
  failures reproduced unchanged at base `87d87de4` in a separate worktree
  (57 passed, 11 failed). Two load-sensitive failures passed isolated reruns.
  The remaining old source-string assertion was updated to require confirmation
  as well as approval and passed; the three affected suites passed 21 tests.
  This is not an all-green broad-suite claim. Database-dependent skipped cases
  are not replaced by the bounded recommendation database proof.

The exact-commit minimum-release result is generated after committing this
checkpoint at `artifacts/release-contract/<commit>/evidence.json`. The PR records
that result, clean-tree bloat evidence, all remaining baseline failures, and any
unexecuted proof. No GitHub Actions workflow or mandatory external check is added.

## Remaining proof and release boundary

This change has local implementation and synthetic browser/database evidence.
Production email delivery, Google/Facebook provider callbacks, Docker execution,
production migration duration and a deployed customer journey are not established
by these checks. Main merge/deployment remains a separate release action.
General address and professional verification modernization remains open.
