import { spawn } from "node:child_process";

const baseUrl = process.env.BASE_URL || process.env.E2E_BASE_URL || "http://localhost:5000";
const healthUrl = `${baseUrl.replace(/\/+$/, "")}/api/health`;

const releaseGateSpecs = [
  "tests/journeys/auth_buttons_present.spec.ts",
  "tests/address-verification.smoke.spec.ts",
  "tests/direct-connect.e2e.spec.ts",
  "tests/scout-routing.e2e.spec.ts",
];

async function checkHealth(url) {
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

function runPlaywright() {
  return new Promise((resolve) => {
    const args = ["playwright", "test", ...releaseGateSpecs, "--project=chromium"];
    const child = spawn("npx", args, {
      stdio: "inherit",
      shell: true,
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const healthy = await checkHealth(healthUrl);
  if (!healthy) {
    console.error("");
    console.error(`[release-gates] Could not reach ${healthUrl}`);
    console.error("[release-gates] Start TradeScout first, then rerun:");
    console.error("  npm run dev");
    console.error("  npm run test:release-gates");
    console.error("");
    process.exit(1);
  }

  const exitCode = await runPlaywright();
  process.exit(exitCode);
}

main().catch((error) => {
  console.error(
    "[release-gates] Unexpected failure:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
