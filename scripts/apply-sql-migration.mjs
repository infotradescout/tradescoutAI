import fs from "node:fs/promises";
import path from "node:path";
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

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL or TEST_DATABASE_URL must be set");
  }

  const inputPath = process.argv[2];
  const migrationPath = resolveMigrationPath(inputPath);
  const sql = await fs.readFile(migrationPath, "utf8");

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log(`[db:apply:sql] Applied migration: ${path.relative(process.cwd(), migrationPath)}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(
    "[db:apply:sql] Failed:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
