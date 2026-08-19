# Admin OS v2 — people and moderation workspaces

## Owner outcome

People operations cannot remain a giant legacy table and content moderation cannot remain a dashboard of disconnected cards. Both need to function as native workspaces inside the same Admin OS without weakening account protections, audit reasons, destructive confirmations, or role boundaries.

## Users

The former Users page combined a tools accordion, filter card, wide sticky-column table, action dropdowns, role dialog, and profile editor inside another page shell.

The native v2 Users workspace now provides:

- Active, verified, pending, and suspended account summary
- Active versus archived-import account scope
- Search across account name, active email, and archived original email
- Status, role, address, setup, joined-time, and account-scope filters
- CSV export of the filtered result set
- Compact expandable account rows instead of a wide table
- Role, verification, address, email, setup, and joined-date state at a glance
- Profile viewing and profile support editing
- Role editing
- Resend verification
- Super-admin impersonation with a required reason
- Suspend, unsuspend, verify, revoke verification, and quick role changes with required audit reasons
- Protected deletion with self-delete and super-admin boundaries
- Manual verification-link support
- Persisted admin safety key
- Saved and pinned account views

Preserved account endpoints:

- `GET /api/admin/users`
- `PUT /api/admin/users/:userId/role`
- `DELETE /api/admin/users/:userId`
- `POST /api/admin/users/info`
- `PUT /api/admin/users/:userId/profile`
- `POST /api/admin/user-controls/suspend/:userId`
- `POST /api/admin/user-controls/unsuspend/:userId`
- `POST /api/admin/user-controls/verify/:userId`
- `POST /api/admin/user-controls/revoke-verify/:userId`
- `POST /api/admin/user-controls/role/:userId`
- `POST /api/auth/request-email-verification`
- `POST /api/admin/impersonate/start/:userId`

Privileged profile writes retain the audited confirmation phrase and optional strict-mode safety key.

Archived import placeholders remain visibly separate from active login accounts and continue pointing operators to Business Import for cleanup.

## Moderation

The former Moderation page displayed multiple dashboard cards and converted failed reads into empty arrays, making an unavailable queue look like a healthy zero.

The native v2 Moderation workspace now provides:

- Flagged-content, hidden-content, total-flag, and kick-escalation summary
- Separate Flagged Content, Recent Actions, and Kick Escalations workspaces
- Explicit unavailable states when any source query fails
- Written reason requirement before content removal
- Destructive confirmation before removal
- Read-only history for hidden and removed content
- Staff kick-vote decisions kept separate from the operations-only durable ban
- Role-gated ops ban with a second destructive confirmation

Preserved moderation endpoints:

- `GET /api/admin/moderation/flagged`
- `GET /api/admin/moderation/reports`
- `GET /api/admin/moderation/recent-actions`
- `GET /api/admin/moderation/kick-queue`
- `POST /api/admin/moderation/approve/:contentId`
- `POST /api/admin/moderation/remove/:contentId`
- `POST /api/admin/moderation/kick-queue/:reportId/decision`
- `POST /api/admin/moderation/kick-queue/:reportId/ops-ban`

## Native surface registry

`users` and `moderation` now join the native Admin OS v2 surface registry. Adapted tools remain reachable and continue migrating concurrently.

## Preserved boundaries

This migration does not:

- Change admin role authority
- Change API permission middleware
- Lower impersonation or deletion protections
- Remove audit reasons
- Treat archived import placeholders as active users
- Change public profile ownership
- Change verification requirements
- Change moderation decision authority
- Turn missing data into zero
- Change partner records, requests, Stone Core, inventory, marketplace approvals, or finance records

## Release proof

Release requires:

- Production client and server build
- No critical schema drift
- Users list read proof
- Role, profile, control, verification-email, impersonation, and delete route contract proof
- Moderation queue read proof
- Content approval and removal route contract proof
- Kick decision and ops-ban route contract proof
- Native surface markers for Users and Moderation
- Authenticated desktop and mobile screenshots
