/**
 * Fill Drizzle journal gaps that normal `drizzle-kit migrate` skips.
 *
 * Root cause: drizzle-orm only applies migrations with
 * folderMillis > max(ledger.created_at). A later journal tag in the ledger
 * permanently hides earlier missing tags ("watermark trap").
 *
 * This script applies by hash presence, in journal order.
 *
 * Flags:
 *   --dry-run
 *   --mark-already-applied  On duplicate-object errors, insert ledger hash only
 *                           (schema already has the object). Stops on other errors.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");
const markAlreadyApplied = process.argv.includes("--mark-already-applied");
const dbUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL or TEST_DATABASE_URL required");
  process.exit(1);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function migrationHashes(sqlText) {
  const lf = String(sqlText).replace(/\r\n?/g, "\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  return [...new Set([sha256(sqlText), sha256(lf), sha256(crlf)])];
}

function splitSqlStatements(sqlText) {
  return String(sqlText)
    .split(/-->\s*statement-breakpoint\s*/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAlreadyAppliedError(message) {
  const m = String(message || "").toLowerCase();
  return (
    m.includes("already exists") ||
    m.includes("duplicate key value") ||
    /relation .* already exists/.test(m) ||
    /type .* already exists/.test(m) ||
    /constraint .* already exists/.test(m) ||
    /column .* of relation .* already exists/.test(m)
  );
}

const journal = JSON.parse(
  fs.readFileSync("migrations/meta/_journal.json", "utf8")
);
const entries = Array.isArray(journal.entries) ? journal.entries : [];

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

await client.query("create schema if not exists drizzle");
await client.query(`
  create table if not exists drizzle.__drizzle_migrations (
    id serial primary key,
    hash text not null,
    created_at bigint
  )
`);

const existing = await client.query(
  "select id, hash, created_at from drizzle.__drizzle_migrations"
);
const existingHashes = new Set(existing.rows.map((r) => r.hash));

const before = existing.rows.length;
console.log(
  JSON.stringify({
    phase: "start",
    dryRun,
    markAlreadyApplied,
    beforeCount: before,
    journalCount: entries.length,
  })
);

const applied = [];
const marked = [];
const skipped = [];
const failed = [];

for (const entry of entries) {
  const sqlPath = path.join("migrations", `${entry.tag}.sql`);
  if (!fs.existsSync(sqlPath)) {
    failed.push({ tag: entry.tag, error: "missing sql file" });
    break;
  }
  const sqlText = fs.readFileSync(sqlPath, "utf8");
  const hashes = migrationHashes(sqlText);
  if (hashes.some((h) => existingHashes.has(h))) {
    skipped.push(entry.tag);
    continue;
  }

  const hash = sha256(sqlText.replace(/\r\n?/g, "\n"));
  const stmts = splitSqlStatements(sqlText);

  if (dryRun) {
    applied.push({ tag: entry.tag, stmts: stmts.length, hash: hash.slice(0, 12) });
    continue;
  }

  try {
    await client.query("begin");
    for (const stmt of stmts) {
      await client.query(stmt);
    }
    await client.query(
      "insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)",
      [hash, Number(entry.when)]
    );
    await client.query("commit");
    existingHashes.add(hash);
    applied.push({ tag: entry.tag, stmts: stmts.length, hash: hash.slice(0, 12) });
    console.log(`[applied] ${entry.tag}`);
  } catch (err) {
    await client.query("rollback");
    const message = err instanceof Error ? err.message : String(err);
    if (markAlreadyApplied && isAlreadyAppliedError(message)) {
      try {
        await client.query(
          "insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)",
          [hash, Number(entry.when)]
        );
        existingHashes.add(hash);
        marked.push({ tag: entry.tag, reason: message.split("\n")[0] });
        console.log(`[marked-already-applied] ${entry.tag}`);
        continue;
      } catch (markErr) {
        failed.push({
          tag: entry.tag,
          error: markErr instanceof Error ? markErr.message : String(markErr),
        });
        console.error(`[failed-mark] ${entry.tag}: ${failed.at(-1).error}`);
        break;
      }
    }
    failed.push({ tag: entry.tag, error: message.split("\n")[0] });
    console.error(`[failed] ${entry.tag}: ${failed.at(-1).error}`);
    break;
  }
}

const after = (
  await client.query(
    "select count(*)::int as c from drizzle.__drizzle_migrations"
  )
).rows[0].c;

console.log(
  JSON.stringify(
    {
      phase: "done",
      dryRun,
      markAlreadyApplied,
      beforeCount: before,
      afterCount: after,
      appliedSqlCount: applied.length,
      markedAlreadyAppliedCount: marked.length,
      skippedCount: skipped.length,
      failed,
      markedSample: marked.slice(0, 10),
    },
    null,
    2
  )
);

await client.end();
process.exit(failed.length ? 1 : 0);
