import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pool } from "./db";

const RUNTIME_MIGRATION_FILENAME_PATTERN = /^\d{4}.*\.sql$/i;

type MigrationFile = {
  filename: string;
  fullPath: string;
  sql: string;
  hash: string;
};

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function getRepoRoot(): string {
  // Runtime containers run with WORKDIR=/app (see Dockerfile). In dev, process.cwd() is repo root.
  return process.cwd();
}

function loadSqlMigrations(migrationsDir: string): MigrationFile[] {
  if (!fs.existsSync(migrationsDir)) return [];

  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  const sqlFiles = entries
    // Only treat numeric-prefixed files as runtime migrations (e.g. 0000_foo.sql).
    // Helper scripts like "_all_neon_setup.sql" are intentionally excluded.
    .filter((e) => e.isFile() && RUNTIME_MIGRATION_FILENAME_PATTERN.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  const migrations: MigrationFile[] = [];
  for (const filename of sqlFiles) {
    const fullPath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(fullPath, "utf8");
    const hash = sha256(sql);
    migrations.push({ filename, fullPath, sql, hash });
  }
  return migrations;
}

async function ensureDrizzleMigrationsTable() {
  await pool.query("create schema if not exists drizzle");
  await pool.query(`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `);
}

async function hasMigration(hash: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    "select exists(select 1 from drizzle.__drizzle_migrations where hash = $1) as exists",
    [hash]
  );
  return Boolean(result.rows?.[0]?.exists);
}

async function recordMigration(hash: string) {
  const createdAt = Date.now();
  await pool.query(
    `
      insert into drizzle.__drizzle_migrations (hash, created_at)
      select $1, $2
      where not exists (
        select 1 from drizzle.__drizzle_migrations where hash = $1
      )
    `,
    [hash, createdAt]
  );
}

const DUPLICATE_SCHEMA_ERROR_CODES = new Set([
  // type/schema/constraint already exists
  "42710", // duplicate_object
  "42P06", // duplicate_schema
  "42723", // duplicate_function
  // table/index already exists ("relation already exists")
  "42P07", // duplicate_table
  // column already exists
  "42701", // duplicate_column
]);

function migrationContainsDml(sql: string): boolean {
  return /\b(insert|update|delete|truncate)\b/i.test(sql);
}

async function schemaLooksInitialized(): Promise<boolean> {
  const result = await pool.query<{
    users_reg: string | null;
    conversations_reg: string | null;
  }>(
    `select to_regclass('public.users') as users_reg, to_regclass('public.conversations') as conversations_reg`
  );
  const row = result.rows?.[0];
  return Boolean(row?.users_reg) && Boolean(row?.conversations_reg);
}

export async function runRuntimeMigrations(options?: { log?: (msg: string) => void }) {
  const log = options?.log ?? ((msg: string) => console.log(msg));
  const root = getRepoRoot();
  const migrationsDir = path.join(root, "migrations");
  const migrations = loadSqlMigrations(migrationsDir);

  if (migrations.length === 0) {
    log(`[RuntimeMigrations] No migrations found at ${migrationsDir}; skipping.`);
    return;
  }

  await ensureDrizzleMigrationsTable();

  let applied = 0;
  let adopted = 0;
  for (const migration of migrations) {
    const already = await hasMigration(migration.hash);
    if (already) continue;

    log(`[RuntimeMigrations] Applying ${migration.filename}...`);
    const client = await pool.connect();
    try {
      await client.query("begin");
      // Execute the full migration file as-is so dollar-quoted blocks (DO $$ ... $$) work reliably.
      await client.query(migration.sql);
      await client.query("commit");
      await recordMigration(migration.hash);
      applied += 1;
    } catch (err) {
      try {
        await client.query("rollback");
      } catch {
        // ignore rollback failures
      }

      const code = (err as any)?.code;
      const canAdopt =
        typeof code === "string" &&
        DUPLICATE_SCHEMA_ERROR_CODES.has(code) &&
        !migrationContainsDml(migration.sql);

      if (canAdopt) {
        try {
          if (await schemaLooksInitialized()) {
            log(
              `[RuntimeMigrations] ${migration.filename} appears already applied (code ${code}); recording and continuing.`
            );
            await recordMigration(migration.hash);
            adopted += 1;
            continue;
          }
        } catch {
          // If we can't confirm initialization, fall through to throw.
        }
      }

      throw err;
    } finally {
      client.release();
    }
  }

  log(
    `[RuntimeMigrations] Done. Applied ${applied} migration(s), adopted ${adopted} migration(s).`
  );
}
