import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function normalizePgUrl(dbUrl, dbNameOverride) {
  const u = new URL(dbUrl);
  if (dbNameOverride) u.pathname = `/${dbNameOverride}`;
  return u.toString();
}

async function ensureDatabaseExists(adminUrl, dbName) {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const check = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (check.rowCount === 0) {
      // CREATE DATABASE cannot run inside a transaction block; pg defaults are fine here.
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Created database: ${dbName}`);
    } else {
      console.log(`✅ Database exists: ${dbName}`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const repoRoot = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(repoRoot, "..");

  // Load repo env files if present
  loadEnvFile(path.join(root, ".env"));
  loadEnvFile(path.join(root, ".env.local"));
  loadEnvFile(path.join(root, ".env.test"));

  const base = process.env.DATABASE_URL;
  if (!base) {
    console.error("❌ DATABASE_URL is not set. Add it to .env (repo root) and rerun.");
    process.exit(1);
  }

  const testName = "tradescout_test";

  // Use the same server/user/pass/port as DATABASE_URL but connect to postgres admin DB
  const adminUrl = normalizePgUrl(base, "postgres");
  await ensureDatabaseExists(adminUrl, testName);

  const testUrl = normalizePgUrl(base, testName);

  // Write .env.test deterministically (safe to overwrite)
  const envTestPath = path.join(root, ".env.test");
  fs.writeFileSync(envTestPath, `TEST_DATABASE_URL=${testUrl}\n`, "utf8");
  console.log(`✅ Wrote ${envTestPath}`);
  console.log(`TEST_DATABASE_URL=${testUrl}`);
}

main().catch((err) => {
  console.error("❌ ensure-test-db failed:", err);
  process.exit(1);
});
