# Community Builder Deployment Guide

Goal: bring Community Builder + County Vault live on Neon + staging/prod in under 30 minutes.

## 0) Prereqs
- Node 18+
- Access to Neon database URL
- Admin + builder test accounts (session cookies)
- Stripe test keys (Connect enabled)
- Optional: SendGrid/Resend for emails

## 1) Environment Variables
Set these for backend (Railway/Render/local):

```
DATABASE_URL=postgres://... (Neon)
SESSION_SECRET=change-me
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...
SENDGRID_API_KEY=...
PORT=5000
NODE_ENV=production
```

Frontend (Vercel/local):
```
VITE_API_URL=https://your-backend.example.com
```

## 2) Apply Schema to Neon

Option A (single-shot SQL)
```
psql "$DATABASE_URL" -f migrations/0001_community_builder.sql
```

Option B (drizzle push)
```
cross-env DATABASE_URL=$DATABASE_URL npm run db:push
```

Verify tables/enums exist:
```
psql "$DATABASE_URL" -c "\dT+ builder_rank"
psql "$DATABASE_URL" -c "\dt community_builder_*"
psql "$DATABASE_URL" -c "\dt county_vaults vault_ledger_entries"
```

## 3) Deploy

Backend (Railway/Render)
- Build cmd: `npm run build`
- Start cmd: `npm run start`
- Port: 5000
- Healthcheck: `GET /api/health` (add if missing)

Frontend (Vercel)
- Build: `npm run build`
- Output: Vite static
- Env: `VITE_API_URL=https://<backend-host>`

## 4) Stripe Wiring (Test Mode First)
- Enable Stripe Connect in dashboard
- Set `STRIPE_SECRET_KEY`, `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_WEBHOOK_SECRET`
- Expose webhook endpoint (see `community-builder-payment-service.ts` for path expectations)
- Start in test mode; no live payouts until verified

## 5) Smoke Test (End-to-End)

Run the script:
```
BASE_URL=https://<backend-host> \
BUILDER_COOKIE="connect.sid=..." \
ADMIN_COOKIE="connect.sid=..." \
tsx scripts/community-builder-smoke.ts
```

What it checks:
1) Builder profile create/update
2) Contribution proposal
3) Admin pending queue
4) Admin approve + verify
5) Builder sees verified status

Success criterion: script prints `SMOKE TEST PASSED` and exits 0.

## 6) Manual Spot Checks
- `GET /api/community-builder/profile` (builder cookie) returns profile
- `GET /api/admin/community-builder/contributions/pending` (admin cookie) shows items
- `GET /api/community-builder/notifications` returns list
- `GET /api/community-builder/payouts` returns payouts (can be empty)

## 7) If Something Fails
- Migrations: rerun `psql -f migrations/0001_community_builder.sql`
- Stripe webhooks: use `stripe listen --forward-to <backend>/api/stripe/webhook`
- Auth issues: ensure cookies include correct domain/secure flags
- 500s: check backend logs for stack traces

## 8) Production Hardening (after green tests)
- Turn on HTTPS and secure cookies
- Add rate limiting to auth + payouts
- Configure monitoring (Sentry) and alerting
- Backups: Neon logical backups enabled

## 9) Rollback Plan
- Keep `0000_wild_saracen.sql` snapshot for baseline
- To rollback tables only: drop community builder tables/enums (careful with data!), then restore from backup
- Prefer restoring from Neon backup rather than manual drops

## 10) Launch Checklist
- [ ] DB schema present (tables + enums)
- [ ] Stripe test payouts succeed
- [ ] Smoke script passes
- [ ] Admin dashboard approves/verify without errors
- [ ] County vault ledger updates on verification
- [ ] Logs clean (no unhandled errors)

If all boxes are checked, invite first builders and start payouts in test mode, then switch Stripe keys to live when ready.
