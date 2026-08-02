import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pool } from "./db";
import { classifyMigrationHashDisposition } from "./runtimeMigrationPolicy";

const RUNTIME_MIGRATION_FILENAME_PATTERN = /^\d{4}.*\.sql$/i;

type MigrationFile = {
  filename: string;
  fullPath: string;
  sql: string;
  hash: string;
  predecessorHashes: string[];
};

type MigrationHashAliases = Record<string, string[]>;

type RecordedMigration = {
  hash: string;
  createdAt: number | null;
};

export class HistoricalMigrationReplayRefusedError extends Error {
  constructor(filename: string) {
    super(
      `[RuntimeMigrations] Refusing to replay repaired historical migration ${filename}: no current or recorded predecessor hash was found.`
    );
    this.name = "HistoricalMigrationReplayRefusedError";
  }
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function functionExists(name: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `select exists(select 1 from pg_proc where proname = $1) as exists`,
    [name]
  );
  return Boolean(result.rows?.[0]?.exists);
}

async function ensureGenRandomUuid(): Promise<void> {
  // Several migrations use gen_random_uuid(). In some hosted Postgres environments, pgcrypto may not
  // be installed yet. Best-effort: enable pgcrypto, fall back to uuid-ossp, or create a shim.
  try {
    if (await functionExists("gen_random_uuid")) return;

    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    } catch {
      // ignore
    }
    if (await functionExists("gen_random_uuid")) return;

    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    } catch {
      // ignore
    }

    const hasUuidOssp = await functionExists("uuid_generate_v4");
    if (!hasUuidOssp) return;

    // Shim: provide gen_random_uuid() using uuid-ossp so id defaults in migrations work.
    await pool.query(`
      CREATE OR REPLACE FUNCTION gen_random_uuid()
      RETURNS uuid
      LANGUAGE sql
      AS $$ SELECT uuid_generate_v4(); $$;
    `);
  } catch (err) {
    console.error("[RuntimeMigrations] Failed ensuring gen_random_uuid (non-fatal):", err);
  }
}

function getRepoRoot(): string {
  // Runtime containers run with WORKDIR=/app (see Dockerfile). In dev, process.cwd() is repo root.
  return process.cwd();
}

function loadMigrationHashAliases(migrationsDir: string): MigrationHashAliases {
  const aliasesPath = path.join(migrationsDir, "meta", "_hash_aliases.json");
  if (!fs.existsSync(aliasesPath)) return {};

  const parsed = JSON.parse(fs.readFileSync(aliasesPath, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid migration hash aliases file: ${aliasesPath}`);
  }

  const aliases: MigrationHashAliases = {};
  for (const [filename, values] of Object.entries(parsed)) {
    if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
      throw new Error(`Invalid predecessor hashes for migration ${filename}`);
    }
    aliases[filename] = [...new Set(values)];
  }
  return aliases;
}

function loadSqlMigrations(migrationsDir: string): MigrationFile[] {
  if (!fs.existsSync(migrationsDir)) return [];

  const hashAliases = loadMigrationHashAliases(migrationsDir);

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
    const predecessorHashes = hashAliases[filename] ?? [];
    migrations.push({ filename, fullPath, sql, hash, predecessorHashes });
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

async function migrationLedgerCount(): Promise<number> {
  const result = await pool.query<{ count: number }>(
    "select count(*)::int as count from drizzle.__drizzle_migrations"
  );
  return Number(result.rows?.[0]?.count ?? 0);
}

async function findRecordedMigration(hashes: string[]): Promise<RecordedMigration | null> {
  const result = await pool.query<{ hash: string; created_at: string | number | null }>(
    `select hash, created_at
     from drizzle.__drizzle_migrations
     where hash = any($1::text[])
     order by case when hash = $2 then 0 else 1 end
     limit 1`,
    [hashes, hashes[0]]
  );
  const row = result.rows?.[0];
  if (!row) return null;
  const createdAt = row.created_at == null ? null : Number(row.created_at);
  return {
    hash: row.hash,
    createdAt: Number.isFinite(createdAt) ? createdAt : null,
  };
}

async function recordMigration(hash: string, createdAt = Date.now()) {
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
  // Only treat statement-leading DML as mutating data.
  // This avoids false positives from FK clauses like "ON DELETE/ON UPDATE".
  return /(^|;\s*)(insert|update|delete|truncate)\s+/im.test(sql);
}

function requiresNonTransactionalExecution(sql: string): boolean {
  return /\b(create|drop)\s+(unique\s+)?index\s+concurrently\b/i.test(sql);
}

async function schemaLooksInitialized(): Promise<boolean> {
  const result = await pool.query<{
    users_reg: string | null;
    conversations_reg: string | null;
    marketplace_conversations_reg: string | null;
    address_verifications_reg: string | null;
    work_requests_reg: string | null;
    address_verification_status_type: string | null;
  }>(
    `select
      to_regclass('public.users') as users_reg,
      to_regclass('public.conversations') as conversations_reg,
      to_regclass('public.marketplace_conversations') as marketplace_conversations_reg,
      to_regclass('public.address_verifications') as address_verifications_reg,
      to_regclass('public.work_requests') as work_requests_reg,
      to_regtype('public.address_verification_status')::text as address_verification_status_type`
  );
  const row = result.rows?.[0];
  const hasLegacyBaseSchema =
    Boolean(row?.users_reg) &&
    (Boolean(row?.address_verifications_reg) ||
      Boolean(row?.work_requests_reg) ||
      Boolean(row?.address_verification_status_type));
  return (
    hasLegacyBaseSchema ||
    (Boolean(row?.users_reg) &&
      (Boolean(row?.marketplace_conversations_reg) || Boolean(row?.conversations_reg)))
  );
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

  await ensureGenRandomUuid();
  await ensureDrizzleMigrationsTable();
  const preexistingDatabase =
    (await migrationLedgerCount()) > 0 || (await schemaLooksInitialized());

  let applied = 0;
  let adopted = 0;
  for (const migration of migrations) {
    const recordedMigration = await findRecordedMigration([
      migration.hash,
      ...migration.predecessorHashes,
    ]);
    const disposition = classifyMigrationHashDisposition({
      currentHash: migration.hash,
      predecessorHashes: migration.predecessorHashes,
      recordedHash: recordedMigration?.hash ?? null,
      preexistingDatabase,
    });
    if (disposition === "current") continue;
    if (disposition === "adopt") {
      log(
        `[RuntimeMigrations] ${migration.filename} has a recorded predecessor hash; adopting the repaired hash without replaying historical SQL.`
      );
      await recordMigration(migration.hash, recordedMigration?.createdAt ?? Date.now());
      adopted += 1;
      continue;
    }

    if (disposition === "refuse") {
      throw new HistoricalMigrationReplayRefusedError(migration.filename);
    }

    log(`[RuntimeMigrations] Applying ${migration.filename}...`);
    const client = await pool.connect();
    try {
      if (requiresNonTransactionalExecution(migration.sql)) {
        log(
          `[RuntimeMigrations] ${migration.filename} requires non-transactional execution; applying outside BEGIN/COMMIT.`
        );
        await client.query(migration.sql);
      } else {
        await client.query("begin");
        // Execute the full migration file as-is so dollar-quoted blocks (DO $$ ... $$) work reliably.
        await client.query(migration.sql);
        await client.query("commit");
      }
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
