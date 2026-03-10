# Verification Bypass Policy

## Purpose
This policy defines when TradeScout may bypass verification gates and how those bypasses are audited.

The goals are:
- Keep normal trust gates intact for public users.
- Allow controlled staff/admin operations for support and pilot workflows.
- Keep all bypass behavior explicit, reversible, and observable.

## Canonical Configuration
All role/email/env bypass evaluation is centralized in:
- `server/utils/authorityPolicy.ts`

Primary helpers:
- `resolvePrivilegedVerificationBypass(user)`
- `isDirectConnectUnverifiedBypassEnabled()`
- `hasManualDirectConnectBypassRequest(req)`
- `normalizeAuthorityRole(role)`
- `collectAuthorityRoles(user)`

## Bypass Modes
1. Privileged role bypass
- Triggered when user has configured bypass role.
- Env key: `PRIVILEGED_VERIFICATION_BYPASS_ROLES`
- Defaults include support/admin roles.

2. Privileged alias bypass
- Triggered when user email matches configured privileged aliases.
- Env keys:
  - `MASTER_ADMIN_EMAIL`
  - `SUPER_ADMIN_EMAIL_ALIASES`
  - `PRIVILEGED_ALIAS_EMAILS`

3. Admin-flag bypass
- Triggered when `isAdmin` or `isSuperAdmin` is true.

4. Direct Connect demo bypass
- Triggered by demo flags for pilot/demo environments.
- Env keys:
  - `DIRECT_CONNECT_ALLOW_UNVERIFIED`
  - `DIRECT_CONNECT_DEMO_MODE`
  - `TRADE_SCOUT_DEMO_MODE`

5. Manual Direct Connect override
- Triggered when explicit request override flag/header is present and actor is privileged.
- Request signals:
  - body/query `allowUnverifiedDirectConnect=true`
  - body/query `demoBypassVerification=true`
  - header `x-direct-connect-demo-bypass: true`

## Precedence
Direct Connect bypass resolution order:
1. Manual privileged override
2. Privileged bypass (role/email/admin)
3. Environment demo bypass
4. No bypass

## API Surface
`/api/auth/user` now returns:
- `user.verificationBypass.active`
- `user.verificationBypass.privileged`
- `user.verificationBypass.reason`
- `user.verificationBypass.matchedRoles`
- `user.verificationBypass.matchedEmail`
- `user.verificationBypass.directConnectDemoMode`

This metadata is used for UI transparency (Verification and Direct Connect pages).

## Audit Logging Requirements
When bypass is applied for Direct Connect operations, routes must emit:
- `action: "direct_connect_verification_bypass_applied"`
- operation (`create`, `route`, `admin_create`)
- actor user id
- bypass source/reason
- request id (when available)

Current implementation:
- `server/routes/direct-connect.ts`
- `server/services/adminAuditLogService.ts`

## Safety Constraints
- Bypass does not grant contact authority by itself.
- Visibility never implies access.
- Contact still follows Intent -> Decision Card -> Contact invariants.
- County routing and Trust/CVS logic remain unchanged.

## Rollback
To restore strict verification:
1. Disable demo env flags listed above.
2. Remove temporary privileged aliases/roles if used.
3. Confirm `/api/auth/user` returns `verificationBypass.active=false` for standard users.
4. Smoke test Direct Connect create/route with unverified homeowner (expect verification-required response).
