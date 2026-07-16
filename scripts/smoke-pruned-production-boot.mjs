import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const nodeCmd = process.execPath;
const timeoutMs = Number(process.env.PRUNED_BOOT_SMOKE_TIMEOUT_MS || 90_000);
let baseUrl = "";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || root,
      env: options.env || process.env,
      stdio: options.stdio || "inherit",
      shell: options.shell ?? false,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function runNpmCi(cwd) {
  if (process.platform === "win32") {
    return run(process.env.ComSpec || "cmd.exe", [
      "/d",
      "/s",
      "/c",
      "npm ci --omit=dev --ignore-scripts",
    ], { cwd });
  }
  return run("npm", ["ci", "--omit=dev", "--ignore-scripts"], { cwd });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function waitForHttp(pathname, acceptableStatuses) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}${pathname}`);
      if (acceptableStatuses(res.status)) return res;
      lastError = new Error(`${pathname} returned ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw lastError || new Error(`${pathname} did not respond before timeout`);
}

function getFreePort() {
  if (process.env.PRUNED_BOOT_SMOKE_PORT) {
    return Promise.resolve(Number(process.env.PRUNED_BOOT_SMOKE_PORT));
  }
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function waitForEarlyExit(child) {
  return new Promise((_, reject) => {
    child.once("exit", (code, signal) => {
      reject(new Error(`production server exited before smoke completed (code=${code}, signal=${signal})`));
    });
  });
}

async function main() {
  const distDir = path.join(root, "dist");
  if (!(await exists(path.join(distDir, "index.js")))) {
    throw new Error("dist/index.js is missing. Run npm run build before this smoke.");
  }

  const databaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || "";
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL or TEST_DATABASE_URL is required for pruned production boot smoke"
    );
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tradescout-pruned-"));
  console.log(`[pruned-boot] staging production install in ${tempDir}`);

  await fs.copyFile(path.join(root, "package.json"), path.join(tempDir, "package.json"));
  await fs.copyFile(path.join(root, "package-lock.json"), path.join(tempDir, "package-lock.json"));
  await fs.cp(distDir, path.join(tempDir, "dist"), { recursive: true });

  await runNpmCi(tempDir);

  const vitePath = path.join(tempDir, "node_modules", "vite");
  if (await exists(vitePath)) {
    throw new Error("vite is present after npm ci --omit=dev");
  }

  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    DISABLE_CRAWLER: "true",
    SCHEDULER_ENABLED: "false",
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: process.env.SESSION_SECRET || "pruned-production-boot-smoke-only",
    REPLIT_DOMAINS: process.env.REPLIT_DOMAINS || `127.0.0.1:${port}`,
    APP_BASE_URL: process.env.APP_BASE_URL || baseUrl,
  };

  const child = spawn(nodeCmd, ["dist/index.js"], {
    cwd: tempDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[pruned-boot] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[pruned-boot] ${chunk}`));
  const earlyExit = waitForEarlyExit(child);

  try {
    const health = await Promise.race([
      waitForHttp("/api/health", (status) => status === 200),
      earlyExit,
    ]);
    const healthBody = await health.json().catch(() => ({}));
    console.log("[pruned-boot] health ok", {
      status: health.status,
      database: healthBody.database,
    });

    const profile = await Promise.race([
      waitForHttp("/u/jw-stone", (status) => status < 500),
      earlyExit,
    ]);
    console.log("[pruned-boot] public profile route responded", { status: profile.status });
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
    if (process.env.KEEP_PRUNED_BOOT_SMOKE_DIR !== "1") {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error("[pruned-boot] failed", error);
  process.exitCode = 1;
});
