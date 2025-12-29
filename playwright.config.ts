import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:5000";

const serverCommand = process.env.TEST_DATABASE_URL
  ? "node scripts/withTestDb.mjs cross-env NODE_ENV=test tsx -r dotenv/config server/index.ts"
  : "cross-env NODE_ENV=test tsx -r dotenv/config server/index.ts";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,

  webServer: {
    command: serverCommand,
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  globalSetup: "./tests/global-setup.ts",

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    storageState: "tests/.auth/storageState.json",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
