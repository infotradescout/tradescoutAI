# TradeScoutPro

Start here: [README_START_HERE.md](README_START_HERE.md) | [PRODUCTION.md](PRODUCTION.md)

## Architecture Overview

Before making changes to platform architecture, routing, onboarding, HomeID, Scout, Direct Connect, Community, Trust/CVS, Finance, or Claims systems, read:

[TRADESCOUT_SYSTEM_MAP.md](TRADESCOUT_SYSTEM_MAP.md)

This document is the canonical platform architecture and doctrine reference.

## Local Development

**Prerequisites:** Node.js + a Postgres database

```powershell
# Install dependencies
npm install

# Create local env
Copy-Item .env.example .env

# Start dev server
npm run dev
```

## Tests

```powershell
npm run check
npm run test:run

# Full end-to-end suite (requires a test DB)
npm run e2e
```

## Production Deployment

For production deployment instructions, see [PRODUCTION.md](PRODUCTION.md).

Database-backed and E2E suites expect a dedicated test database.

- Set `TEST_DATABASE_URL` in CI (and locally in a `.env.test` or shell env) to point at a disposable Postgres database/schema.
- When `TEST_DATABASE_URL` is not set, Playwright webServer and global auth setup are disabled and E2E specs such as
	[tests/direct-connect.e2e.spec.ts](tests/direct-connect.e2e.spec.ts) will be marked as skipped instead of failing.

## Test Prerequisites

Some test suites require a database connection.

Required environment variables:

- TEST_DATABASE_URL

If TEST_DATABASE_URL is not set:
- `npm run check` will still pass
- `npm run verify` will still pass (deterministic lane; DB/integration suites are skipped)
- DB-backed strict lanes will skip/fail (by design)

Strict confidence lanes:
- `npm run test:run:no-skips` (DB-backed; fails on skip increase)
- `npm run verify:db` (runs `verify` with DB enabled)
- `npm run test:release-gates:local` (starts a local test server + runs release gates)
- `npm run verify:release` (DB verify + release gates)
