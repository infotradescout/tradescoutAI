import { pool } from "../db";
import { getStoneInventoryProfileTarget, type StoneInventoryProfileTarget } from "./stoneInventoryService";
import {
  JW_STONE_EMPLOYEE_SCOPES, JwStoneEmployeeAccessError, isJwStonePlatformManager,
  jwStoneActorId, jwStoneConfiguredEmployeeIds,
  type JwStoneEmployeeAccount, type JwStoneEmployeeAccessChange,
} from "@shared/jwStoneEmployeeAccess";

// No membership/entitlement query belongs in this authority path.
const columns = `u.id AS "userId", u.email, u.first_name AS "firstName", u.last_name AS "lastName",
  u.role, u.roles, d.status, d.scopes, d.updated_at::text AS revision, (d.revoked_at IS NOT NULL) AS revoked,
  (d.expires_at IS NOT NULL AND d.expires_at <= NOW()) AS expired`;
const join = `LEFT JOIN stone_inventory_delegations d ON d.delegate_user_id = u.id
  AND d.holder_business_id = $1 AND d.delegate_business_id IS NULL`;
const configured = () => jwStoneConfiguredEmployeeIds(process.env.JW_STONE_EMPLOYEE_USER_IDS || "");
type Row = Record<string, any>;
function accountView(row: Row, target: StoneInventoryProfileTarget): JwStoneEmployeeAccount {
  const owner = row.userId === target.businessOwnerUserId;
  const admin = isJwStonePlatformManager(row);
  const hasRecord = row.revision != null;
  const expired = row.expired === true;
  const source = owner ? "owner" : admin ? "platform_admin" : hasRecord ? "manual" : configured().includes(row.userId) ? "server_configuration" : "none";
  const delegated = row.status === "active" && row.revoked !== true && !expired && Array.isArray(row.scopes) &&
    JW_STONE_EMPLOYEE_SCOPES.every(scope => row.scopes.includes(scope));
  return {
    userId: String(row.userId), email: String(row.email),
    name: [row.firstName, row.lastName].filter(Boolean).join(" ").trim(),
    allowed: owner || admin || (hasRecord ? delegated : source === "server_configuration"),
    source, revision: row.revision == null ? null : String(row.revision), expired,
  };
}
export async function getJwStoneEmployeeAccess(user: unknown): Promise<{
  target: StoneInventoryProfileTarget | null; allowed: boolean; canManageStaff: boolean;
}> {
  const id = jwStoneActorId(user);
  if (!id) return { target: null, allowed: false, canManageStaff: false };
  const target = await getStoneInventoryProfileTarget("jw-stone");
  if (!target || target.profileSlug !== "jw-stone") return { target: null, allowed: false, canManageStaff: false };
  const manager = id === target.businessOwnerUserId || isJwStonePlatformManager(user);
  if (manager) return { target, allowed: true, canManageStaff: true };
  const result = await pool.query(`SELECT status, scopes, updated_at::text AS revision, (revoked_at IS NOT NULL) AS revoked,
      (expires_at IS NOT NULL AND expires_at <= NOW()) AS expired
    FROM stone_inventory_delegations
    WHERE holder_business_id = $1 AND delegate_user_id = $2 AND delegate_business_id IS NULL`, [target.businessId, id]);
  if (result.rows.length > 1) throw new JwStoneEmployeeAccessError("Employee access records need manager review.", 503);
  const row = result.rows[0];
  // An explicit revoked, expired, or limited grant overrides the server allowlist.
  const allowed = row ? row.status === "active" && row.revoked !== true && row.expired !== true && Array.isArray(row.scopes) &&
    JW_STONE_EMPLOYEE_SCOPES.every(scope => row.scopes.includes(scope)) : configured().includes(id);
  return { target, allowed, canManageStaff: false };
}
export async function jwStoneEmployeeTarget(user: unknown): Promise<StoneInventoryProfileTarget | null> {
  const access = await getJwStoneEmployeeAccess(user);
  return access.allowed ? access.target : null;
}
async function managerTarget(user: unknown): Promise<StoneInventoryProfileTarget> {
  const access = await getJwStoneEmployeeAccess(user);
  if (!access.canManageStaff || !access.target) throw new JwStoneEmployeeAccessError("Only the JW Stone business owner or a platform administrator can assign employee access.", 403);
  return access.target;
}
export async function listJwStoneEmployeeAccounts(user: unknown) {
  const target = await managerTarget(user);
  const result = await pool.query(`SELECT ${columns} FROM users u ${join}
    WHERE d.delegate_user_id IS NOT NULL OR u.id = ANY($2::text[]) OR u.id = $3
    ORDER BY lower(u.email), u.id LIMIT 501`, [target.businessId, configured(), target.businessOwnerUserId]);
  return { viewerId: jwStoneActorId(user), accounts: result.rows.slice(0, 500).map(row => accountView(row, target)), truncated: result.rows.length > 500 };
}
export async function findJwStoneEmployeeAccount(user: unknown, email: string) {
  const target = await managerTarget(user);
  const result = await pool.query(`SELECT ${columns} FROM users u ${join}
    WHERE lower(u.email) = $2 ORDER BY u.id LIMIT 2`, [target.businessId, email]);
  if (!result.rows.length) throw new JwStoneEmployeeAccessError("No account matches that email. Have the employee create their JW Stone sign-in first.", 404);
  if (result.rows.length !== 1) throw new JwStoneEmployeeAccessError("More than one account matches that email. Resolve the duplicate accounts before assigning access.", 409);
  return { viewerId: jwStoneActorId(user), account: accountView(result.rows[0], target) };
}
export async function setJwStoneEmployeeAccess(user: unknown, change: JwStoneEmployeeAccessChange) {
  const target = await managerTarget(user);
  const actorId = jwStoneActorId(user);
  const client = await pool.connect();
  let transaction = false;
  let destroyConnection = false;
  try {
    await client.query("BEGIN"); transaction = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    // The lock is transaction-scoped: it is released on either commit or rollback.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [`jw-stone-staff:${target.businessId}`, change.userId]);
    const found = await client.query(`SELECT ${columns} FROM users u ${join}
      WHERE u.id = $2 FOR UPDATE OF u`, [target.businessId, change.userId]);
    if (found.rows.length !== 1) throw new JwStoneEmployeeAccessError("That account no longer exists. Look it up again.", 404);
    const previous = accountView(found.rows[0], target);
    if (previous.source === "owner" || previous.source === "platform_admin") {
      throw new JwStoneEmployeeAccessError("Owner and platform-administrator access is managed through their existing roles, not the employee list.", 409);
    }
    if (previous.revision !== change.expectedRevision) throw new JwStoneEmployeeAccessError("This account's permissions changed. Refresh or look up the account again before saving.", 409);
    const scopes = change.allowed ? [...JW_STONE_EMPLOYEE_SCOPES] : [];
    const status = change.allowed ? "active" : "revoked";
    const updated = await client.query(`INSERT INTO stone_inventory_delegations
      (holder_business_id, delegate_user_id, scopes, status, granted_by_user_id, expires_at, revoked_at, updated_at)
      VALUES ($1, $2, $3::text[], $4, $5, NULL, CASE WHEN $4 = 'revoked' THEN NOW() ELSE NULL END, clock_timestamp())
      ON CONFLICT (holder_business_id, delegate_user_id) WHERE delegate_user_id IS NOT NULL
      DO UPDATE SET scopes = EXCLUDED.scopes, status = EXCLUDED.status,
        granted_by_user_id = CASE WHEN EXCLUDED.status = 'active' THEN EXCLUDED.granted_by_user_id ELSE stone_inventory_delegations.granted_by_user_id END,
        expires_at = NULL, revoked_at = EXCLUDED.revoked_at, updated_at = clock_timestamp()
      WHERE stone_inventory_delegations.updated_at::text = $6
      RETURNING updated_at::text AS revision`, [target.businessId, change.userId, scopes, status, actorId, change.expectedRevision]);
    if (updated.rows.length !== 1) throw new JwStoneEmployeeAccessError("This account's permissions changed. Refresh and try again.", 409);
    // Auditing is part of the same transaction. No audit record means no grant.
    await client.query(`INSERT INTO admin_audit_log (type, admin_id, target_user_id, metadata)
      VALUES ($1, $2, $3, $4::jsonb)`, [change.allowed ? "jw_stone_employee_access_granted" : "jw_stone_employee_access_revoked", actorId, change.userId,
      JSON.stringify({ profileSlug: "jw-stone", businessId: target.businessId, previous, allowed: change.allowed, scopes, revision: updated.rows[0].revision })]);
    await client.query("COMMIT"); transaction = false;
    return { viewerId: actorId, account: { ...previous, allowed: change.allowed, source: "manual" as const, expired: false, revision: String(updated.rows[0].revision) } };
  } catch (error: any) {
    if (error?.code === "55P03" || error?.code === "40P01") throw new JwStoneEmployeeAccessError("Another access update is in progress. Refresh and try again.", 409);
    throw error;
  } finally {
    if (transaction) { try { await client.query("ROLLBACK"); } catch { destroyConnection = true; } }
    client.release(destroyConnection);
  }
}
