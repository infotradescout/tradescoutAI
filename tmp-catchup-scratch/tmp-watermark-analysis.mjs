import fs from "node:fs";
import crypto from "crypto";
import path from "path";
import pg from "pg";

const url = fs.readFileSync("tmp-rehearsal-url.txt", "utf8").trim();
const client = new pg.Client({ connectionString: url });
await client.connect();
const rows = await client.query(
  "select id, hash, created_at from drizzle.__drizzle_migrations order by id"
);
const journal = JSON.parse(
  fs.readFileSync("migrations/meta/_journal.json", "utf8")
);
const hashToTag = new Map();
const tagToWhen = new Map();
for (const e of journal.entries) {
  tagToWhen.set(e.tag, e.when);
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
const mapped = rows.rows.map((r) => ({
  id: r.id,
  tag: hashToTag.get(r.hash) || "UNKNOWN",
  created_at: Number(r.created_at),
  hash12: r.hash.slice(0, 12),
}));
const byTag = new Map();
for (const m of mapped) {
  if (!byTag.has(m.tag)) byTag.set(m.tag, []);
  byTag.get(m.tag).push(m);
}
const dupes = [...byTag.entries()].filter(([t, a]) => t !== "UNKNOWN" && a.length > 1);
console.log(
  JSON.stringify(
    {
      rows: mapped.length,
      unknown: mapped.filter((m) => m.tag === "UNKNOWN"),
      uniqueKnownTags: [...byTag.keys()].filter((t) => t !== "UNKNOWN").length,
      dupes: dupes.map(([t, a]) => ({ tag: t, ids: a.map((x) => x.id) })),
      maxCreatedAt: Math.max(...mapped.map((m) => m.created_at)),
      journalWhen0113: tagToWhen.get(
        "0113_jw_stone_recommendation_compatibility_target"
      ),
      watermarkTrap:
        Math.max(...mapped.map((m) => m.created_at)) >=
        Math.max(...journal.entries.map((e) => e.when)),
    },
    null,
    2
  )
);
await client.end();
