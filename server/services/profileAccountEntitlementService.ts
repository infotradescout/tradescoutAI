import { pool } from "../db";

export type ProfileAccountEntitlement = Readonly<{
  productKey: string;
  status: "pending_verification" | "active" | "suspended" | "revoked";
}>;

export async function ensureProfileAccountEntitlement(args: {
  profileAccountId: string;
  productKey: string;
  verificationStatus: "not_required" | "pending" | "approved" | "rejected";
}): Promise<ProfileAccountEntitlement> {
  const productKey = String(args.productKey || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9_]{2,80}$/.test(productKey)) throw new Error("Invalid product entitlement");
  const nextStatus =
    args.verificationStatus === "approved"
      ? "active"
      : args.verificationStatus === "rejected"
        ? "revoked"
        : "pending_verification";
  const result = await pool.query(
    `INSERT INTO profile_account_entitlements (
       profile_account_id,
       product_key,
       status,
       created_at,
       updated_at
     ) VALUES ($1::uuid, $2, $3, NOW(), NOW())
     ON CONFLICT (profile_account_id, product_key) DO UPDATE SET
       status = CASE
         WHEN profile_account_entitlements.status = 'suspended' THEN 'suspended'
         ELSE EXCLUDED.status
       END,
       updated_at = NOW()
     RETURNING product_key, status`,
    [args.profileAccountId, productKey, nextStatus]
  );
  return Object.freeze({
    productKey: String(result.rows[0].product_key),
    status: String(result.rows[0].status) as ProfileAccountEntitlement["status"],
  });
}

export async function listProfileAccountEntitlements(
  profileAccountId: string
): Promise<readonly ProfileAccountEntitlement[]> {
  const result = await pool.query(
    `SELECT product_key, status
       FROM profile_account_entitlements
      WHERE profile_account_id = $1::uuid
      ORDER BY product_key ASC`,
    [profileAccountId]
  );
  return Object.freeze(
    result.rows.map((row) =>
      Object.freeze({
        productKey: String(row.product_key),
        status: String(row.status) as ProfileAccountEntitlement["status"],
      })
    )
  );
}
