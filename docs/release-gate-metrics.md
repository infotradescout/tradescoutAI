# TradeScout Release Gate (Core User Success)

This checklist tracks the 4 core success metrics in production-like testing.

## How to run (required ship evidence)

Local, self-contained lane (recommended):

```powershell
npm run test:release-gates:local
```

This writes `artifacts/release-gate-metrics.json` and prints a summary.
The gate status is `fail` if any required lane has zero executed tests (skips count as "not executed").

Manual lane (when testing against an already-running instance):

```powershell
npm run dev
npm run test:release-gates
npm run report:release-gates
```

## 1) Account creation + login
- Pass when:
  - New user can register from `/create-account`.
  - Existing user can login from `/login`.
  - Session resolves on refresh (`/api/auth/user` returns authenticated user).
- Verify:
  - Registration response is `201/200`.
  - Login response is `200`.
  - Browser shows authenticated routes without redirect loop.

## 2) Direct Connect job request flow
- Pass when:
  - Authenticated user can post in `/direct-connect` (Post Request section).
  - Request appears under `/direct-connect/engagements`.
  - Request is visible in inbox/board routing views when applicable.
- Verify:
  - `POST /api/direct-connect/requests` succeeds.
  - `GET /api/direct-connect/requests` includes newly created request.

## 3) Public profile + verification flow
- Pass when:
  - User can complete profile in `/profile-settings`.
  - User can start/continue verification in `/verification`.
  - Address verification status reflects live backend values.
- Verify:
  - `PUT /api/user/profile` succeeds.
  - `GET /api/address-verification/status` reflects real state.
  - `POST /api/address-verification` + postcard request/verify work when used.

## 4) Scout as assistant + site controller
- Pass when:
  - `/scout` loads and accepts user prompts.
  - Scout starter cards route to working surfaces.
  - Scout controls open `Profile Settings`, `Verification`, and `Direct Connect`.
- Verify:
  - `/api/scout` (or assistant route) responds successfully for prompts.
  - Route actions from Scout land on valid pages with no dead-end.
