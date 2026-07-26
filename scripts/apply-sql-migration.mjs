import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Client } = pg;

function resolveMigrationPath(inputPath) {
  if (!inputPath || !inputPath.trim()) {
    throw new Error(
      "Missing migration file path. Usage: node scripts/apply-sql-migration.mjs migrations/0046_tool_discovery_tables.sql"
    );
  }

  return path.resolve(process.cwd(), inputPath);
}

export function buildCommittedMigrationRecord({ migrationPath, sql, journal }) {
  const tag = path.basename(migrationPath, ".sql");
  const entries = Array.isArray(journal?.entries) ? journal.entries : [];
  const entry = entries.find((candidate) => candidate?.tag === tag);
  if (!entry || !Number.isFinite(Number(entry.when))) {
    throw new Error(`Migration ${tag} is not recorded in migrations/meta/_journal.json`);
  }
  return {
    tag,
    hash: crypto.createHash("sha256").update(sql).digest("hex"),
    createdAt: Number(entry.when),
  };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL or TEST_DATABASE_URL must be set");
  }

  const inputPath = process.argv[2];
  const migrationPath = resolveMigrationPath(inputPath);
  const sql = await fs.readFile(migrationPath, "utf8");
  const recordDrizzle = process.argv.slice(3).includes("--record-drizzle");
  let committedRecord = null;
  if (recordDrizzle) {
    const migrationsFolder = path.resolve(process.cwd(), "migrations");
    const relativePath = path.relative(migrationsFolder, migrationPath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error("--record-drizzle only accepts a committed file inside migrations/");
    }
    const journal = JSON.parse(
      await fs.readFile(path.join(migrationsFolder, "meta", "_journal.json"), "utf8")
    );
    committedRecord = buildCommittedMigrationRecord({ migrationPath, sql, journal });
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    if (committedRecord) {
      const ledger = await client.query(
        "select to_regclass('drizzle.__drizzle_migrations') is not null as present"
      );
      if (!ledger.rows?.[0]?.present) {
        throw new Error("drizzle.__drizzle_migrations does not exist; refusing to invent a ledger");
      }
      await client.query(
        `
          insert into drizzle.__drizzle_migrations (hash, created_at)
          select $1, $2
          where not exists (
            select 1 from drizzle.__drizzle_migrations where hash = $1
          )
        `,
        [committedRecord.hash, committedRecord.createdAt]
      );
    }
    await client.query("COMMIT");
    console.log(
      `[db:apply:sql] Applied migration: ${path.relative(process.cwd(), migrationPath)}` +
        (committedRecord ? ` and reconciled Drizzle record ${committedRecord.tag}` : "")
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(
      "[db:apply:sql] Failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  });
}
