# Production Readiness Checklist - TradeScout AI

This document outlines the final steps and verification required to ensure the application is production-ready.

For launch-week traffic control, use `docs/runbooks/LAUNCH_WEEK_COMMAND_CENTER.md` as the active operational checklist. The command center does not replace this checklist; it turns the release evidence below into go/no-go decisions for signup, Scout, Direct Connect, support, and rollback ownership.

## 1. Environment Variables
Ensure the following environment variables are set in the production environment:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `SESSION_SECRET` | Yes | Long random string for session encryption |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | No | Default is `5000` |
| `STRIPE_SECRET_KEY` | No | Required for payments |
| `SENDGRID_API_KEY` | No | Required for emails |
| `SENTRY_DSN` | No | Required for error tracking |
| `AWS_ACCESS_KEY_ID` | No | Required for S3 storage |
| `AWS_SECRET_ACCESS_KEY` | No | Required for S3 storage |
| `AWS_REGION` | No | Required for S3 storage |
| `AWS_S3_BUCKET` | No | Required for S3 storage |
| `GOOGLE_CLIENT_ID` | No | Required for Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | Required for Google OAuth |
| `FACEBOOK_APP_ID` | No | Required for Facebook OAuth |
| `FACEBOOK_APP_SECRET` | No | Required for Facebook OAuth |
| `ADMIN_SAFETY_KEY` | Recommended | Required for safeguarded admin support edits when configured |
| `OPENAI_API_KEY` | Recommended | Enables Scout's OpenAI Responses provider and claim inference |
| `SCOUT_LLM_PROVIDER_ORDER` | No | Default is `openai,vertex,gemini`; set explicitly to control cost/fallback order |
| `SCOUT_OPENAI_MODEL_FAST` | No | Default `gpt-5.4-nano` for cheap structured inference |
| `SCOUT_OPENAI_MODEL_DEFAULT` | No | Default `gpt-5.4-mini` for normal Scout synthesis |
| `SCOUT_OPENAI_MODEL_STANDARD` | No | Overrides normal Scout synthesis model when set |
| `SCOUT_OPENAI_MODEL_REASONING` | No | Default `gpt-5.5` for code/permit/safety-sensitive Scout synthesis |
| `SCOUT_OPENAI_MAX_OUTPUT_TOKENS` | No | Caps Scout OpenAI output; default `700` for structured synthesis |
| `SCOUT_DEFAULT_ENGINE` | No | Default `classic`; set `v4` only when intentionally testing Enhanced v4 |
| `SCOUT_ENHANCED_ENABLED` | No | Default `false`; set `true` with `SCOUT_DEFAULT_ENGINE=v4` to opt into Enhanced v4 |
| `BING_INDEXNOW_KEY` / `INDEXNOW_KEY` | Recommended | Enables `/indexnow-key.txt` ownership proof for Bing/IndexNow URL submission |
| `GEMINI_API_KEY` | No | Gemini fallback and legacy enhanced Scout routes |
| `GOOGLE_PROJECT_ID` / `GOOGLE_VERTEX_LOCATION` | No | Vertex Gemini fallback provider |
| `DIRECT_CONNECT_CREATE_LIMIT_15M` | No | Per-user/IP Direct Connect request creation cap per 15 minutes; default `12` |
| `DIRECT_CONNECT_WORKFLOW_LIMIT_1M` | No | Per-user/IP Direct Connect route/share/contact-gate action cap per minute; default `90` |
| `DIRECT_CONNECT_PROVIDER_RESPONSE_LIMIT_10M` | No | Per-user/IP provider response/express-interest cap per 10 minutes; default `60` |

## 2. Security
- [x] **Rate Limiting**: Configured for sensitive endpoints (login, password reset, AI) and Direct Connect write paths.
- [x] **Headers**: `helmet` is used for security headers.
- [x] **CORS**: Configured with an allowlist.
- [x] **CSP**: Content Security Policy is enabled and configured through `helmet` directives.
- [x] **Secure Cookies**: `trust proxy` is set to `1` for secure cookies behind proxies.

## 3. Database
- [x] **Migrations**: Use `npm run db:migrate` to apply migrations safely.
- [x] **Scale Readiness**: Run `npm run check:scale-readiness` to verify DB health and data integrity.
- [x] **Connection Pooling**: `pg` pool is used and properly closed on shutdown.

## 4. Build & Deployment
- [x] **Bundling**: Server is bundled using `esbuild` into `dist/index.js`.
- [x] **Static Files**: Vite builds the client into `dist/public`.
- [x] **Dockerfile**: Multi-stage build is ready.
- [ ] **Health Check**: Verify `/api/health` returns `200 OK` with `status: "healthy"`.

## 5. Observability
- [x] **Error Tracking**: Sentry is integrated.
- [x] **Metrics**: Basic health metrics are available via `/api/health`.
- [x] **Logging**: Graceful shutdown and startup logging are implemented.

## 6. Cleanup
- [x] **Production Debt**: Run `npm run audit:production-debt` to check for in-memory markers.
- [x] **Secrets History**: Run `npm run audit:secrets-history` to check for leaked secrets.

## Final Verification Command
```bash
npm run verify
```
This command runs a comprehensive suite of checks including type checking, tests, and all audit scripts.

## 7. Release Evidence (Required)
- [x] `npm run verify` passes with exit code `0`.
- [x] `npm run build` passes with exit code `0`.
- [ ] `npm run test:release-gates` executed against a running app instance.
- [ ] `npm run report:release-gates` archived to deployment evidence.

### Evidence Commands
```bash
npm run verify
npm run build
npm run dev
npm run test:release-gates
npm run report:release-gates
```

### Evidence Artifacts
- `.playwright/test-results/results.json`
- `artifacts/release-gate-metrics.json`

## 8. HOA Module Production Delta (Non-duplicate extension)

This section extends the core checklist above for the HOA capability pack only.

### Completed in current tranche
- [x] HOA pages compile cleanly (`npm run check`).
- [x] Full platform verification passes (`npm run verify`).
- [x] Production build passes (`npm run build`).
- [x] Added guided "What to do next" support blocks on:
	- `client/src/pages/hoa-dashboard.tsx`
	- `client/src/pages/hoa-management.tsx`
	- `client/src/pages/hoa-maintenance.tsx`
- [x] Added shared HOA guidance component to avoid duplicate implementations:
	- `client/src/components/hoa/HOANextStepsCard.tsx`
- [x] Replaced prompt-based HOA management actions with explicit form flows in `hoa-management`.
- [x] Added persistent HOA Simple View toggle for lower-tech users across HOA surfaces.

### Remaining for release sign-off
- [ ] Run DB-backed strict no-skip lane and archive artifacts:
	- `npm run test:run:no-skips`
	- `npm run verify:db`
- [ ] Execute HOA-specific end-to-end smoke run against running app:
	- `npx playwright test tests/hoa.e2e.spec.ts`
- [ ] Validate mobile accessibility pass (keyboard + screen reader labels) on HOA pages.
- [ ] Confirm production observability dashboards include HOA action funnel metrics.

### HOA release evidence
- [ ] Archive strict skip report: `artifacts/test-skip-delta.no-skips.json`
- [ ] Archive HOA UX acceptance screenshots (simple view and full view)
- [ ] Archive HOA e2e run results for release packet

## 9. Admin Account Compromise Safeguards

### Safeguarded edit flow
- [x] Added explicit safeguarded admin support edit API: `POST /api/admin/users/support-edit`.
- [x] Requires audit reason (minimum length) and fixed confirm phrase.
- [x] Supports optional `ADMIN_SAFETY_KEY` validation for step-up control.
- [x] Blocks protected admin-target edits unless actor is head/super and explicit override is set.
- [x] Restricts updates to whitelisted profile-safe fields and logs admin action.

### Operational policy
- [ ] Set `ADMIN_SAFETY_KEY` in production secrets.
- [ ] Rotate `ADMIN_SAFETY_KEY` on regular schedule and incident response.
- [ ] Require support ticket/reference in `adminSafety.reason` policy.

## Direct Connect Notifications Release Ledger

### Current release state

| Layer | Commit | Status |
|---|---:|---|
| Backend durability | `a6e02500` | ✅ Live |
| Notification Center UI | `db3fd8ce` | ✅ Pushed |
| Production confirmation | `db3fd8ce` | ⏳ Pending `x-tradescout-build` header flip |

### Completion condition

The Notification Center UI is not considered live until production returns:

```txt
x-tradescout-build: db3fd8ce...
```

Once confirmed, mark:

`Notification UI live: ✅ db3fd8ce`

### Required production confirmation matrix

```bash
curl -I "https://www.thetradescout.com/scout?unlock=exchange"
curl -I "https://www.thetradescout.com/direct-connect"
curl -I "https://www.thetradescout.com/api/dashboard"
curl -i "https://www.thetradescout.com/api/direct-connect/notifications"
```

Expected:

- `/scout?unlock=exchange` → `200`
- `/direct-connect` → `200`
- `/api/dashboard` unauth → `403`
- `/api/direct-connect/notifications` unauth → `403`, not `500`
- `x-tradescout-build` → `db3fd8ce...`

### Post-confirmation authenticated lifecycle QA

- Create or locate a requester account.
- Create or locate a business account.
- Trigger a Direct Connect lifecycle event.
- Confirm requester/business notification generation.
- Confirm unread badge appears.
- Open notification center.
- Mark one notification read.
- Mark all notifications read.
- Archive one notification.
- Refresh page and confirm read/archive state persists.

KPI:

`Notification action completion with persisted state`

### Contractor request list blocker closeout (resolved)

- Resolved production build: `6849e73d4e7c8ac45232e9a340d7ce891705d081`
- Endpoint: `GET /api/direct-connect/contractor/requests`
- Auth mode: provider session cookie
- Result: `200 OK`
- Accepted response shape: valid JSON array (`[]` allowed)

### Ongoing lightweight regression smoke (required each deploy)

```bash
curl -I "https://www.thetradescout.com/direct-connect"
curl -i "https://www.thetradescout.com/api/direct-connect/contractor/requests" \
  -H "Cookie: <provider_cookie>"
```

Expected:

- `x-tradescout-build` matches latest deployed commit
- provider-auth `GET /api/direct-connect/contractor/requests` returns `200`, not `500`
- response remains a JSON array shape

## Direct Connect Launch Traffic Smoke

Use this only with approved production smoke accounts. Do not run it with real requester/provider accounts.

This is a hard launch-week gate for hundreds-of-users traffic. The app may have route/build/session evidence and still remain launch-blocked until the authenticated requester/provider smoke, rate-limit bucket evidence, and isolated 429 proof are archived.

Required local-only env:

```bash
RUN_DIRECT_CONNECT_PRODUCTION_SMOKE=1
TRADESCOUT_REQUESTER_COOKIE="<full requester Cookie header>"
TRADESCOUT_PROVIDER_COOKIE="<full provider Cookie header>"
```

Optional env:

```bash
TRADESCOUT_PRODUCTION_ORIGIN="https://www.thetradescout.com"
TRADESCOUT_SMOKE_COUNTY_FIPS="12033"
TRADESCOUT_SMOKE_STATE_CODE="FL"
```

Required for `LAUNCH_READY` evidence:

```bash
TRADESCOUT_PRODUCTION_DATABASE_URL="<production database url for rate_limit_buckets evidence>"
RUN_DIRECT_CONNECT_RATE_LIMIT_429=1
DIRECT_CONNECT_SMOKE_429_MAX_ATTEMPTS=100
```

Run:

```bash
npm run smoke:direct-connect-production
```

Expected artifact:

```txt
artifacts/direct-connect-production-smoke-latest.json
```

Launch gate:

- `LAUNCH_READY` only when authenticated requester/provider smoke, rate-limit bucket evidence, and isolated 429 proof pass.
- `BLOCKED` when requester/provider cookies, approved production database evidence, or isolated 429 proof are unavailable.
- `FAIL` when an authenticated workflow or limiter behavior regresses.
