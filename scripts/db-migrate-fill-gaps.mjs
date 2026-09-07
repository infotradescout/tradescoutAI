/**
 * Apply reviewed Drizzle journal gaps by LF/CRLF-compatible hash, not watermark.
 * --dry-run is read-only. Duplicate objects do not prove a complete migration.
 * Stop before replaying an older rule over an already recorded successor.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { verifyRequiredProductionSchema } from "./check-required-production-schema.mjs";
import { DATABASE_RECOVERY_GUIDANCE } from "./lib/verified-migration-runner.mjs";
import { completedPublicationPredecessorHashes } from "./lib/completed-publication-identities.mjs";
import { allowExplicitInsecureTestDatabase, securePostgresConnectionString } from "../shared/database-url-security.mjs";

dotenv.config();
const dryRun = process.argv.includes("--dry-run");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
function migrationHashes(sqlText) {
  const lf = String(sqlText).replace(/\r\n?/g, "\n");
  return [...new Set([sha256(sqlText), sha256(lf), sha256(lf.replace(/\n/g, "\r\n"))])];
}
const recordedSuccessors = new Map([
  ["0115_profile_accounts", ["0118_profile_account_public_routes", "0123_profile_accounts_and_entitlements", "0129_restore_profile_account_identity_contract", "0131_preserve_jw_stone_pricing_revocation"]],
  ["0117_managed_partner_intakes", ["0130_business_managed_partner_contact"]],
  ["0118_profile_account_public_routes", ["0131_preserve_jw_stone_pricing_revocation"]],
  ["0123_profile_accounts_and_entitlements", ["0129_restore_profile_account_identity_contract", "0131_preserve_jw_stone_pricing_revocation"]],
]);

async function main() {
  const unknown = process.argv.slice(2).filter((arg) => arg !== "--dry-run");
  if (unknown.length) {
    throw new Error("Unsupported recovery flag. --mark-already-applied is unsafe: one duplicate object does not prove that every statement executed. No connection or ledger change was made.");
  }
  const dbUrl = securePostgresConnectionString(process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL, {
    allowInsecureTestConnection: allowExplicitInsecureTestDatabase(process.env),
  });
  if (!dbUrl) throw new Error("DATABASE_URL or TEST_DATABASE_URL required");
  const journal = JSON.parse(fs.readFileSync("migrations/meta/_journal.json", "utf8"));
  const entries = Array.isArray(journal.entries) ? journal.entries : [];
  if (!entries.length) throw new Error("Migration journal is empty");
  // Validate every file before changing any database object.
  const migrations = entries.map((entry) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(entry.tag) || !Number.isFinite(Number(entry.when))) throw new Error("Invalid migration journal entry");
    const filename = `${entry.tag}.sql`;
    const sql = fs.readFileSync(path.join("migrations", filename), "utf8");
    return { ...entry, sql, hashes: [...migrationHashes(sql), ...completedPublicationPredecessorHashes(filename)] };
  });
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  let readOnly = false, locked = false;
  try {
    if (dryRun) {
      await client.query("BEGIN READ ONLY");
      readOnly = true;
    } else {
      await client.query("select pg_advisory_lock(hashtext('tradescout_migration_gap_recovery'))");
      locked = true;
    }
    const ledger = await client.query("select to_regclass('drizzle.__drizzle_migrations') is not null as present");
    const existing = ledger.rows[0].present ? await client.query("select id, hash, created_at from drizzle.__drizzle_migrations") : { rows: [] };
    const existingHashes = new Set(existing.rows.map((row) => row.hash));
    const hasRecord = (migration) => migration.hashes.some((hash) => existingHashes.has(hash));
    const byTag = new Map(migrations.map((migration) => [migration.tag, migration]));
    const conflicts = [];
    for (const migration of migrations.filter((entry) => !hasRecord(entry))) {
      for (const successorTag of recordedSuccessors.get(migration.tag) || []) {
        // Read the canonical successor even when a focused test/recovery journal omits it.
        const successor = byTag.get(successorTag) || (() => {
          const filename = path.join("migrations", `${successorTag}.sql`);
          return fs.existsSync(filename) ? { hashes: migrationHashes(fs.readFileSync(filename, "utf8")) } : null;
        })();
        if (successor && hasRecord(successor)) conflicts.push(`${migration.tag} -> ${successorTag}`);
      }
    }
    if (conflicts.length) {
      throw new Error(`Unsafe predecessor replay refused before SQL or ledger changes: ${conflicts.join(", ")}. Review the complete successor sequence and preserve existing entitlement decisions transactionally; blindly replaying 0118 can undo 0131 revocation protection. ${DATABASE_RECOVERY_GUIDANCE}`);
    }
    if (!dryRun && !ledger.rows[0].present) {
      await client.query("create schema if not exists drizzle");
      await client.query("create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)");
    }
    const applied = [], skipped = [], failed = [];
    console.log(JSON.stringify({ phase: "start", dryRun, beforeCount: existing.rows.length, journalCount: migrations.length }));
    for (const migration of migrations) {
      if (hasRecord(migration)) { skipped.push(migration.tag); continue; }
      const hash = sha256(migration.sql.replace(/\r\n?/g, "\n"));
      const statements = migration.sql.split(/-->\s*statement-breakpoint\s*/g).map((sql) => sql.trim()).filter(Boolean);
      if (dryRun) { applied.push({ tag: migration.tag, statements: statements.length }); continue; }
      try {
        await client.query("BEGIN");
        for (const statement of statements) await client.query(statement);
        await client.query("insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)", [hash, Number(migration.when)]);
        await client.query("COMMIT");
        existingHashes.add(hash);
        applied.push({ tag: migration.tag, statements: statements.length });
        console.log(`[applied] ${migration.tag}`);
      } catch (error) {
        await client.query("ROLLBACK");
        failed.push({ tag: migration.tag, error: (error instanceof Error ? error.message : String(error)).split("\n")[0] });
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
      } finally { await client.query("ROLLBACK"); }
    }
    console.log(JSON.stringify({ phase: "done", dryRun, schemaVerified, beforeCount: existing.rows.length,
      appliedSqlCount: applied.length, markedAlreadyAppliedCount: 0, skippedCount: skipped.length, applied, failed }, null, 2));
    if (failed.length) { console.error(DATABASE_RECOVERY_GUIDANCE); process.exitCode = 1; }
    else if (dryRun) console.log("[db:migrate:fill-gaps] Read-only plan only. No SQL applied, no history recorded, and no compatibility claim.");
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