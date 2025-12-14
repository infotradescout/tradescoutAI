import { pool } from "./db";

function toSqlIdentifier(value: string) {
  // defensive: identifiers are hard-coded from system catalogs only
  return value.replace(/[^a-zA-Z0-9_]/g, "");
}

async function getColumnTypeSql(tableName: string, columnName: string): Promise<string | null> {
  const result = await pool.query<{
    data_type: string;
    udt_name: string;
  }>(
    `
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1
    `,
    [tableName, columnName]
  );

  const row = result.rows[0];
  if (!row) return null;

  // Prefer UDT for enums/uuid
  const udt = (row.udt_name || "").toLowerCase();
  const dt = (row.data_type || "").toLowerCase();

  if (udt === "uuid" || dt === "uuid") return "uuid";
  if (udt === "varchar" || dt.includes("character varying")) return "varchar";
  if (udt === "text" || dt === "text") return "text";
  if (dt.includes("timestamp")) return "timestamp";

  // fallback to the raw UDT (sanitized) for other compatible types
  return toSqlIdentifier(udt) || null;
}

async function typeExists(typeName: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = $1) as exists`,
    [typeName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function functionExists(functionName: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = $1) as exists`,
    [functionName]
  );
  return Boolean(result.rows[0]?.exists);
}

export async function ensureProfilesTable(): Promise<void> {
  // This app relies on the `profiles` table (public-facing profile pages).
  // Production may not have run migrations, so we fail-safe by creating it if missing.
  try {
    const reg = await pool.query<{ reg: string | null }>(
      `SELECT to_regclass('public.profiles') as reg`
    );
    if (reg.rows[0]?.reg) return;

    // gen_random_uuid() requires pgcrypto. If this fails (restricted env), we still create the table
    // with app-provided IDs.
    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    } catch {
      // ignore
    }

    let uuidDefaultFn: string | null = null;
    if (await functionExists("gen_random_uuid")) {
      uuidDefaultFn = "gen_random_uuid()";
    } else {
      try {
        await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
      } catch {
        // ignore
      }
      if (await functionExists("uuid_generate_v4")) {
        uuidDefaultFn = "uuid_generate_v4()";
      }
    }

    // Match types to existing tables to avoid join/operator errors.
    const userIdType = (await getColumnTypeSql("users", "id")) ?? "varchar";
    const businessIdType = (await getColumnTypeSql("businesses", "id")) ?? "varchar";

    const hasUserRole = await typeExists("user_role");
    const hasProfileStatus = await typeExists("profile_status");

    const roleContextType = hasUserRole ? "user_role" : "text";
    const statusType = hasProfileStatus ? "profile_status" : "text";

    const idDefault = uuidDefaultFn ? `DEFAULT ${uuidDefaultFn}` : "";

    // Create profile_status only if missing, matching shared/schema.ts (draft|published)
    if (!hasProfileStatus) {
      await pool.query(`
        DO $$
        BEGIN
          CREATE TYPE profile_status AS ENUM ('draft', 'published');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id ${userIdType} PRIMARY KEY ${idDefault},
        owner_user_id ${userIdType} NOT NULL,
        business_id ${businessIdType},
        role_context ${roleContextType} NOT NULL,
        slug varchar NOT NULL UNIQUE,
        display_name varchar NOT NULL,
        headline varchar,
        content_blocks jsonb DEFAULT '[]'::jsonb,
        cta_config jsonb DEFAULT '{}'::jsonb,
        seo_meta jsonb DEFAULT '{}'::jsonb,
        status ${statusType} NOT NULL DEFAULT 'draft',
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        CONSTRAINT profiles_owner_user_id_fkey
          FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Add business FK only if the businesses table exists.
    const businessesReg = await pool.query<{ reg: string | null }>(
      `SELECT to_regclass('public.businesses') as reg`
    );
    if (businessesReg.rows[0]?.reg) {
      await pool.query(`
        DO $$
        BEGIN
          ALTER TABLE profiles
            ADD CONSTRAINT profiles_business_id_fkey
            FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }

    await pool.query(`CREATE INDEX IF NOT EXISTS profile_owner_idx ON profiles(owner_user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS profile_business_idx ON profiles(business_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS profile_role_ctx_idx ON profiles(role_context);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS profile_status_idx ON profiles(status);`);
  } catch (error) {
    console.error("[DB] Failed ensuring profiles table:", error);
  }
}
