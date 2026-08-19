# Admin OS v2 — platform workspaces

## Owner outcome

Platform administration cannot remain a legacy tab warehouse nested inside the new Admin OS. Settings, advertisements, prizes, notifications, authority controls, testing, feature flags, and rollout evidence must become clear operating workspaces without changing the authority of their existing APIs.

## Platform Settings

The legacy Admin Panel mixed configuration records with heatmaps, monitoring, error reports, code-fix tools, pricing, finance, notifications, advertisements, and prizes in one oversized tab surface.

The native v2 Platform Settings workspace now contains only configuration and communication work that belongs together:

- Site settings
- Business-provider settings
- Notification operations
- Advertisements
- Prize configurations

Older tab deep links are preserved but redirected to their canonical workspaces:

- Heatmap → County Coverage
- Monitoring and AI Fixes → System Status
- Error Reports → Error Reports
- Pricing → Pricing Analytics
- Finance → Finance
- Authority and testing controls → Platform Controls

### Preserved configuration endpoints

- `GET/POST /api/admin/site-settings`
- `PUT/DELETE /api/admin/site-settings/:id`
- `GET/POST /api/admin/business-provider-settings`
- `PUT/DELETE /api/admin/business-provider-settings/:id`
- `GET/POST /api/admin/advertisements`
- `PUT/DELETE /api/admin/advertisements/:id`
- `GET/POST /api/admin/prizes`
- `PUT/DELETE /api/admin/prizes/:id`

### Preserved notification endpoints

- `POST /api/admin/test-push-notification`
- `POST /api/admin/notifications/broadcast`

In-app delivery remains part of every broadcast. Email and push remain optional and continue respecting existing preferences and subscriptions.

## Platform Controls

The former Controls Hub used several large nested cards for authority metrics, rollout readiness, testing controls, feature flags, email diagnostics, and progressive-exposure evidence.

The native v2 Platform Controls workspace now provides:

- Authority-card state
- Enabled-feature-flag count
- Testing-mode state
- Email-provider state
- Progressive exposure readiness
- Tier distribution
- Readiness checks
- Recent tier trend
- Top rollout reasons
- Authority operations
- Testing controls
- Feature flags

Unavailable sources remain visibly unavailable rather than being converted to zero.

### Preserved read endpoints

- `GET /api/admin/authority/decision-card-metrics`
- `GET /api/admin/testing-settings`
- `GET /api/admin/feature-flags`
- `GET /api/admin/email/diagnostics`
- `GET /api/analytics/progressive-exposure/summary`
- `GET /api/analytics/progressive-exposure/timeline`

Existing write authority remains inside `AuthorityOperations`, `AdminTestingControls`, and `FeatureTogglePanel`. This migration does not create a second mutation path.

## Native surface registry

The following tool IDs now bypass the temporary adapted-v1 surface:

- `panel`
- `controls`

All previously migrated native tools remain native. System Status and the remaining operating tools continue migrating concurrently.

## Preserved boundaries

This migration does not:

- Change admin roles or permissions
- Change API middleware
- Change feature-flag mutation authority
- Change testing-control mutation authority
- Change authority-governance mutation authority
- Change email delivery rules
- Change notification targeting rules
- Change advertisements or prize data without an explicit admin action
- Change partner records, public profiles, requests, users, Stone Core, inventory, marketplace approvals, or finance records

## Release proof

Release requires:

- Production client and server build
- No critical schema drift
- Platform Settings list and CRUD route contract proof
- Notification test and broadcast route contract proof
- Platform Controls read-source proof
- Confirmation that existing authority, testing, and feature-flag components remain the only write owners
- Native surface markers for `panel` and `controls`
- Legacy tab redirect proof
- Authenticated desktop and mobile screenshots
