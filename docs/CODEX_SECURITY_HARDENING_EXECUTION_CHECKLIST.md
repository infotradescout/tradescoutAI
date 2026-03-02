# Codex Security Hardening Execution Checklist

Status: Approved execution guide
Owner intent: Remove privilege-escalation paths, preserve authority gating, and eliminate sensitive logging leakage without changing core discovery→intent→decision→contact behavior.

## 0) Scope lock (do not drift)

### In scope
- Remove emergency and hardcoded admin elevation paths.
- Bind real-time identity to trusted server auth, not client-declared identity.
- Remove duplicate route shadows where behavior diverges.
- Redact sensitive auth payload logging.
- Add regression tests for each hardened boundary.

### Explicitly out of scope
- No product-flow redesign.
- No monetization or ranking logic changes.
- No county intelligence model changes.
- No Trust/CVS policy rewrites.
- No broad refactors unrelated to listed endpoints.

### Psychological intent contract (global)
- Target belief: “Admin authority is earned and verifiable, never backdoored.”
- Target behavior: “Users and staff trust system decisions and use official gated paths.”
- Principles: procedural justice, security transparency, consistency.
- Risk prevented: silent authority bypass and trust collapse after exploit disclosure.

---

## 1) Patch Batch A — remove direct admin backdoor

### Files
- `server/routes.ts`
- `client/src/components/admin/AdminLogin.tsx`
- (if routed anywhere) route imports/usages of `AdminLogin`
- `server/tests/security-regressions.test.ts`

### Changes
1. In `server/routes.ts`, remove or hard-disable `POST /api/auth/emergency-admin-access`.
   - Preferred: return 410 with message `Emergency admin access is disabled`.
   - Do not keep any hardcoded Facebook ID checks.
2. In client code, remove UI affordance that calls this endpoint (`AdminLogin.tsx`) or convert to static deprecation notice without action.
3. Update security regression test to assert endpoint is unavailable (404/410), not present/usable.

### Law + psychology mapping
- Law enforced: authority cannot be granted by awareness/identifier alone.
- Target belief: “No hidden shortcut grants admin power.”
- Target behavior: admins use authenticated audited routes.
- Risk prevented: unauthenticated privilege escalation.

### Verification
- `npm run check`
- targeted test: `npx vitest run server/tests/security-regressions.test.ts`
- manual curl (expect 404/410): `POST /api/auth/emergency-admin-access`

---

## 2) Patch Batch B — remove hardcoded master-admin account binding

### Files
- `server/routes.ts`
- `client/src/components/admin/ConnectMasterAdmin.tsx`
- `server/tests/security-regressions.test.ts`

### Changes
1. In `server/routes.ts`, hard-disable or delete `POST /api/auth/connect-master-admin` path that binds by hardcoded email.
2. Remove or deprecate `ConnectMasterAdmin` client action.
3. Add regression test asserting this endpoint is not available in runtime.

### Law + psychology mapping
- Law enforced: claims-first identity and verification semantics cannot be bypassed by hardcoded identities.
- Target belief: “Identity upgrades require governed verification paths.”
- Target behavior: use approved setup/migration tooling, not hidden account grafting.
- Risk prevented: authenticated account takeover of head-admin identity.

### Verification
- `npx vitest run server/tests/security-regressions.test.ts`
- manual call as authenticated non-admin should fail with 404/410.

---

## 3) Patch Batch C — secure Socket.IO identity

### Files
- `server/messaging-service.ts`
- `server/index.ts` (if shared middleware wiring needed)
- `server/auth.ts` (optional: export session middleware helper)
- tests in `server/tests` for messaging auth

### Changes
1. Remove trust of `socket.handshake.auth.userId` as source of identity.
2. Resolve user identity from server-trusted session/JWT only.
3. Reject socket connection if no server-validated user id exists.
4. Keep conversation membership checks as secondary defense.

### Recommended implementation shape
- Extract reusable function in messaging layer:
  - `resolveSocketUserId(socket): Promise<string | null>` from trusted auth context.
- Middleware sets `socket.data.userId` only from trusted resolution.
- Any mismatch between claimed and resolved identity => reject.

### Law + psychology mapping
- Law enforced: authority derives from governed identity state, not client declaration.
- Target belief: “Realtime events are private and identity-safe.”
- Target behavior: rely on normal authenticated sessions.
- Risk prevented: cross-user event spoofing/data exposure.

### Verification
- Add tests:
  - rejected connection without trusted auth context.
  - rejected connection when client supplies arbitrary `userId`.
  - accepted connection when trusted auth exists.
- run: `npm run test:run`

---

## 4) Patch Batch D — remove route shadow conflicts

### Confirmed duplicates to consolidate
- `GET /api/admin/professional/pending`
- `POST /api/admin/realtor/verify/:profileId`
- `POST /api/admin/car-salesman/verify/:profileId`
- `PUT /api/affiliate/settings`
- `GET /api/moderation/reputation` (cross-file duplicate with `server/moderation.ts`)

### Files
- `server/routes.ts`
- `server/moderation.ts`
- relevant tests for admin/professional/moderation/affiliate settings

### Changes
1. Keep one canonical handler per method+path.
2. Preserve stricter guard + audit behavior when selecting canonical version.
   - Prefer versions using shared middleware (`isAdmin`/`requireRole`) and event logging.
3. Delete or rename legacy duplicate routes to non-conflicting internal paths only if still needed.

### Law + psychology mapping
- Law enforced: deterministic and explainable behavior.
- Target belief: “Admin actions are consistent and auditable.”
- Target behavior: operators trust one predictable endpoint behavior.
- Risk prevented: shadowed authorization differences by registration order.

### Verification
- route duplicate script returns zero for production routes.
- regression tests for admin/professional verify endpoints still pass.

---

## 5) Patch Batch E — redact sensitive logging

### Files
- `server/index.ts`
- `server/routes.ts`
- `server/routes/contractor-signup.ts`

### Changes
1. In `server/index.ts`, stop logging full JSON response body for all `/api` responses.
   - Log method/path/status/duration only.
   - Optional: allow explicit safe allowlist of small non-sensitive responses.
2. In password reset handlers in `server/routes.ts`:
   - remove request body logs,
   - remove token/code debug logs from response in runtime paths,
   - never log plaintext `newPassword` flow fields.
3. In contractor signup route, remove raw `req.body` console logging.

### Law + psychology mapping
- Law enforced: trust/CVS decisions must be publicly defensible without leaking sensitive internals.
- Target belief: “Private data is handled responsibly.”
- Target behavior: users share data with confidence.
- Risk prevented: accidental credential/token/PII leakage via logs.

### Verification
- grep checks:
  - no auth handlers logging `req.body`.
  - no `debugToken`/`debugCode` in public JSON responses.
- run: `npm run check` and `npm run test:run`

---

## 6) Regression tests to add/update (required)

### Required tests
- Security regressions:
  - emergency admin endpoint unavailable.
  - connect-master-admin unavailable.
  - duplicate admin verification routes reduced to single canonical behavior.
- Messaging auth:
  - handshake with arbitrary `userId` fails.
  - authorized user can connect and only access own conversation channels.
- Logging safety:
  - password reset request does not return debug token/code in runtime API.

### Test lanes
- Fast lane: `npm run test:run`
- Strict lane: `npm run test:run:no-skips` with DB env
  - `TEST_DATABASE_URL`
  - `RUN_INTEGRATION_TESTS=true`

---

## 7) Execution order (must follow)

1. Batch A
2. Batch B
3. Batch C
4. Batch D
5. Batch E
6. Tests + verify commands
7. Final route-dup + sensitive-log grep checks

Stop on first failing batch, fix in-batch only, then continue.

---

## 8) Definition of done

- No unauthenticated or hardcoded path can grant admin identity.
- Socket identity cannot be asserted by client payload.
- Duplicate method+path admin/moderation/affiliate handlers are consolidated.
- Sensitive auth payloads/tokens are not logged or returned.
- `npm run check` passes.
- `npm run test:run` passes.
- `npm run test:run:no-skips` passes in strict DB lane.

---

## 9) Rollback safety

- Use feature branch only.
- Commit after each batch with small reversible diffs.
- If a batch breaks auth flow, revert that batch only and continue investigation.
