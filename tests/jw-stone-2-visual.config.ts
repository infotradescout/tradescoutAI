import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const externalBaseURL = process.env.BASE_URL;
const baseURL = externalBaseURL || "http://127.0.0.1:4173";
const port = new URL(baseURL).port || "4173";

export default defineConfig({
  testDir: ".",
  testMatch: "jw-stone-2-visual.spec.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: path.resolve(process.cwd(), ".playwright", "jw-stone-2"),
  webServer: externalBaseURL
    ? undefined
    : {
        command: `node_modules/.bin/vite --host 127.0.0.1 --port ${port} --strictPort`,
        cwd: repositoryRoot,
        url: `${baseURL}/jw-stone`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          CHOKIDAR_INTERVAL: "1000",
          CHOKIDAR_USEPOLLING: "true",
          NODE_ENV: "development",
        },
      },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
