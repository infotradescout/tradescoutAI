import fs from "node:fs";
import path from "node:path";
import { spawnCommand } from "./lib/subprocess.mjs";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function run(cmd, args, env = process.env) {
  const child = await spawnCommand(cmd, args, { stdio: "inherit", env });
  return await new Promise((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const repoRoot = process.cwd();
  readEnvFile(path.join(repoRoot, ".env.test"));
  readEnvFile(path.join(repoRoot, ".env.local"));
  readEnvFile(path.join(repoRoot, ".env"));

  if (!process.env.TEST_DATABASE_URL) {
    if (!process.env.DATABASE_URL) {
      console.error(
        "[test:e2e] Missing TEST_DATABASE_URL and DATABASE_URL. Set TEST_DATABASE_URL explicitly or configure DATABASE_URL so scripts/ensure-test-db.mjs can derive it."
      );
      process.exit(2);
    }
    const ensureExit = await run("node", ["scripts/ensure-test-db.mjs"]);
    if (ensureExit !== 0) process.exit(ensureExit);
    readEnvFile(path.join(repoRoot, ".env.test"));
  }

  if (!process.env.TEST_DATABASE_URL) {
    console.error("[test:e2e] TEST_DATABASE_URL is still missing after ensure-test-db.");
    process.exit(2);
  }

  const bootstrapExit = await run("npm", ["run", "db:bootstrap:test"], process.env);
  if (bootstrapExit !== 0) process.exit(bootstrapExit);

  const passthroughArgs = process.argv.slice(2);
  const playwrightExit = await run(
    "npx",
    ["cross-env", "NODE_ENV=test", "playwright", "test", ...passthroughArgs],
    process.env
  );
  process.exit(playwrightExit);
}

main().catch((error) => {
  console.error("[test:e2e] Failed:", error);
  process.exit(1);
});

