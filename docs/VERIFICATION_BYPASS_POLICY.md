# TradeScout Verification & Authority Policy

## Purpose
This document defines the canonical policy for role- and flag-backed verification bypass and authority-related overrides in TradeScout. Configured authority email addresses are reserved recovery identifiers only; an email value never grants a role, admin flag, onboarding exception, or verification bypass.

## Platform Law Guardrails
- Visibility never grants contact.
- Contact remains gated through intent and governed pathways.
- Overrides are explicit, auditable, and reversible by policy.
- Demo logic must be visible and intentionally enabled.

## Canonical Runtime Source
- Server runtime source: `server/utils/authorityConfig.ts`
- Policy enforcement layer: `server/utils/authorityPolicy.ts`
- Admin inspection endpoint: `GET /api/admin/authority/config`
- Runtime refresh endpoint: `POST /api/admin/authority/config/reload`

## Privileged Bypass Types
- `role`: user role is in configured verification bypass role list.
- `admin_flag`: user carries admin/super-admin authority flag.
- `direct_connect_demo_mode`: Direct Connect unverified demo mode is enabled.
- `manual_direct_connect_override`: explicit manual admin override path.

## Reserved Recovery Identifiers
- `MASTER_ADMIN_EMAIL`, `SUPER_ADMIN_EMAIL_ALIASES`, and `PRIVILEGED_ALIAS_EMAILS` are legacy environment names for explicitly reserved recovery candidates.
- The configured set defaults to empty; there are no hard-coded email addresses.
- Public password and social registration must not create an account for a reserved identifier.
- Matching `user.email` or `user.claims.email` never grants or persists a role, admin flag, onboarding exception, business-provider access, or verification bypass.
- Account recovery or authority activation requires an existing, separately governed server-side workflow. This policy does not create an email-based activation path.

## Environment Variables
- `MASTER_ADMIN_EMAIL` (reserved recovery identifier)
- `SUPER_ADMIN_EMAIL_ALIASES` (CSV reserved recovery identifiers)
- `PRIVILEGED_ALIAS_EMAILS` (CSV reserved recovery identifiers; legacy name)
- `PRIVILEGED_VERIFICATION_BYPASS_ROLES` (CSV)
- `DIRECT_CONNECT_ALLOW_UNVERIFIED`
- `DIRECT_CONNECT_DEMO_MODE`
- `TRADE_SCOUT_DEMO_MODE`

## UI Transparency Requirements
- Users with active bypass must see explicit in-app messaging.
- Bypass reason must be labeled in plain language.
- Admin surfaces must expose the currently loaded authority config and fingerprint.
- Reserved recovery identifiers must be displayed separately from bypass roles and described as non-authoritative.

## Audit Requirements
- Viewing authority config is logged.
- Reloading authority config is logged.
- Privileged overrides in contact/verification paths are logged by route-level handlers.

## Operational Notes
- Runtime config auto-refreshes when authority env values change.
- Manual reload endpoint is available for explicit operator action and audit trace.
- Production operations must audit existing users and sessions for historical email-derived promotions before considering this remediation complete.
