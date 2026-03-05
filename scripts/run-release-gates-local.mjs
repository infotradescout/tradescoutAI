import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import dotenv from "dotenv";
import { runCommand } from "./lib/subprocess.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");

dotenv.config({ path: path.join(repoRoot, ".env.test") });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  console.error("[release-gates:local] Missing TEST_DATABASE_URL.");
  console.error(
    "[release-gates:local] Set it in your shell or in .env.test (local only), then rerun."
  );
  process.exit(2);
}

function toHealthUrl(baseUrl) {
  return `${baseUrl.replace(/\/+$/, "")}/api/health`;
}

async function checkHealth(baseUrl) {
  const url = toHealthUrl(baseUrl);
  const timeoutMs = 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "x-release-gates-preflight": "true" },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForHealthy(baseUrl, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkHealth(baseUrl)) return true;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return false;
}

async function checkHttpOk(url) {
  const timeoutMs = 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "text/html,*/*" },
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForVite(baseUrl, timeoutMs) {
  const start = Date.now();
  const url = `${baseUrl.replace(/\/+$/, "")}/@vite/client`;
  while (Date.now() - start < timeoutMs) {
    if (await checkHttpOk(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return false;
}

async function pickPort() {
  const explicit = Number(process.env.RELEASE_GATES_PORT || "");
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") return reject(new Error("port allocation failed"));
        resolve(address.port);
      });
    });
  });
}

async function allocateFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") return reject(new Error("port allocation failed"));
        resolve(address.port);
      });
    });
  });
}

async function run(command, args, env) {
  return await runCommand(command, args, { cwd: repoRoot, stdio: "inherit", env });
}

function startServer(port, laneEnv) {
  const masterEmail =
    process.env.E2E_EMAIL || process.env.MASTER_ADMIN_EMAIL || "e2e-admin@tradescout.test";
  const masterPassword =
    process.env.E2E_PASSWORD || process.env.MASTER_ADMIN_PASSWORD || "e2e-admin-password";

  const env = {
    ...laneEnv,
    NODE_ENV: "test",
    PORT: String(port),
    TEST_DATABASE_URL: testDatabaseUrl,
    DATABASE_URL: testDatabaseUrl,
    SESSION_SECRET: process.env.SESSION_SECRET || "local-release-gates-session-secret",
    SCHEDULER_ENABLED: "false",
    MASTER_ADMIN_EMAIL: masterEmail,
    MASTER_ADMIN_PASSWORD: masterPassword,
    MASTER_ADMIN_FIRST_NAME: process.env.MASTER_ADMIN_FIRST_NAME || "E2E",
    MASTER_ADMIN_LAST_NAME: process.env.MASTER_ADMIN_LAST_NAME || "Admin",
    E2E_EMAIL: masterEmail,
    E2E_PASSWORD: masterPassword,
  };

  const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const args = [tsxCli, "-r", "dotenv/config", "server/index.ts"];
  const child = spawn("node", args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    env,
  });
  return { child, env };
}

async function stopChild(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32" && typeof child.pid === "number") {
    await run("taskkill", ["/PID", String(child.pid), "/T", "/F"], process.env);
    return;
  }

  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  if (!child.killed) child.kill("SIGKILL");
}

async function main() {
  const port = await pickPort();
  const baseUrl = `http://localhost:${port}`;
  const hmrPort = await allocateFreePort();
  const masterEmail =
    process.env.E2E_EMAIL || process.env.MASTER_ADMIN_EMAIL || "e2e-admin@tradescout.test";
  const masterPassword =
    process.env.E2E_PASSWORD || process.env.MASTER_ADMIN_PASSWORD || "e2e-admin-password";

  const laneEnv = {
    ...process.env,
    TEST_DATABASE_URL: testDatabaseUrl,
    DATABASE_URL: testDatabaseUrl,
    NODE_ENV: "test",
    SESSION_SECRET: process.env.SESSION_SECRET || "local-release-gates-session-secret",
    SCHEDULER_ENABLED: "false",
    VITE_HMR_PORT: String(hmrPort),
    MASTER_ADMIN_EMAIL: masterEmail,
    MASTER_ADMIN_PASSWORD: masterPassword,
    MASTER_ADMIN_FIRST_NAME: process.env.MASTER_ADMIN_FIRST_NAME || "E2E",
    MASTER_ADMIN_LAST_NAME: process.env.MASTER_ADMIN_LAST_NAME || "Admin",
    E2E_EMAIL: masterEmail,
    E2E_PASSWORD: masterPassword,
  };

  console.log(`[release-gates:local] Bootstrapping test DB schema...`);
  const bootstrapExit = await run("npm", ["run", "db:bootstrap:test"], laneEnv);
  if (bootstrapExit !== 0) process.exit(bootstrapExit);

  console.log(`[release-gates:local] Seeding E2E login user...`);
  const seedExit = await run("npm", ["run", "seed:e2e-user"], laneEnv);
  if (seedExit !== 0) process.exit(seedExit);

  console.log(`[release-gates:local] Starting server on ${baseUrl}...`);
  const { child: serverChild, env: serverEnv } = startServer(port, laneEnv);

  try {
    const healthy = await waitForHealthy(baseUrl, 120_000);
    if (!healthy) {
      console.error("");
      console.error(`[release-gates:local] Server did not become healthy: ${toHealthUrl(baseUrl)}`);
      console.error("[release-gates:local] Check server logs above, then rerun.");
      process.exit(1);
    }

    const viteReady = await waitForVite(baseUrl, 60_000);
    if (!viteReady) {
      console.error("");
      console.error(`[release-gates:local] Vite client did not become ready: ${baseUrl}/@vite/client`);
      console.error("[release-gates:local] The app may still be running, but UI-driven E2E will be flaky.");
      process.exit(1);
    }

    console.log(`[release-gates:local] Running Playwright release gates...`);
    const specs = [
      "tests/journeys/auth_buttons_present.spec.ts",
      "tests/journeys/pre_scout_auth_integrity.spec.ts",
      "tests/address-verification.smoke.spec.ts",
      "tests/direct-connect.e2e.spec.ts",
      "tests/scout-routing.e2e.spec.ts",
    ];

    const playwrightExit = await run(
      "npx",
      ["playwright", "test", ...specs, "--project=chromium"],
      {
        ...serverEnv,
        BASE_URL: baseUrl,
        E2E_BASE_URL: baseUrl,
      }
    );

    const reportExit = await run("npm", ["run", "report:release-gates"], {
      ...serverEnv,
      BASE_URL: baseUrl,
      E2E_BASE_URL: baseUrl,
    });

    await run("node", ["scripts/release-gate-summary.mjs"], process.env);

    process.exit(playwrightExit !== 0 ? playwrightExit : reportExit);
  } finally {
    await stopChild(serverChild);
  }
}

main().catch((error) => {
  console.error(
    "[release-gates:local] Unexpected failure:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
