import { pool } from "../db";
import { ensureProfileAccountTables } from "./profileAccountService";

const PROFILE_ACCOUNT_ENTITLEMENT_DDL = `
CREATE TABLE IF NOT EXISTS profile_account_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_account_id UUID NOT NULL REFERENCES profile_accounts(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_verification',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_account_id, product_key),
  CHECK (product_key ~ '^[a-z0-9_]{2,80}$'),
  CHECK (status IN ('pending_verification', 'active', 'suspended', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_profile_account_entitlements_product_status
  ON profile_account_entitlements(product_key, status, updated_at DESC);
`;

let ensurePromise: Promise<void> | null = null;

export async function ensureProfileAccountEntitlementTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await ensureProfileAccountTables();
      await pool.query(PROFILE_ACCOUNT_ENTITLEMENT_DDL);
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

export type ProfileAccountEntitlement = Readonly<{
  productKey: string;
  status: "pending_verification" | "active" | "suspended" | "revoked";
}>;

export async function ensureProfileAccountEntitlement(args: {
  profileAccountId: string;
  productKey: string;
  verificationStatus: "not_required" | "pending" | "approved" | "rejected";
}): Promise<ProfileAccountEntitlement> {
  await ensureProfileAccountEntitlementTables();
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
  await ensureProfileAccountEntitlementTables();
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
