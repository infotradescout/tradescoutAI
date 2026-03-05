import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { runCommand } from "./lib/subprocess.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");

dotenv.config({ path: path.join(repoRoot, ".env.test") });

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

async function main() {
  if (hasTestDb) {
    // When a disposable test DB is available (CI or local DB lane), enforce zero-skips.
    const exitCode = await runCommand("npm", ["run", "test:run:no-skips"], {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    });
    process.exit(exitCode);
  }

  console.log(
    "[verify:tests] TEST_DATABASE_URL not set. Running deterministic lane; DB/integration suites will be skipped."
  );
  const exitCode = await runCommand("npm", ["run", "test:run"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  process.exit(exitCode);
}

main().catch((error) => {
  console.error(
    "[verify:tests] Unexpected failure:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});

