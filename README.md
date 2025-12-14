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
```

Database-backed suites require `TEST_DATABASE_URL` and will be skipped otherwise (see [DEV_QUICK_REFERENCE.md](DEV_QUICK_REFERENCE.md)).
