import path from "node:path";
import { randomUUID } from "node:crypto";
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
const laneLockName = "tradescout_test_db_lane_v3";
const laneLockOwner = `${process.env.GITHUB_RUN_ID || "local"}:${process.pid}:${randomUUID()}`;

if (!testDatabaseUrl) {
  console.error("[test-db-lane-lock] Missing TEST_DATABASE_URL.");
  process.exit(2);
}

if (!command) {
  console.error("Usage: node scripts/with-test-db-lane-lock.mjs -- <command...>");
  process.exit(2);
}

async function ensureLeaseTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS test_db_locks (
      name text PRIMARY KEY,
      owner text NOT NULL,
      expires_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function tryAcquireLease(client, lockName, owner) {
  const result = await client.query(
    `
      INSERT INTO test_db_locks (name, owner, expires_at, updated_at)
      VALUES ($1, $2, now() + interval '15 minutes', now())
      ON CONFLICT (name) DO UPDATE
      SET owner = EXCLUDED.owner,
          expires_at = EXCLUDED.expires_at,
          updated_at = now()
      WHERE test_db_locks.expires_at < now()
      RETURNING owner
    `,
    [lockName, owner]
  );
  return result.rows[0]?.owner === owner;
}

async function waitForLeaseLock(client, lockName, owner) {
  let attempts = 0;
  for (;;) {
    if (await tryAcquireLease(client, lockName, owner)) return;
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
  let heartbeat;

  try {
    console.log("[test-db-lane-lock] Waiting for shared test DB lane...");
    await ensureLeaseTable(client);
    await waitForLeaseLock(client, laneLockName, laneLockOwner);
    lockAcquired = true;
    console.log("[test-db-lane-lock] Shared test DB lane acquired.");
    heartbeat = setInterval(() => {
      client
        .query(
          `
            UPDATE test_db_locks
            SET expires_at = now() + interval '15 minutes',
                updated_at = now()
            WHERE name = $1 AND owner = $2
          `,
          [laneLockName, laneLockOwner]
        )
        .catch(() => {});
    }, 30_000);

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
    if (heartbeat) clearInterval(heartbeat);
    if (lockAcquired) {
      await client
        .query("DELETE FROM test_db_locks WHERE name = $1 AND owner = $2", [
          laneLockName,
          laneLockOwner,
        ])
        .catch(() => {});
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
