import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pool } from "./db";

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
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".sql"))
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
  await pool.query("insert into drizzle.__drizzle_migrations (hash, created_at) values ($1,$2)", [
    hash,
    createdAt,
  ]);
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
      throw err;
    } finally {
      client.release();
    }
  }

  log(`[RuntimeMigrations] Done. Applied ${applied} migration(s).`);
}
