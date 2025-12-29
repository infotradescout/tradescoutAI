# TradeScoutPro

Start here: [README_START_HERE.md](README_START_HERE.md)

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

Database-backed and E2E suites expect a dedicated test database.

- Set `TEST_DATABASE_URL` in CI (and locally in a `.env.test` or shell env) to point at a disposable Postgres database/schema.
- When `TEST_DATABASE_URL` is not set, Playwright webServer and global auth setup are disabled and E2E specs such as
	[tests/direct-connect.e2e.spec.ts](tests/direct-connect.e2e.spec.ts) will be marked as skipped instead of failing.
