import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Client } = pg;
export const REQUIRED_MIGRATION_PATH = path.resolve(
  process.cwd(),
  "migrations/0072_seo_publication_rules_and_freshness.sql"
);
export const REQUIRED_MIGRATION_HASH = crypto
  .createHash("sha256")
  .update(fs.readFileSync(REQUIRED_MIGRATION_PATH, "utf8"))
  .digest("hex");

export function evaluateRequiredProductionSchema(check) {
  const missing = [];
  if (!check.migrationLedger) {
    missing.push("drizzle.__drizzle_migrations");
  } else if (!check.migrationRecorded) {
    missing.push("drizzle.__drizzle_migrations[0072 canonical hash]");
  }
  if (!check.publicationRules) missing.push("ts_publication_rules");
  if (!check.seoPruneLog) missing.push("ts_seo_prune_log");
  if (!check.publicActivity) missing.push("ts_public_activity");
  if (!check.publicDiscoveryEnabled) missing.push("businesses.public_discovery_enabled");
  if (check.publicationRules && !check.defaultPublicationRule) {
    missing.push("ts_publication_rules[id=default]");
  }
  return missing;
}

export async function verifyRequiredProductionSchema(client) {
  const schemaResult = await client.query(`
    select
      to_regclass('public.ts_publication_rules') is not null as publication_rules,
      to_regclass('public.ts_seo_prune_log') is not null as seo_prune_log,
      to_regclass('public.ts_public_activity') is not null as public_activity,
      to_regclass('drizzle.__drizzle_migrations') is not null as migration_ledger,
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'businesses'
          and column_name = 'public_discovery_enabled'
      ) as public_discovery_enabled
  `);
  const row = schemaResult.rows?.[0] || {};
  const check = {
    publicationRules: Boolean(row.publication_rules),
    seoPruneLog: Boolean(row.seo_prune_log),
    publicActivity: Boolean(row.public_activity),
    publicDiscoveryEnabled: Boolean(row.public_discovery_enabled),
    migrationLedger: Boolean(row.migration_ledger),
    migrationRecorded: false,
    defaultPublicationRule: false,
  };

  if (check.migrationLedger) {
    const migrationResult = await client.query(
      "select exists (select 1 from drizzle.__drizzle_migrations where hash = $1) as present",
      [REQUIRED_MIGRATION_HASH]
    );
    check.migrationRecorded = Boolean(migrationResult.rows?.[0]?.present);
  }

  if (check.publicationRules) {
    const rulesResult = await client.query(
      "select exists (select 1 from ts_publication_rules where id = 'default') as present"
    );
    check.defaultPublicationRule = Boolean(rulesResult.rows?.[0]?.present);
  }

  const missing = evaluateRequiredProductionSchema(check);
  if (missing.length > 0) {
    throw new Error(
      [
        `Required production schema is missing: ${missing.join(", ")}`,
        "Recover by applying and recording the committed canonical migration",
        "migrations/0072_seo_publication_rules_and_freshness.sql before deployment.",
      ].join(" ")
    );
  }

  return check;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL must be set");

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const result = await verifyRequiredProductionSchema(client);
    await client.query("ROLLBACK");
    console.log("[db:verify:required] Required production schema is present", result);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The original verification error is more actionable.
    }
    throw error;
  } finally {
    await client.end();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(
      "[db:verify:required] Failed:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  });
}
