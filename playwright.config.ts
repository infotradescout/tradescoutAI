import { defineConfig, devices } from "@playwright/test";
import path from "path";
import dotenv from "dotenv";

// Load test environment variables
dotenv.config({ path: "tests/.env" });
dotenv.config({ path: ".env.test" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const baseURL = process.env.BASE_URL || process.env.E2E_BASE_URL || "http://localhost:5002";
process.env.BASE_URL = baseURL;
process.env.E2E_BASE_URL = baseURL;
const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);
const baseUrlPort = (() => {
  try {
    const parsed = new URL(baseURL);
    return parsed.port && parsed.port.trim().length > 0 ? parsed.port : "5000";
  } catch {
    return "5000";
  }
})();

const serverCommand = hasTestDb
  ? "node scripts/withTestDb.mjs tsx -r dotenv/config server/index.ts"
  : "tsx -r dotenv/config server/index.ts";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,

  webServer: {
    command: serverCommand,
    // Use the API health endpoint so Playwright waits for the real
    // app+API server to be ready rather than a non-existent /health.
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: baseUrlPort,
      NODE_ENV: hasTestDb ? "test" : "development",
    },
  },

  globalSetup: hasTestDb ? "./tests/global-setup.ts" : undefined,

  outputDir: path.join(process.cwd(), ".playwright", "test-results"),

  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: ".playwright/test-results/results.json" }],
    ["junit", { outputFile: ".playwright/test-results/junit.xml" }],
    ["list"],
  ],

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    storageState: "tests/.auth/storageState.json",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
