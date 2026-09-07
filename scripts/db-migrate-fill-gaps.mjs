/**
 * Apply reviewed Drizzle journal gaps by LF/CRLF-compatible hash, not watermark.
 * --dry-run is read-only. Duplicate objects are failures, never proof of a
 * complete migration. Replaying 0115 requires its canonical 0118 successor.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { verifyRequiredProductionSchema } from "./check-required-production-schema.mjs";
import { DATABASE_RECOVERY_GUIDANCE } from "./lib/verified-migration-runner.mjs";
import {
  allowExplicitInsecureTestDatabase,
  securePostgresConnectionString,
} from "../shared/database-url-security.mjs";

dotenv.config();
const dryRun = process.argv.includes("--dry-run");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
function migrationHashes(sqlText) {
  const lf = String(sqlText).replace(/\r\n?/g, "\n");
  return [...new Set([sha256(sqlText), sha256(lf), sha256(lf.replace(/\n/g, "\r\n"))])];
}

async function main() {
  const unknown = process.argv.slice(2).filter((arg) => arg !== "--dry-run");
  if (unknown.length) {
    throw new Error("Unsupported recovery flag. --mark-already-applied is unsafe: one duplicate object does not prove that every statement executed. No connection or ledger change was made.");
  }
  const dbUrl = securePostgresConnectionString(
    process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL,
    { allowInsecureTestConnection: allowExplicitInsecureTestDatabase(process.env) }
  );
  if (!dbUrl) throw new Error("DATABASE_URL or TEST_DATABASE_URL required");
  const journal = JSON.parse(fs.readFileSync("migrations/meta/_journal.json", "utf8"));
  const entries = Array.isArray(journal.entries) ? journal.entries : [];
  if (!entries.length) throw new Error("Migration journal is empty");
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  let readOnly = false;
  let locked = false;
  try {
    if (dryRun) {
      await client.query("BEGIN READ ONLY");
      readOnly = true;
    } else {
      await client.query("select pg_advisory_lock(hashtext('tradescout_migration_gap_recovery'))");
      locked = true;
      await client.query("create schema if not exists drizzle");
      await client.query("create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)");
    }
    const ledger = await client.query("select to_regclass('drizzle.__drizzle_migrations') is not null as present");
    const existing = ledger.rows[0].present
      ? await client.query("select id, hash, created_at from drizzle.__drizzle_migrations")
      : { rows: [] };
    const existingHashes = new Set(existing.rows.map((row) => row.hash));
    const applied = [], replayed = [], skipped = [], failed = [];
    let predecessorApplied = false;
    console.log(JSON.stringify({ phase: "start", dryRun, beforeCount: existing.rows.length, journalCount: entries.length }));

    for (const entry of entries) {
      const sqlPath = path.join("migrations", `${entry.tag}.sql`);
      if (!fs.existsSync(sqlPath) || !Number.isFinite(Number(entry.when))) {
        failed.push({ tag: entry.tag, error: "Missing SQL file or invalid journal timestamp" });
        break;
      }
      const sqlText = fs.readFileSync(sqlPath, "utf8");
      const recorded = migrationHashes(sqlText).some((hash) => existingHashes.has(hash));
      const successorReplay = predecessorApplied && entry.tag === "0118_profile_account_public_routes";
      if (recorded && !successorReplay) {
        skipped.push(entry.tag);
        continue;
      }
      const hash = sha256(sqlText.replace(/\r\n?/g, "\n"));
      const statements = sqlText.split(/-->\s*statement-breakpoint\s*/g).map((sql) => sql.trim()).filter(Boolean);
      if (dryRun) {
        (recorded ? replayed : applied).push({ tag: entry.tag, statements: statements.length });
        if (entry.tag === "0115_profile_accounts") predecessorApplied = true;
        continue;
      }
      try {
        await client.query("BEGIN");
        for (const statement of statements) await client.query(statement);
        if (!recorded) {
          await client.query("insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)", [hash, Number(entry.when)]);
        }
        await client.query("COMMIT");
        existingHashes.add(hash);
        (recorded ? replayed : applied).push({ tag: entry.tag, statements: statements.length });
        if (entry.tag === "0115_profile_accounts") predecessorApplied = true;
        console.log(`[${recorded ? "replayed-successor" : "applied"}] ${entry.tag}`);
      } catch (error) {
        await client.query("ROLLBACK");
        failed.push({ tag: entry.tag, error: (error instanceof Error ? error.message : String(error)).split("\n")[0] });
        break;
      }
    }
    let schemaVerified = false;
    if (!dryRun && failed.length === 0) {
      await client.query("BEGIN READ ONLY");
      try {
        await client.query("SET LOCAL statement_timeout = '15s'");
        await verifyRequiredProductionSchema(client);
        schemaVerified = true;
      } catch (error) {
        failed.push({ tag: "required-schema", error: error instanceof Error ? error.message : String(error) });
      } finally {
        await client.query("ROLLBACK");
      }
    }
    console.log(JSON.stringify({
      phase: "done", dryRun, schemaVerified,
      beforeCount: existing.rows.length,
      appliedSqlCount: applied.length, replayedSuccessorCount: replayed.length,
      markedAlreadyAppliedCount: 0, skippedCount: skipped.length,
      applied, replayed, failed,
    }, null, 2));
    if (failed.length) {
      console.error(DATABASE_RECOVERY_GUIDANCE);
      process.exitCode = 1;
    } else if (dryRun) {
      console.log("[db:migrate:fill-gaps] Read-only plan only. No SQL applied, no history recorded, and no compatibility claim.");
    }
  } finally {
    if (readOnly) await client.query("ROLLBACK").catch(() => {});
    if (locked) await client.query("select pg_advisory_unlock(hashtext('tradescout_migration_gap_recovery'))").catch(() => {});
    await client.end();
  }
}

main().catch((error) => {
  console.error("[db:migrate:fill-gaps] Failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
