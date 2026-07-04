# TradeScout CI Baseline Timeout Classification

Date: 2026-06-17

Repo: `infotradescout/tradescoutAI`

Baseline branch: `main`

Baseline SHA: `73994a856293d2d84996897a84c8c19c2d47a0bb`

Parked PR: `#37`

Parked PR head: `13275e675908d24b14a077cacbd691e6e3679138`

## Scope

This note classifies the current non-theme CI failures separately from PR #37's passive friction work.

Theme audit is deterministic and repaired in this lane.

Timeout-heavy failures were inspected on both `main` and PR #37's merge-ref runs to determine whether they are baseline debt or PR-specific.

## Comparison Summary

| Workflow / job | Main | PR #37 merge ref | Classification |
| --- | --- | --- | --- |
| `verify` | not run as a standalone main workflow | fails on theme audit | deterministic baseline audit violation |
| `release-gates` | fails | fails | baseline transaction-lifetime / DB bootstrap issue |
| `e2e` | fails before Playwright due DB bootstrap timeout | fails in Playwright global setup login POST timeout | split issue: baseline DB bootstrap plus PR-merge auth setup timeout |
| `build-and-guard` | fails during DB-backed test bootstrap | fails later in Phase 2C integration/router suites | split issue: baseline DB bootstrap plus separate privileged-suite timeout lane |
| `Bot Army Regression Suite (20.x)` | fails | fails | deterministic E2E/app behavior issue, not caused by PR #37 passive friction edits |

## Failure Details

### 1. Theme audit

Workflow / job: `verify`

Ref: PR #37 merge ref only, but the same source exists on `main` and reproduces locally.

Exact excerpts:

```text
Warning: client/src/pages/giveaway-rules.tsx:156
Type: Inline hex color
Code: <main className="min-h-screen bg-[#05070a] text-slate-100">
```

```text
Warning: client/src/pages/TradeScoutLandingPage.css:22
Type: Unauthorized gradient in CSS
Code: background: linear-gradient(180deg, rgba(244, 122, 31, 0.08), transparent 26rem), var(--ts-bg);
```

Local reproduction: yes

Evidence:

```text
npm run audit:theme
```

Likely category: deterministic repository-level audit violation

Recommended next repair lane: this lane only

### 2. Release Gates Postgres timeout

Workflow / job: `release-gates`

Refs: `main` and PR #37 merge ref

Exact excerpt:

```text
[bootstrap-test-db] Waiting for test DB bootstrap lock...
[bootstrap-test-db] Test DB bootstrap lock acquired.
error: terminating connection due to idle-in-transaction timeout
code: '25P03'
```

Local reproduction: not reproduced locally

Reason: local environment did not have the CI-managed test database and concurrent workflow pressure used by the failing runs.

Likely category: transaction lifetime / DB bootstrap lock contention

Recommended next repair lane: focused `bootstrap-test-db` transaction-lifetime investigation

### 3. E2E timeout on PR merge ref

Workflow / job: `e2e`

Ref: PR #37 merge ref

Exact excerpt:

```text
TimeoutError: apiRequestContext.post: Timeout 30000ms exceeded.
-> POST http://localhost:5002/api/auth/login
at tests/global-setup.ts:27
```

Local reproduction: not reproduced locally

Reason: not rerun locally because the failure occurs in CI boot/auth setup and this lane is scoped to diagnosis, not broad E2E rewrites.

Likely category: auth setup timeout / app readiness timeout

Recommended next repair lane: focused Playwright global-setup and server-readiness investigation after baseline theme unblock

### 4. E2E failure on main

Workflow / job: `e2e`

Ref: `main`

Exact excerpt:

```text
[bootstrap-test-db] Waiting for test DB bootstrap lock...
[bootstrap-test-db] Test DB bootstrap lock acquired.
error: terminating connection due to idle-in-transaction timeout
code: '25P03'
```

Local reproduction: not reproduced locally

Likely category: transaction lifetime / shared DB bootstrap issue

Recommended next repair lane: same as Release Gates

### 5. CI build-and-guard failure on main

Workflow / job: `build-and-guard`

Ref: `main`

Exact excerpt:

```text
npm run test:run:db
[bootstrap-test-db] Waiting for test DB bootstrap lock...
[bootstrap-test-db] Test DB bootstrap lock acquired.
error: terminating connection due to idle-in-transaction timeout
code: '25P03'
```

Local reproduction: not reproduced locally

Likely category: transaction lifetime / DB-backed suite bootstrap issue

Recommended next repair lane: same as Release Gates

### 6. CI build-and-guard failure on PR #37 merge ref

Workflow / job: `build-and-guard`

Ref: PR #37 merge ref

Exact excerpt:

```text
FAIL server/tests/phase2c-privileged.integration.test.ts
Error: Test timed out in 90000ms.
```

```text
FAIL server/tests/phase2c-token-impersonation.router.test.ts
Error: Test timed out in 5000ms.
```

Local reproduction: not reproduced locally

Reason: not rerun locally because this lane is limited to diagnosis and deterministic theme repair.

Likely category: deterministic app regression or integration deadlock in the Phase 2C privileged lane

Recommended next repair lane: narrow `phase2c` privileged-suite timeout lane

### 7. Bot Army regression failure on main

Workflow / job: `Bot Army Regression Suite (20.x)`

Ref: `main`

Exact excerpt:

```text
Error: onboarding completion failed: 428
at tests/scout-routing.e2e.spec.ts:26:7
```

Local reproduction: not reproduced locally

Likely category: deterministic E2E app/setup regression or missing onboarding seed/contract alignment

Recommended next repair lane: focused Scout onboarding E2E lane

## Evidence Notes

`tests/global-setup.ts` performs an authenticated POST to `/api/auth/login` before E2E runs, which matches the PR merge-ref login timeout signature.

`scripts/bootstrap-test-db.mjs` holds an advisory lock inside an open transaction while running a very large schema bootstrap path. That implementation shape matches the repeated CI `idle-in-transaction timeout` failures.

## Lane Recommendation

1. Merge this deterministic theme-audit unblock lane first if validation stays green.
2. Re-run CI on updated `main`.
3. Open a dedicated DB bootstrap transaction-lifetime lane for `release-gates`, `main` `e2e`, and `main` `build-and-guard`.
4. After main is stabilized, rebase PR #37 and reassess whether the PR-only login timeout and Phase 2C timeout signatures still reproduce.
