# Test Skip Breakdown

Generated: 2026-02-25
Historical source run: `npm run verify` (default profile)
Current strict source run: `npm run test:run:no-skips`

## Summary

- Default profile historical skips: **78**
- Current strict profile skips: **0**
- Enforcement status: strict lane fails on any skip increase above zero baseline.

## Current strict state (authoritative)

- Command: `npm run test:run:no-skips`
- Baseline: `.github/test-baselines/nightly-db-skip-baseline.json` (`pendingTests=0`)
- Artifact: `artifacts/test-skip-delta.no-skips.json`
- Result: `pendingTests=0`, `pendingSuites=0`

## Historical skipped suites (default profile)

| File | Skipped tests | Primary gate |
| --- | ---:| --- |
| `server/tests/community-feed-api.test.ts` | 1 | `TEST_DATABASE_URL` |
| `server/tests/hoa-api.test.ts` | 5 | `TEST_DATABASE_URL` |
| `server/tests/e2e-flows.test.ts` | 1 | `TEST_DATABASE_URL` |
| `server/tests/groups-api.test.ts` | 2 | `TEST_DATABASE_URL` |
| `server/tests/marketplace-api.test.ts` | 2 | `TEST_DATABASE_URL` |
| `server/tests/messages-api.test.ts` | 2 | `TEST_DATABASE_URL` |
| `server/tests/notifications-api.test.ts` | 2 | `TEST_DATABASE_URL` |
| `server/tests/objectives.test.ts` | 37 | `TEST_DATABASE_URL` (+ historical phase placeholder skips, now converted to todo) |
| `server/tests/observations.test.ts` | 3 | `TEST_DATABASE_URL` |
| `server/tests/commercial-directory-gating.test.ts` | 1 | `TEST_DATABASE_URL` |
| `server/tests/acceptance-realignment.test.ts` | 1 | `TEST_DATABASE_URL` |
| `server/tests/direct-connect-redaction.test.ts` | 1 | `TEST_DATABASE_URL` **and** `RUN_INTEGRATION_TESTS=true` |
| `server/tests/auth-account-flow.test.ts` | 1 | `TEST_DATABASE_URL` |
| `server/tests/d3-messaging-authority.test.ts` | 18 | `TEST_DATABASE_URL` **and** `RUN_INTEGRATION_TESTS=true` |
| `server/tests/public-proof-metrics.test.ts` | 1 | `TEST_DATABASE_URL` |

## Why this happened in default profile

Default `verify` runs a safe profile that does not assume a provisioned test database or full integration mode. These suites intentionally use patterns like:

- `const hasTestDb = Boolean(process.env.TEST_DATABASE_URL)`
- `const describeDb = hasTestDb ? describe : describe.skip`
- `process.env.RUN_INTEGRATION_TESTS === "true"` (for stricter integration suites)

This prevented false failures in environments without seeded DB/integration setup, but split quality signal between:

1. **Always-on deterministic/unit/contract tests** (currently green), and
2. **DB/integration-gated suites** (currently skipped in this profile).

## How strict lane now avoids skips

Run a DB-enabled profile with these env vars available:

- `TEST_DATABASE_URL=<test-db-connection-string>`
- `RUN_INTEGRATION_TESTS=true` (needed for messaging authority / direct-connect redaction suites)

Then run strict commands:

- `npm run test:run:no-skips`
- `npm run verify:db`

## Decision note

Default-profile skip gating was deliberate safety behavior, but strict enforcement is now in place to prevent regressions. Nightly DB verify tracks skip delta and fails on increase above zero.
