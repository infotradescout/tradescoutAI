/**
 * After gap-fill, remove non-journal ledger rows so appliedCount can equal journal length.
 * Keeps one matching hash per journal tag; drops UNKNOWN hashes and duplicate tag rows.
 *
 * Usage: DATABASE_URL=... node scripts/db-ledger-prune-orphans.mjs [--dry-run]
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { completedPublicationPredecessorHashes } from "./lib/completed-publication-identities.mjs";

dotenv.config();

const dryRun = process.argv.includes("--dry-run");
const dbUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL or TEST_DATABASE_URL required");
  process.exit(1);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

const journal = JSON.parse(
  fs.readFileSync("migrations/meta/_journal.json", "utf8")
);
const canonicalByTag = new Map();
const hashToTag = new Map();
for (const e of journal.entries) {
  const filename = `${e.tag}.sql`;
  const raw = fs.readFileSync(path.join("migrations", filename), "utf8");
  const lf = raw.replace(/\r\n?/g, "\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  const preferred = sha256(lf);
  canonicalByTag.set(e.tag, preferred);
  for (const variant of [raw, lf, crlf]) {
    hashToTag.set(sha256(variant), e.tag);
  }
  for (const hash of completedPublicationPredecessorHashes(filename)) {
    hashToTag.set(hash, e.tag);
  }
}

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
const rows = (
  await client.query(
    "select id, hash, created_at from drizzle.__drizzle_migrations order by id"
  )
).rows;

const keep = new Set();
const drop = [];
const seenTag = new Set();

// Prefer keeping the canonical LF hash row for each tag; else first matching row.
for (const e of journal.entries) {
  const canonical = canonicalByTag.get(e.tag);
  const canonicalRow = rows.find((r) => r.hash === canonical);
  if (canonicalRow) {
    keep.add(canonicalRow.id);
    seenTag.add(e.tag);
    continue;
  }
  const any = rows.find((r) => hashToTag.get(r.hash) === e.tag);
  if (any) {
    keep.add(any.id);
    seenTag.add(e.tag);
  }
}

for (const r of rows) {
  if (keep.has(r.id)) continue;
  drop.push({
    id: r.id,
    tag: hashToTag.get(r.hash) || "UNKNOWN",
    hash12: r.hash.slice(0, 12),
  });
}

console.log(
  JSON.stringify(
    {
      before: rows.length,
      journal: journal.entries.length,
      keep: keep.size,
      dropCount: drop.length,
      drop,
      dryRun,
    },
    null,
    2
  )
);

if (!dryRun && drop.length) {
  const ids = drop.map((d) => d.id);
  await client.query(
    "delete from drizzle.__drizzle_migrations where id = any($1::int[])",
    [ids]
  );
}

const after = (
  await client.query(
    "select count(*)::int as c from drizzle.__drizzle_migrations"
  )
).rows[0].c;
console.log(JSON.stringify({ afterCount: after }));
await client.end();

if (after !== journal.entries.length && !dryRun) {
  console.error(
    `afterCount ${after} != journal ${journal.entries.length}`
  );
  process.exit(1);
}
