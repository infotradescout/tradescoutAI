# TradeScout Admin OS — Ecosystem Truth

## Owner outcome

The founder needs one reliable place to see current operating ownership, decision evidence, commercial-term conflicts, and request-to-outcome link coverage without creating another command center or another write authority.

## Reuse disposition

- **Admin shell:** extend Admin OS.
- **Identity and profile access:** reuse current identity and profile-account records.
- **Requests:** reuse Work Requests and Direct Connect.
- **Partners:** reuse Managed Partner Operations.
- **Purchasing and fulfillment:** reuse Procurement.
- **Stone:** keep Stone Core authoritative.
- **Commercial terms:** index current evidence and conflicts; do not replace agreements, orders, payouts, or accounting.
- **Outcomes:** project current domain events into one read-only timeline; do not create or backfill a competing event ledger.

## Registered surfaces

The client registers one native Super Admin workspace:

- `/admin/ecosystem-truth`

The server exposes one authenticated Super Admin read endpoint:

- `GET /api/admin/ecosystem-truth`

There is no POST, PUT, PATCH, or DELETE endpoint for this workspace.

## Views

1. **Current owners** — identifies the operating system that already owns each fact and reports broken links without substituting a new owner.
2. **Decision history** — shows current governing, audit, and operational sources while preserving the missing durable-governance fields as explicit gaps.
3. **Commercial terms** — shows recorded rates, evidence coverage, and conflicts without presenting operational values as signed agreements.
4. **Outcome links** — combines existing event evidence into a read-only timeline and reports missing parent or cross-domain references.

## Protected boundaries

This work does not change:

- Public pages, copy, calls to action, or ranking behavior
- Identity, profile accounts, or signup
- Direct Connect routing, contact gates, or recipients
- Partner ownership
- Procurement write paths
- Stone Core or physical inventory ownership
- Pricing, commissions, payouts, or signed terms
- Historical events
- Customer contact details, credentials, or full payment information

## Local evidence

Confirmed locally:

- All 23 primary Admin OS navigation records match the native workspace registry.
- All 11 workspace links used by the report resolve to existing Admin OS tools.
- The new endpoint is behind the existing authentication and Super Admin middleware.
- The report service contains SELECT-only database access and no provisioning call.
- The client contains no POST, PUT, PATCH, or DELETE request.
- The changed production TypeScript and TSX files parse and transform successfully.
- The project reuse index reports no new duplicate-source error for the Ecosystem Truth files.

Confirmed through read-only Render checks in `My Workspace` on 2026-08-21:

- The production `tradescoutAI` web service is active on `main` and its latest deployment is `live`.
- Production request logs returned no 5xx responses for the checked one-hour window (2026-08-21 20:03–21:03 UTC).
- One error-labelled entry appeared in that window, but it was a successful build asset-size line rather than an application exception.
- Render lists no TradeScout-managed Postgres instance in the workspace. The only database returned belongs to another service, so it was intentionally not queried.
- No deployment, service update, database mutation, or production route call was performed.

Not yet claimed:

- Full repository TypeScript, contract-test, or production bundle success; locked dependencies are not installed in the scratch checkout.
- Authenticated desktop or mobile browser proof.
- Live database query success for every source.
- Production deployment or route reachability.

## Remaining release proof

Before merge or deployment:

- Install the repository's locked dependencies.
- Run focused client and server contract tests.
- Run TypeScript and the minimum release gate.
- Identify and authorize the live TradeScout database connection, then run the report against it in read-only mode.
- Verify Super Admin desktop and mobile rendering.
- Confirm no ordinary admin or public user can reach the workspace or endpoint.
