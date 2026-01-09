import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function normalizePgUrl(dbUrl, dbNameOverride) {
  const u = new URL(dbUrl);
  u.pathname = `/${dbNameOverride}`;
  return u.toString();
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, "..");

  loadEnvFile(path.join(root, ".env"));
  loadEnvFile(path.join(root, ".env.local"));
  loadEnvFile(path.join(root, ".env.test"));

  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL missing in .env/.env.local");

  const testDb = "tradescout_test";
  const adminUrl = normalizePgUrl(base, "postgres");

  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  try {
    console.log(`⚠️ Resetting test DB: ${testDb}`);

    // Terminate existing connections to allow drop
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [testDb]
    );

    await client.query(`DROP DATABASE IF EXISTS "${testDb}"`);
    await client.query(`CREATE DATABASE "${testDb}"`);
    console.log(`✅ Reset complete: ${testDb}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("❌ reset-test-db failed:", e);
  process.exit(1);
});
