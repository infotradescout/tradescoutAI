# TradeScout Verification & Authority Bypass Policy

## Purpose
This document defines the canonical policy for privileged verification bypass and authority-related overrides in TradeScout.

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
- `email_alias`: user email matches privileged alias list.
- `admin_flag`: user carries admin/super-admin authority flag.
- `direct_connect_demo_mode`: Direct Connect unverified demo mode is enabled.
- `manual_direct_connect_override`: explicit manual admin override path.

## Environment Variables
- `MASTER_ADMIN_EMAIL`
- `SUPER_ADMIN_EMAIL_ALIASES` (CSV)
- `PRIVILEGED_ALIAS_EMAILS` (CSV)
- `PRIVILEGED_VERIFICATION_BYPASS_ROLES` (CSV)
- `DIRECT_CONNECT_ALLOW_UNVERIFIED`
- `DIRECT_CONNECT_DEMO_MODE`
- `TRADE_SCOUT_DEMO_MODE`

## UI Transparency Requirements
- Users with active bypass must see explicit in-app messaging.
- Bypass reason must be labeled in plain language.
- Admin surfaces must expose the currently loaded authority config and fingerprint.

## Audit Requirements
- Viewing authority config is logged.
- Reloading authority config is logged.
- Privileged overrides in contact/verification paths are logged by route-level handlers.

## Operational Notes
- Runtime config auto-refreshes when authority env values change.
- Manual reload endpoint is available for explicit operator action and audit trace.
