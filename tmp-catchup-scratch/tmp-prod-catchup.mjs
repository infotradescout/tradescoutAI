import dotenv from "dotenv";
import pg from "pg";
import { spawnSync } from "node:child_process";

dotenv.config();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}
const u = new URL(url.replace(/^postgres(ql)?:/, "http:"));
if (!u.pathname.includes("neondb") || u.hostname.includes("divine-dew")) {
  console.error("Refusing: DATABASE_URL does not look like production neondb", u.hostname, u.pathname);
  process.exit(1);
}
console.log(JSON.stringify({ host: u.hostname, db: u.pathname, step: "prod-guard-ok" }));

async function count() {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const r = await c.query("select count(*)::int as c from drizzle.__drizzle_migrations");
  await c.end();
  return r.rows[0].c;
}

const before = await count();
console.log(JSON.stringify({ before }));

function run(label, args) {
  console.log(`[run] ${label}`);
  const res = spawnSync("node", args, {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: url },
    maxBuffer: 32 * 1024 * 1024,
  });
  process.stdout.write(res.stdout || "");
  process.stderr.write(res.stderr || "");
  if (res.status !== 0) {
    console.error(`[fail] ${label} exit=${res.status}`);
    process.exit(res.status || 1);
  }
}

run("fill-gaps", ["scripts/db-migrate-fill-gaps.mjs", "--mark-already-applied"]);
const mid = await count();
console.log(JSON.stringify({ afterFill: mid }));
run("prune", ["scripts/db-ledger-prune-orphans.mjs"]);
const after = await count();
console.log(JSON.stringify({ afterPrune: after }));
run("verify", ["scripts/check-required-production-schema.mjs"]);
console.log(JSON.stringify({ final: after, expected: 117, ok: after === 117 }));
process.exit(after === 117 ? 0 : 1);
