/** Run the complete existing shell proof plus the property-first Homes regressions.
 * All API/browser fixtures are synthetic; this is not production or DB-backed release evidence.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
const result = spawnSync("npm", ["run", "test:run", "--", "client/src/pages/homeid/homeWorkspaceModel.test.ts", "client/src/pages/homeid/HomeOverview.render.test.tsx", "server/tests/homeid-focused-workspace.contract.test.ts"], {
  stdio: "inherit", env: { ...process.env, DATABASE_URL: "", TEST_DATABASE_URL: "", RUN_INTEGRATION_TESTS: "", VITEST_SERIAL: "true" },
});
if (result.status !== 0) {
  process.exitCode = 1;
} else {
  await import("./verify-core-ui-shell.mjs");
  const reportPath = path.resolve(process.env.CORE_UI_PROOF_DIR || ".core-ui-proof", "report.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  // A separate shell browser failure must not hide Homes diagnostics, but only
  // run them against a successful, exact-head build. Overall failure is retained.
  if (report.head === head && report.checks.some((check) => check.command === "npm run build" && check.code === 0)) {
    await import("./verify-homes-overview-browser.mjs");
  }
}
