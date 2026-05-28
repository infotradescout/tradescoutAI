# Admin Audit Log Filters + Query Controls

- Route: `GET /api/admin/audit-log`
- Auth: `isAuthenticated` + `isSuperAdmin` (unchanged)
- Response shape: `{ log, count }` (unchanged)

## Supported query params

- `limit`
  - integer, clamped to `1..500`
  - default `100`
- `action`
  - exact action/type match
  - empty values ignored
- `actorId`
  - exact actor/admin id match
  - empty values ignored
- `from`
  - strict ISO UTC timestamp only (for example: `2026-05-01T00:00:00.000Z`)
  - invalid format returns `400`
- `to`
  - strict ISO UTC timestamp only (for example: `2026-05-31T23:59:59.999Z`)
  - invalid format returns `400`
- `sort`
  - `asc` or `desc`
  - default `desc`

## Examples

```bash
curl "/api/admin/audit-log?limit=200"
curl "/api/admin/audit-log?action=direct_connect.request.created&sort=desc"
curl "/api/admin/audit-log?from=2026-05-01T00:00:00.000Z&to=2026-05-31T23:59:59.999Z"
```

## Notes

- Unknown query params are ignored.
- Write behavior is unchanged (`logAdminAction` remains the write source).
- This slice only hardens audit-history reads and does not add any mutation authority.
