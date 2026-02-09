# Credential Rotation and Render Checklist

This runbook is for rotating credentials safely and keeping local + Render in sync.

## 1) Rotate secrets at providers first

Rotate in this order:

1. `DATABASE_URL` (new DB user/password if needed).
2. `SESSION_SECRET` (generate a new 32+ byte random secret).
3. `GEMINI_API_KEY`.
4. OAuth secrets:
   - `GOOGLE_CLIENT_SECRET`
   - `FACEBOOK_APP_SECRET`
5. Payment/storage secrets:
   - `STRIPE_SECRET_KEY`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_ACCESS_KEY_ID` (if rotating key pair)
6. Internal integration secrets:
   - `MEALSCOUT_SHARED_SECRET`
   - `MEALSCOUT_API_TOKEN`
7. Admin bootstrap credentials:
   - `MASTER_ADMIN_PASSWORD` (and related admin vars if used)

## 2) Update Render environment variables

Use Render Dashboard:

1. Open service `tradescout-pro`.
2. Go to `Environment`.
3. Update each rotated key.
4. Save changes and trigger redeploy.

The expected key contract is in `render.yaml`.

## 3) Update local secrets

1. Update `.env` locally.
2. Confirm `.env` is not tracked by git.
3. Keep placeholders only in `.env.example`.

## 4) Validate

1. Login/auth flows work (Google/Facebook if enabled).
2. Scout responses work (`GEMINI_API_KEY`).
3. File uploads and media URLs work (R2 vars).
4. Payments/Stripe paths work (if enabled).
5. Admin pages load (`/api/admin/users` etc).

## 5) Emergency stale-client note

If users still see old UI after deploy:

1. Hard refresh browser (Ctrl/Cmd+Shift+R).
2. Reopen app once to let service-worker cleanup run.
3. Confirm latest deployment ID in Render logs.
