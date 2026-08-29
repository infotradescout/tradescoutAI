import dotenv from "dotenv";
import pg from "pg";
import { runCommand } from "./lib/subprocess.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  allowExplicitInsecureTestDatabase,
  securePostgresConnectionString,
} from "../shared/database-url-security.mjs";

dotenv.config();

const { Client } = pg;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

function baselineEntrypoint() {
  const bundled = path.join(scriptDirectory, "db-baseline-drizzle.mjs");
  return fs.existsSync(bundled)
    ? bundled
    : path.resolve(process.cwd(), "scripts/db-baseline-drizzle.mjs");
}

function run(commandLine, options = {}) {
  const parts = String(commandLine || "").trim().split(/\s+/).filter(Boolean);
  const cmd = parts[0];
  const args = parts.slice(1);
  return runCommand(cmd, args, { stdio: "inherit", ...options });
}

function drizzleMigrationCommand() {
  const productionConfig = path.resolve(process.cwd(), "runtime/drizzle.config.mjs");
  const config =
    process.env.NODE_ENV === "production" && fs.existsSync(productionConfig)
      ? "runtime/drizzle.config.mjs"
      : "drizzle.config.ts";
  return `npx drizzle-kit migrate --config=${config}`;
}

async function migrationCount() {
  const rawDbUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  const dbUrl = securePostgresConnectionString(rawDbUrl, {
    allowInsecureTestConnection: allowExplicitInsecureTestDatabase(process.env),
  });
  if (!dbUrl) return null;

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query("create schema if not exists drizzle");
    await client.query(`
      create table if not exists drizzle.__drizzle_migrations (
        id serial primary key,
        hash text not null,
        created_at bigint
      )
    `);
    const result = await client.query(
      "select count(*)::int as count from drizzle.__drizzle_migrations"
    );
    return Number(result.rows?.[0]?.count ?? 0);
  } finally {
    await client.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const autoRepair = !args.includes("--no-repair");

  const first = await run(drizzleMigrationCommand());
  if (first === 0) {
    process.exit(0);
  }

  if (!autoRepair) {
    process.exit(first);
  }

  const count = await migrationCount();
  if (count !== 0) {
    console.error(
      `[db:migrate] Failed and auto-repair is skipped because drizzle.__drizzle_migrations has ${count} row(s).`
    );
    console.error(
      `[db:migrate] If a later journal tag is already in the ledger while earlier tags are missing (watermark trap), normal migrate will not fill gaps. Recovery: npm run db:migrate:fill-gaps (see docs/runbooks/DB_MIGRATE_FILL_GAPS.md).`
    );
    process.exit(first);
  }

  console.warn(
    "[db:migrate] Initial migrate failed with empty migration history. Attempting baseline + retry..."
  );

  const baseline = await run(`node ${baselineEntrypoint()}`);
  if (baseline !== 0) {
    console.error("[db:migrate] Baseline failed. Migration not retried.");
    process.exit(first);
  }

  const retry = await run(drizzleMigrationCommand());
  process.exit(retry);
}

main().catch((err) => {
  console.error("[db:migrate] Unexpected failure:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
