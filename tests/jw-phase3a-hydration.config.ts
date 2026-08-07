import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:5057";

export default defineConfig({
  testDir: ".",
  testMatch: "jw-phase3a-hydration.spec.ts",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: path.resolve(process.cwd(), ".playwright", "jw-phase3a"),
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
