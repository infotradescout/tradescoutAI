import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import dotenv from "dotenv";
import { runCommand, spawnCommand } from "./lib/subprocess.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");

dotenv.config({ path: path.join(repoRoot, ".env.test") });
dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const defaultIntegrationTestFiles = [
  "server/tests/community-causes-allocation.integration.test.ts",
  "server/tests/community-causes-route-integration.test.ts",
  "server/tests/community-feed-api.test.ts",
  "server/tests/direct-connect-gates.integration.test.ts",
  "server/tests/groups-api.test.ts",
  "server/tests/hoa-api.test.ts",
  "server/tests/marketplace-api.test.ts",
  "server/tests/messages-api.test.ts",
  "server/tests/notifications-api.test.ts",
  "server/tests/phase2b-ingress.integration.test.ts",
  "server/tests/phase2c-privileged.integration.test.ts",
];
const strictIntegrationTestFiles = [
  "server/tests/d3-messaging-authority.test.ts",
  "server/tests/auth-account-flow.test.ts",
  "server/tests/acceptance-realignment.test.ts",
];

if (!testDatabaseUrl) {
  console.error("Missing TEST_DATABASE_URL. Run `node scripts/ensure-test-db.mjs` first.");
  process.exit(2);
}

function run(command, args, env = process.env) {
  return runCommand(command, args, { cwd: repoRoot, stdio: "inherit", env });
}

function stopProcessTree(child) {
  if (!child?.pid) return Promise.resolve();
  if (process.platform === "win32") {
    return run("taskkill", ["/PID", String(child.pid), "/T", "/F"]).then(() => undefined);
  }
  child.kill("SIGTERM");
  return Promise.resolve();
}

function waitForHealth(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
          return;
        }

        if (Date.now() > deadline) {
          reject(new Error(`Health check timed out with status ${res.statusCode}`));
          return;
        }
        setTimeout(attempt, 1000);
      });

      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error("Health check timed out waiting for server."));
          return;
        }
        setTimeout(attempt, 1000);
      });

      req.setTimeout(5000, () => req.destroy());
    };

    attempt();
  });
}

async function main() {
  const port = Number(process.env.INTEGRATION_TEST_PORT || 5057);
  const baseUrl = `http://localhost:${port}`;
  const env = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: testDatabaseUrl,
    TEST_DATABASE_URL: testDatabaseUrl,
    RUN_INTEGRATION_TESTS: "true",
    VITEST_SERIAL: "true",
    PORT: String(port),
    INTEGRATION_TEST_BASE_URL: baseUrl,
    GOOGLE_CALLBACK_URL: `${baseUrl}/api/auth/google/callback`,
    FACEBOOK_CALLBACK_URL: `${baseUrl}/api/auth/facebook/callback`,
  };

  const bootstrapCode = await run("node", ["scripts/bootstrap-test-db.mjs"], env);
  if (bootstrapCode !== 0) {
    process.exit(bootstrapCode);
  }

  const server = await spawnCommand(
    "npx",
    ["tsx", "-r", "dotenv/config", "server/index.ts"],
    { cwd: repoRoot, stdio: "inherit", env }
  );

  let testExitCode = 1;
  try {
    await waitForHealth(`http://localhost:${port}/api/health`);
    const integrationTestFiles =
      process.env.RUN_STRICT_INTEGRATION === "true"
        ? strictIntegrationTestFiles
        : defaultIntegrationTestFiles;
    const vitestArgs = [
      "vitest",
      "run",
      "--no-file-parallelism",
      "--maxWorkers=1",
      ...integrationTestFiles,
    ];
    if (process.env.RUN_STRICT_INTEGRATION !== "true") {
      vitestArgs.push(
        "--exclude",
        "server/tests/d3-messaging-authority.test.ts",
        "--exclude",
        "server/tests/auth-account-flow.test.ts",
        "--exclude",
        "server/tests/acceptance-realignment.test.ts"
      );
    }
    testExitCode = await run("npx", vitestArgs, env);
  } finally {
    await stopProcessTree(server);
  }

  process.exit(testExitCode);
}

main().catch((error) => {
  console.error(
    "[run-integration-tests] Unexpected failure:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
