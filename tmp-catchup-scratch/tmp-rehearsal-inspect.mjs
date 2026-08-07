import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import pg from "pg";

const url = fs.readFileSync("tmp-rehearsal-url.txt", "utf8").trim();
const client = new pg.Client({ connectionString: url });
await client.connect();
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
  const buf = fs.readFileSync(path.join("migrations", `${e.tag}.sql`));
  const raw = buf.toString("utf8");
  const lf = raw.replace(/\r\n?/g, "\n");
  const crlf = lf.replace(/\n/g, "\r\n");
  for (const variant of [raw, lf, crlf, buf]) {
    hashToTag.set(
      crypto.createHash("sha256").update(variant).digest("hex"),
      e.tag
    );
  }
}
const mapped = rows.rows.map((r) => hashToTag.get(r.hash) || "UNKNOWN");
const applied = new Set(mapped.filter((t) => t !== "UNKNOWN"));
const missing = journal.entries
  .map((e) => e.tag)
  .filter((t) => !applied.has(t));
console.log(
  JSON.stringify(
    {
      appliedCount: count.rows[0].c,
      knownMapped: applied.size,
      unknown: mapped.filter((t) => t === "UNKNOWN").length,
      missingCount: missing.length,
      nextMissing: missing.slice(0, 10),
    },
    null,
    2
  )
);
await client.end();
