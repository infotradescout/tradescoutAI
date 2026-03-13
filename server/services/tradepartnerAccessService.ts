import { pool } from "../db";

let ensurePromise: Promise<void> | null = null;

export async function ensureTradepartnerUserEntitlementsTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS tradepartner_user_entitlements (
          id bigserial PRIMARY KEY,
          partner_slug text NOT NULL,
          user_id varchar NOT NULL,
          access_scope text NOT NULL DEFAULT 'market_signals',
          access_level text NOT NULL DEFAULT 'member',
          status text NOT NULL DEFAULT 'active',
          created_by_user_id varchar,
          notes text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_tradepartner_user_entitlements_unique
         ON tradepartner_user_entitlements (partner_slug, user_id, access_scope);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_tradepartner_user_entitlements_partner
         ON tradepartner_user_entitlements (partner_slug, status);`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_tradepartner_user_entitlements_user
         ON tradepartner_user_entitlements (user_id, status);`
      );
    })();
  }

  await ensurePromise;
}

export async function getTradepartnerUserEntitlement(args: {
  partnerSlug: string;
  userId: string;
  accessScope?: string;
}) {
  await ensureTradepartnerUserEntitlementsTable();

  const partnerSlug = String(args.partnerSlug || "")
    .trim()
    .toLowerCase();
  const userId = String(args.userId || "").trim();
  const accessScope = String(args.accessScope || "market_signals")
    .trim()
    .toLowerCase();

  if (!partnerSlug || !userId) return null;

  const result = await pool.query(
    `
      select
        partner_slug,
        user_id,
        access_scope,
        access_level,
        status
      from tradepartner_user_entitlements
      where partner_slug = $1
        and user_id = $2
        and access_scope = $3
        and status = 'active'
      limit 1
    `,
    [partnerSlug, userId, accessScope]
  );

  const row = result.rows?.[0];
  if (!row) return null;

  return {
    partnerSlug: String(row.partner_slug || ""),
    userId: String(row.user_id || ""),
    accessScope: String(row.access_scope || ""),
    accessLevel: String(row.access_level || "member"),
    status: String(row.status || "active"),
  };
}
