# Manual JW Stone employee access

Implementation continuation of PR #655; not a live release. This supersedes the earlier server-settings-only assignment instructions in EMPLOYEE_RECEIVING_MVP.md. No production grants, revocations, inventory changes, or Drive writes were performed for this continuation.

## Owner workflow after deployment

Sign into JW Stone as the linked business owner or a platform super/head administrator. Close the receiving workspace to return to the website, then choose **Manage employee access**. The control is alongside the employee inventory entry on the website; it does not replace or discard the receiving draft.

Enter the employee's exact sign-in email, choose **Find account**, verify the returned name/email/account ID, explicitly confirm their authorization, then choose **Grant inventory access**. Lookup alone does not grant access. Missing or ambiguous matches cannot be assigned. The employee must already have an account; this screen neither creates accounts nor sends invitations.

An assigned employee enters the existing receiving workspace after signing in. Ordinary customer business membership and self-selected employee labels are not employee authorization. Employee access does not confer permission to manage staff or grant buyer membership/purchasing rights.

To remove inventory access, use **Remove access** and confirm the selected account. Revocation is read by subsequent receiving API requests, not merely hidden in the interface. It does not delete stock, remove customer membership, erase existing browser drafts, or cancel an upload already authorized before the revocation. Owner and platform-admin access is inherited from their roles and cannot be removed through this employee list.

## Stored authority and compatibility

The authority source is the existing stone_inventory_delegations table, scoped to the exact linked JW Stone business and exact delegate_user_id. Direct grants require all three existing inventory scopes (read, write, publish), active status, no revocation timestamp, and no expired date. A business-to-business delegation does not identify an employee and is ignored here.

The existing JW_STONE_EMPLOYEE_USER_IDS configuration remains a bootstrap fallback only when that user has no explicit direct delegation record. An explicit revoked, expired, limited-scope, or contradictory revoked-timestamp record overrides the old allowlist. A database read error does not silently fall back to the allowlist. Removing an allowlisted employee creates a durable revoked record; deleting that record manually could restore the old fallback and must not be used as revocation.

The staff screen grants these existing inventory capabilities, including access to internal receipt costs and notes; the confirmation explicitly describes this. It does not grant or bypass BidRock seller entitlements, payment authority, or JW Stone customer membership. Legacy receiving-service imports re-export the same new authority resolver, avoiding separate UI and API permission lists.

Every grant/revocation and its admin_audit_log entry commit in the same PostgreSQL transaction. Audit failure rolls the change back. The current database revision is required, preventing a stale manager view from overwriting a newer change. A transaction-scoped advisory lock serializes cooperating changes to that business/account; an atomic ON CONFLICT condition also checks the expected revision. No runtime schema creation or schema push is added. The existing stone delegation and audit-log migrations must be present.

## API and interface boundaries

Staff list, exact-email lookup, and permission changes require the JW business owner or platform super/head admin on the server. Changes require explicit confirmation and use the authenticated actor, never a supplied actor/business ID. Responses are private/no-store with CDN caching disabled. Lookup and writes are rate-limited. Browser mutations additionally require the same request protocol, Origin, and Host (with the application's existing trusted-proxy configuration) and the receiving intent header; cross-origin staff administration is not enabled by broadening CORS.

The list includes up to 500 matching accounts; exact-email lookup supports a specific account beyond that list. Only limited identity and permission fields are returned, not phone numbers, addresses, passwords, receipt costs, or private notes. Unreadable lists disable stale removal controls. Changed-email, rejected, timed-out, or conflicting mutations clear the selected candidate so another lookup is required before granting. Inherited owner/admin entries cannot expose a grant/revoke button.

## Verification performed in this continuation

51 focused local tests passed on Node 22.16.0, with no failures or skips:

- 26 actual contract, authority-service, and route-handler checks, using mocked PostgreSQL and HTTP-framework dependencies.
- 15 actual component-function and event-handler checks using mocked React/query/API ports, including the employee entry integration.
- 10 existing receiving-service regression checks, now loading the actual shared employee authority implementation with mocked database/storage/image ports.

Command (with TypeScript installed by the repository):

```sh
node --experimental-strip-types --experimental-vm-modules --test \
  scripts/jw-stone-employee-access.test.mjs \
  scripts/jw-stone-employee-access-ui.test.mjs \
  scripts/jw-stone-receiving-service.test.mjs
```

The standalone employee-access contract passed strict TypeScript checking. All seven changed/new implementation TS/TSX modules passed syntax transpilation. The preexisting saved-lot route test fixture was updated only for its two new dependency ports; its six existing public-route checks also passed independently, while its full cart/store suite was not rerun in this isolated checkout. The proof workflow now includes the new tests while retaining the full application and browser gates.

These results are not a PostgreSQL integration run, real DOM/browser preview, full repository build/typecheck, live employee sign-in, or phone-camera-to-Drive upload. The local repository clone failed DNS resolution; the authorized desktop process attempt returned no available device. No access restriction was bypassed. Existing release approval, real application Drive/photo-storage writes, complete application checks, and supported-phone testing remain required before activation. Stock correction/decrement controls and server-side draft repair remain separate unfinished work.
