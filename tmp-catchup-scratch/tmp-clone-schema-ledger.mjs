import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

dotenv.config();

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const targetUrl = sourceUrl.replace(/\/neondb(\?|$)/, "/catchup_rehearsal_20260807$1");
if (targetUrl === sourceUrl) {
  console.error("failed to rewrite DATABASE_URL path to catchup db");
  process.exit(1);
}

const dumpDir = path.resolve("tmp-catchup-dump");
fs.mkdirSync(dumpDir, { recursive: true });
const schemaFile = path.join(dumpDir, "schema.sql").replace(/\\/g, "/");
const ledgerFile = path.join(dumpDir, "ledger.sql").replace(/\\/g, "/");
const hostDumpDir = dumpDir.replace(/\\/g, "/");

function runDockerPg(args, envUrl, label) {
  const result = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-e",
      `DATABASE_URL=${envUrl}`,
      "-v",
      `${hostDumpDir}:/dump`,
      "postgres:16-alpine",
      ...args,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.stdout) process.stdout.write(result.stdout.slice(0, 4000));
  if (result.stderr) process.stderr.write(result.stderr.slice(0, 8000));
  if (result.status !== 0) {
    console.error(`[fail] ${label} exit=${result.status}`);
    process.exit(result.status || 1);
  }
  console.log(`[ok] ${label}`);
}

console.log("[start] schema dump from prod");
runDockerPg(
  [
    "sh",
    "-c",
    'pg_dump "$DATABASE_URL" --schema-only --no-owner --no-privileges -f /dump/schema.sql',
  ],
  sourceUrl,
  "schema-dump"
);

console.log("[start] ledger data dump from prod");
runDockerPg(
  [
    "sh",
    "-c",
    'pg_dump "$DATABASE_URL" --data-only --table=drizzle.__drizzle_migrations --no-owner --no-privileges -f /dump/ledger.sql',
  ],
  sourceUrl,
  "ledger-dump"
);

console.log("[start] restore schema to disposable");
runDockerPg(
  ["sh", "-c", 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /dump/schema.sql'],
  targetUrl,
  "schema-restore"
);

console.log("[start] restore ledger to disposable");
runDockerPg(
  ["sh", "-c", 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /dump/ledger.sql'],
  targetUrl,
  "ledger-restore"
);

console.log(
  JSON.stringify({
    ok: true,
    schemaBytes: fs.statSync(path.join(dumpDir, "schema.sql")).size,
    ledgerBytes: fs.statSync(path.join(dumpDir, "ledger.sql")).size,
    targetDb: "catchup_rehearsal_20260807",
  })
);
