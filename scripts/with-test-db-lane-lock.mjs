import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { spawnCommand } from "./lib/subprocess.mjs";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");

dotenv.config({ path: path.join(repoRoot, ".env.test") });
dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const rawArgs = process.argv.slice(2);
const separatorIndex = rawArgs.indexOf("--");
const commandArgs = separatorIndex >= 0 ? rawArgs.slice(separatorIndex + 1) : rawArgs;
const [command, ...args] = commandArgs;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const laneLockScope = String(process.env.GITHUB_SHA || "local").slice(0, 80);
const laneLockName = `tradescout_test_db_lane_v2:${laneLockScope}`;

if (!testDatabaseUrl) {
  console.error("[test-db-lane-lock] Missing TEST_DATABASE_URL.");
  process.exit(2);
}

if (!command) {
  console.error("Usage: node scripts/with-test-db-lane-lock.mjs -- <command...>");
  process.exit(2);
}

async function waitForAdvisoryLock(client, lockName) {
  let attempts = 0;
  for (;;) {
    const result = await client.query("SELECT pg_try_advisory_lock(hashtext($1)) AS locked", [
      lockName,
    ]);
    if (result.rows[0]?.locked === true) return;
    attempts += 1;
    if (attempts % 30 === 0) {
      console.log(`[test-db-lane-lock] Still waiting for shared test DB lane (${attempts}s).`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function runLocked() {
  const client = new Client({ connectionString: testDatabaseUrl });
  await client.connect();
  let lockAcquired = false;

  try {
    console.log("[test-db-lane-lock] Waiting for shared test DB lane...");
    await waitForAdvisoryLock(client, laneLockName);
    lockAcquired = true;
    console.log("[test-db-lane-lock] Shared test DB lane acquired.");

    const env = { ...process.env, DATABASE_URL: testDatabaseUrl, TEST_DATABASE_URL: testDatabaseUrl };
    const child = await spawnCommand(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      env,
    });

    return await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolve(code ?? 1));
    });
  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [laneLockName]).catch(() => {});
    }
    await client.end();
  }
}

runLocked()
  .then((code) => process.exit(Number(code) || 0))
  .catch((error) => {
    console.error(
      "[test-db-lane-lock] Unexpected failure:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  });
