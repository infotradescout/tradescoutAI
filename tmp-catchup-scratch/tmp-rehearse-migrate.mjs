import dotenv from "dotenv";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import pg from "pg";

dotenv.config();

const urlPath = "tmp-rehearsal-url.txt";
if (!fs.existsSync(urlPath)) {
  console.error("missing tmp-rehearsal-url.txt");
  process.exit(1);
}
const url = fs.readFileSync(urlPath, "utf8").trim();
if (!url.startsWith("postgres")) {
  console.error("bad rehearsal url");
  process.exit(1);
}

async function count(label, connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const r = await client.query(
    "select count(*)::int as c from drizzle.__drizzle_migrations"
  );
  console.log(JSON.stringify({ label, appliedCount: r.rows[0].c }));
  await client.end();
}

await count("before", url);

const migrate = spawnSync("npx", ["drizzle-kit", "migrate"], {
  encoding: "utf8",
  env: { ...process.env, DATABASE_URL: url },
  maxBuffer: 32 * 1024 * 1024,
});
process.stdout.write(migrate.stdout || "");
process.stderr.write(migrate.stderr || "");
console.log(JSON.stringify({ migrateExit: migrate.status }));

await count("after", url);
process.exit(migrate.status || 0);
