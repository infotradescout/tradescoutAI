# 🔧 Developer Quick Reference - System Prompt Hot Reload

## 📍 Quick Navigation

### Frontend Files
```
client/
├── src/
│   ├── App.tsx                              # Route registered
│   ├── components/
│   │   └── ProtectedRoute.tsx              # Auth guard (NEW)
│   ├── pages/
│   │   └── PromptAdminPage.tsx             # Editor UI (NEW)
│   └── hooks/
│       └── useAuth.ts                       # Role checking (UPDATED)
```

### Backend Files
```
server/
├── services/
│   └── promptService.ts                     # Hot-reload service (NEW)
├── routes/
│   ├── assistant.ts                         # Uses promptService (UPDATED)
│   └── promptAdmin.ts                       # Admin API (NEW)
├── assistantTypes.ts                        # Type defs (NEW)
├── cache/manual/
│   └── system_prompt.md                     # Editable prompt
└── tests/
    ├── knowledgeHierarchy.test.ts           # Unit tests (NEW)
    └── e2e-hot-reload.js                    # E2E tests (NEW)
```

---

## 🚀 Quick Start

### Run Tests
```bash
# Unit tests (knowledge hierarchy)
npm run test:run -- server/tests/knowledgeHierarchy.test.ts

# E2E tests (hot reload workflow)
node server/tests/e2e-hot-reload.js

# Both should show: ✅ ALL PASSING
```

### Edit System Prompt
```
1. Admin logs in with super_admin or head_admin role
2. Navigate to /admin/system-prompt
3. Edit the text in the editor
4. Click "Save Prompt"
5. New conversations immediately use updated rules (no restart!)
```

### Verify Changes
```bash
# Check prompt was saved
cat server/cache/manual/system_prompt.md

# Check API endpoint
curl http://localhost:3000/api/prompt-admin \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📋 API Reference

### GET /api/prompt-admin
**Get current system prompt**

Response:
```json
{
  "content": "# System Prompt\n...",
  "status": {
    "cached": true,
    "lastLoaded": 1701789614000,
    "reloadInterval": 30000,
    "exists": true
  }
}
```

### POST /api/prompt-admin
**Update system prompt**

Request:
```json
{ "content": "# New System Prompt\n..." }
```

Response:
```json
{
  "ok": true,
  "message": "Prompt saved and reloaded",
  "updatedBy": "user@example.com",
  "timestamp": 1701789614000
}
```

---

## 🔐 Role Requirements

**Who can edit system prompt:**
- ✅ `super_admin`
- ✅ `head_admin`

**Who cannot:**
- ❌ All other roles

---

## 🔄 Hot Reload Timeline

```
T=0s:     Admin saves prompt
T=1s:     File written to disk
T=2s:     Cache invalidated
T=5s:     New conversation starts
T=5s:     Fresh prompt loaded
T=5s:     AI uses NEW rules immediately

Result: NO restart required, NO downtime
```

---

## 🧪 Testing Guide

```bash
# Run the full test suite
npm run test:run

# (Optional) Hot reload E2E harness
node server/tests/e2e-hot-reload.js

# Expected result: ALL PASSING ✅
```

### Database-backed tests

Some suites exercise real storage/DB behavior and will be skipped unless `TEST_DATABASE_URL` is set.

- To run DB-backed tests, point `TEST_DATABASE_URL` at a dedicated test database that has the current schema applied.
- Safety: in `NODE_ENV=test`, the app will not fall back to `DATABASE_URL`.

PowerShell example:

```powershell
$env:TEST_DATABASE_URL = "postgresql://USER:PASSWORD@HOST:PORT/DBNAME"

# Apply schema to the test DB (drizzle-kit reads DATABASE_URL)
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:push

# Run tests
npm run test:run
```

Docker Compose shortcut (includes a dedicated `db_test` on `localhost:5433`):

```powershell
docker compose up -d db_test

# Uses TEST_DATABASE_URL to push schema + run DB-backed suites
npm run test:run:db
```

If you see `docker : The term 'docker' is not recognized`, install Docker Desktop for Windows (and ensure the `docker` CLI is on PATH), then reopen your terminal.

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Admin can't access page | Check user role: `super_admin` or `head_admin` |
| Prompt not updating | Restart server and test new conversation |
| Tests failing | Run `npm run test:run` for full output |
| DATABASE_URL error | Set env var: `export DATABASE_URL="..."` |

---

**Status:** ✅ PRODUCTION READY  
**Last Updated:** December 5, 2025
