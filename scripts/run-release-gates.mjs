import { runCommand } from "./lib/subprocess.mjs";

const explicitBaseUrl = process.env.BASE_URL || process.env.E2E_BASE_URL || null;
const defaultBaseUrl = "http://localhost:5000";

const releaseGateSpecs = [
  "tests/journeys/auth_buttons_present.spec.ts",
  "tests/journeys/pre_scout_auth_integrity.spec.ts",
  "tests/address-verification.smoke.spec.ts",
  "tests/direct-connect.e2e.spec.ts",
  "tests/scout-routing.e2e.spec.ts",
];

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

async function resolveBaseUrl() {
  const preferred = explicitBaseUrl || defaultBaseUrl;
  if (await checkHealth(preferred)) {
    return preferred;
  }

  // In CI, Playwright owns server startup through playwright.config.ts webServer.
  // Do not fail the gate before Playwright has a chance to boot the app.
  if (process.env.CI === "true") {
    return preferred;
  }

  // Only scan fallback local ports when BASE_URL/E2E_BASE_URL was not explicitly provided.
  if (explicitBaseUrl) {
    return null;
  }

  for (let port = 5000; port <= 5010; port += 1) {
    const candidate = `http://localhost:${port}`;
    if (candidate === preferred) continue;
    if (await checkHealth(candidate)) {
      return candidate;
    }
  }

  return null;
}

function runPlaywright(baseUrl) {
  const args = ["playwright", "test", ...releaseGateSpecs, "--project=chromium"];
  return runCommand("npx", args, {
    stdio: "inherit",
    env: {
      ...process.env,
      BASE_URL: baseUrl,
      E2E_BASE_URL: baseUrl,
      RELEASE_GATES: "true",
    },
  });
}

async function main() {
  const resolvedBaseUrl = await resolveBaseUrl();
  if (!resolvedBaseUrl) {
    const expected = explicitBaseUrl || defaultBaseUrl;
    console.error("");
    console.error(`[release-gates] Could not reach ${toHealthUrl(expected)}`);
    console.error("[release-gates] Start TradeScout first, then rerun:");
    console.error("  npm run dev");
    console.error("  npm run test:release-gates");
    console.error("");
    process.exit(1);
  }

  console.log(`[release-gates] Using BASE_URL=${resolvedBaseUrl}`);

  const gateTestSpecs = ["server/tests/direct-connect-gates.regression.test.ts"];
  if (process.env.TEST_DATABASE_URL) {
    gateTestSpecs.push("server/tests/direct-connect-gates.integration.test.ts");
  }

  const gateTestsExit = await runCommand("npm", ["run", "test:run", "--", ...gateTestSpecs], {
    stdio: "inherit",
    env: process.env,
  });
  if (gateTestsExit !== 0) process.exit(gateTestsExit);

  const exitCode = await runPlaywright(resolvedBaseUrl);
  process.exit(exitCode);
}

main().catch((error) => {
  console.error(
    "[release-gates] Unexpected failure:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
