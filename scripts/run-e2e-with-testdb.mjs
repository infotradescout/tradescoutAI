import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand } from "./lib/subprocess.mjs";
import { ensureTestDatabase, testDatabaseSetupErrorMessage } from "./ensure-test-db.mjs";

export async function runE2eWithTestDatabase({
  repoRoot = process.cwd(),
  environment = process.env,
  args = process.argv.slice(2),
  ensureDatabase = ensureTestDatabase,
  run = runCommand,
} = {}) {
  const testUrl = await ensureDatabase({ repoRoot, environment });
  const testEnvironment = {
    ...environment,
    NODE_ENV: "test",
    DATABASE_URL: testUrl,
    TEST_DATABASE_URL: testUrl,
  };
  const bootstrapExit = await run("npm", ["run", "db:bootstrap:test"], { cwd: repoRoot, env: testEnvironment, stdio: "inherit" });
  if (bootstrapExit !== 0) return bootstrapExit;
  return run("npx", ["playwright", "test", ...args], { cwd: repoRoot, env: testEnvironment, stdio: "inherit" });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runE2eWithTestDatabase().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(`[test:e2e] ${testDatabaseSetupErrorMessage(error)}`);
    process.exitCode = 1;
  });
}
