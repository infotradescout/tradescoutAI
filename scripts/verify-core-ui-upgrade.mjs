/** Exact-source frontend and isolated property-edit verification; never production data. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
const result = spawnSync("npm", ["run", "test:run", "--", "client/src/pages/homeid/homeWorkspaceModel.test.ts", "client/src/pages/homeid/HomeOverview.render.test.tsx", "client/src/pages/homeid/homeIdentity.test.ts", "server/tests/home-identity-route.test.ts", "server/tests/homeid-focused-workspace.contract.test.ts"], {
  stdio: "inherit", env: { ...process.env, DATABASE_URL: "", TEST_DATABASE_URL: "", RUN_INTEGRATION_TESTS: "", VITEST_SERIAL: "true" },
});
if (result.status !== 0) {
  process.exitCode = 1;
} else {
  await import("./verify-core-ui-shell.mjs");
  const reportPath = path.resolve(process.env.CORE_UI_PROOF_DIR || ".core-ui-proof", "report.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (report.head === head && report.checks.some((check) => check.command === "npm run build" && check.code === 0)) {
    await import("./verify-homes-overview-browser.mjs");
    await import("./verify-home-identity-native.mjs");
  }
}
