import dotenv from "dotenv";
import pg from "pg";
import fs from "fs";
import crypto from "crypto";
import path from "path";

dotenv.config({ path: ".env.test" });
dotenv.config();

const which = process.argv[2] || "prod";
const url =
  which === "test"
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

if (!url) {
  console.error(`Missing URL for ${which}`);
  process.exit(1);
}

const u = new URL(url.replace(/^postgres(ql)?:/, "http:"));
console.log(
  JSON.stringify({
    which,
    host: u.hostname,
    db: u.pathname,
    user: u.username,
  })
);

const client = new pg.Client({ connectionString: url });
await client.connect();

const ledgerExists = await client.query(
  `select count(*)::int as c from information_schema.tables
   where table_schema='drizzle' and table_name='__drizzle_migrations'`
);
if (Number(ledgerExists.rows[0].c) === 0) {
  console.log(JSON.stringify({ appliedCount: 0, missing: "no-ledger" }));
  await client.end();
  process.exit(0);
}

const count = await client.query(
  "select count(*)::int as c from drizzle.__drizzle_migrations"
);
const rows = await client.query(
  "select id, hash, created_at from drizzle.__drizzle_migrations order by created_at asc, id asc"
);

const journal = JSON.parse(
  fs.readFileSync("migrations/meta/_journal.json", "utf8")
);
const hashToTag = new Map();
for (const e of journal.entries) {
  const sqlPath = path.join("migrations", `${e.tag}.sql`);
  const buf = fs.readFileSync(sqlPath);
  const raw = buf.toString("utf8");
  const lf = raw.replace(/\r\n?/g, "\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  for (const variant of [raw, lf, crlf, buf]) {
    hashToTag.set(crypto.createHash("sha256").update(variant).digest("hex"), e.tag);
  }
}

const mapped = rows.rows.map((r) => ({
  id: r.id,
  created_at: String(r.created_at),
  tag: hashToTag.get(r.hash) || "UNKNOWN",
  hash12: r.hash.slice(0, 12),
}));
const appliedTags = new Set(mapped.map((m) => m.tag).filter((t) => t !== "UNKNOWN"));
const missing = journal.entries.map((e) => e.tag).filter((t) => !appliedTags.has(t));

console.log(
  JSON.stringify(
    {
      appliedCount: count.rows[0].c,
      knownMapped: appliedTags.size,
      unknown: mapped.filter((m) => m.tag === "UNKNOWN").length,
      missingCount: missing.length,
      nextMissing: missing.slice(0, 15),
      lastAppliedKnown: mapped.filter((m) => m.tag !== "UNKNOWN").slice(-5),
      has0113: appliedTags.has("0113_jw_stone_recommendation_compatibility_target"),
      has0072: appliedTags.has("0072_seo_publication_rules_and_freshness"),
    },
    null,
    2
  )
);

await client.end();
