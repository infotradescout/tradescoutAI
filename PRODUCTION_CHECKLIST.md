# Production Readiness Checklist - TradeScout AI

This document outlines the final steps and verification required to ensure the application is production-ready.

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

## 2. Security
- [x] **Rate Limiting**: Configured for sensitive endpoints (login, password reset, AI).
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
