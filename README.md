# TradeScoutPro

Start here: [README_START_HERE.md](README_START_HERE.md) | [PRODUCTION.md](PRODUCTION.md)

## Architecture Overview

Before making changes to platform architecture, routing, onboarding, HomeID, Scout, Direct Connect, Community, Trust/CVS, Finance, or Claims systems, read:

[TRADESCOUT_SYSTEM_MAP.md](TRADESCOUT_SYSTEM_MAP.md)

This document is the canonical platform architecture and doctrine reference.

## Codex Contributions

OpenAI Codex is an active engineering collaborator on TradeScout. Codex-assisted work in this
repository includes production implementation, debugging, tests, release verification, and UX
polish across several core surfaces:

- Public-profile architecture and branded operating profiles for JW Stone, ISSA Build,
  LA Plumbing, JR's Auto Glass, and ProFab Specialty Services.
- TradeScout-native Like, Recommend, Favorite, and Share actions that preserve recommendation
  moderation, contact privacy, and the separation between community engagement and verification.
- Clear public verification context, including available score history, 30-day movement, active
  policy boosts, visible profile badges, and honest incomplete-history states.
- Direct Connect request clarity, profile-to-request context preservation, and privacy-gated
  contact paths.
- The public landing/About explainer, responsive mobile behavior, dropdown affordances, and
  the Connection Without Compromise social-share presentation.
- Mobile profile and image QA, custom-domain cache hardening, regression contracts, deployment
  checks, crawler/SEO verification, and production hardening.

Product doctrine, business rules, and final acceptance remain owned by the TradeScout team. Codex
contributions are kept reviewable through the same source-control and pull-request process as all
other production changes.

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

- Set `TEST_DATABASE_URL` locally in a `.env.test` or shell environment to point at a disposable Postgres database/schema.
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
- `npm run verify:local` (local PR guards, Direct Connect gates, production build, sitemap integrity, and the source/contract test suite)
- `npm run test:run:no-skips` (DB-backed; fails on skip increase)
- `npm run verify:db` (runs `verify` with DB enabled)
- `npm run test:release-gates:local` (starts a local test server + runs release gates)
- `npm run verify:release` (DB verify + release gates)
