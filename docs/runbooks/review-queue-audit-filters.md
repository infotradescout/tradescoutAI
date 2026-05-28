# Review Queue Audit Filters + Query Controls

## Scope
- Endpoint: `GET /api/admin/tool-discovery/tool-blueprints`
- Purpose: admin review queue filtering and stable query controls

## Supported query params
- `status`: comma-separated list of `proposed,deferred,approved,rejected,merged`
- `minRiskScore`: integer lower bound
- `maxRiskScore`: integer upper bound
- `minImpactScore`: integer lower bound
- `sort`: one of:
  - `risk_desc` (default)
  - `impact_desc`
  - `updated_desc`
  - `created_desc`
  - `risk_asc`
- `limit`: bounded to `1..100` (default `25`)
- `offset`: bounded to `>=0` (default `0`)

## Compatibility and safety behavior
- Auth and role guards are unchanged.
- Response shape remains:
  - `{ blueprints: ToolProposal[], total: number }`
- Invalid/unknown status values are ignored.
- Unsupported sort values fall back to default sort.
- `decided_by` and `decidedBy` are intentionally ignored on this endpoint.

## Example curl
```bash
curl -sS "https://www.thetradescout.com/api/admin/tool-discovery/tool-blueprints?status=proposed,deferred&minRiskScore=4&sort=impact_desc&limit=20&offset=0" \
  -H "Cookie: <admin-session-cookie>"
```

## Non-goals
- No auth model changes
- No role changes
- No mutation behavior changes
- No Direct Connect, Scout UI, or onboarding changes
