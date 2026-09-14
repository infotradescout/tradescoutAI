/** Exact-source frontend and isolated property-edit verification; never production data. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { finishProofCli } from "./finish-proof-cli.mjs";
const files = [
  "client/src/pages/homeid/homeWorkspaceModel.test.ts",
  "client/src/pages/homeid/HomeOverview.render.test.tsx",
  "client/src/pages/homeid/homeIdentity.test.ts",
  "client/src/pages/homeid/homeRecordViewModel.test.ts",
  "client/src/pages/homeid/HomeRecordWorkspace.render.test.tsx",
  "client/src/scout/scout-entry-framing.contract.test.ts",
  "server/tests/home-identity-route.test.ts",
  "server/tests/homeid-focused-workspace.contract.test.ts",
  "server/tests/assetid-phase-1f-homeid-direct-connect-draft.contract.test.ts",
  "server/tests/assetid-phase-1g-homeid-draft-submit.contract.test.ts",
  "server/tests/homeid-direct-connect-cohesion.test.ts",
  "server/tests/first-use-guidance-production-smoke.contract.test.ts",
];
const out = path.resolve(process.env.CORE_UI_PROOF_DIR || "test-results/core-ui-proof");
const summary = { head: null, passed: false, startedAt: new Date().toISOString(), checks: [] };
const safeError = error => String(error.stack || error).replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "[DISPOSABLE_DATABASE]");
function readPassed(name) {
  const report = JSON.parse(fs.readFileSync(path.join(out, name), "utf8"));
  assert.equal(report.head, summary.head, `${name} must describe this exact commit`);
  assert.equal(report.passed, true, `${name} must pass`);
  for (const field of ["error", "cleanupError", "finalizationError"]) {
    assert.equal(report[field], undefined, `${name} must not contain ${field}`);
  }
  summary.checks.push({ report: name, passed: true });
  return report;
}
try {
  fs.mkdirSync(out, { recursive: true });
  summary.head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const result = spawnSync("npm", ["run", "test:run", "--", ...files], {
    stdio: "inherit", env: { ...process.env, DATABASE_URL: "", TEST_DATABASE_URL: "", RUN_INTEGRATION_TESTS: "", VITEST_SERIAL: "true" },
  });
  assert.equal(result.status, 0, "Focused Core UI tests must pass");
  for (const [script, name] of [
    ["./verify-core-ui-shell.mjs", "report.json"],
    ["./verify-homes-overview-browser.mjs", "homes-report.json"],
    ["./verify-home-record-workspaces-browser.mjs", "home-record-report.json"],
    ["./verify-home-identity-native.mjs", "home-identity-report.json"],
    ["./verify-core-ui-release.mjs", "minimum-release-report.json"],
  ]) {
    await import(script);
    // Some legacy stages leave passed=true after a late report-output failure.
    // Read their process verdict immediately, before another stage's database
    // cleanup can reset it, and also reject every recorded failure field.
    assert.equal(Number(process.exitCode ?? 0), 0, `${script} must exit successfully`);
    const report = readPassed(name);
    if (name === "report.json") {
      assert(report.checks.some(check => check.command === "npm run build" && check.code === 0));
    }
    if (name === "minimum-release-report.json") {
      assert.equal(report.evidence?.commit, summary.head);
      assert.equal(report.evidence?.mode, "release");
      assert.equal(report.evidence?.result, "pass");
      assert.equal(report.evidence?.attestable, true);
      assert.equal(report.evidence?.initialDirtyTree, false);
      assert.equal(report.evidence?.dirtyTree, false);
    }
  }
  assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), summary.head);
  assert.equal(execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(), "");
  summary.passed = true;
} catch (error) {
  summary.error = safeError(error);
} finally {
  summary.finishedAt = new Date().toISOString();
  try {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "upgrade-report.json"), JSON.stringify(summary, null, 2));
  } catch (error) {
    summary.passed = false;
    summary.finalizationError = safeError(error);
    try { fs.writeFileSync(path.join(out, "upgrade-report.json"), JSON.stringify(summary, null, 2)); } catch {}
  } finally {
    try { console.log("CORE_UI_UPGRADE_RESULT " + JSON.stringify(summary)); } catch (error) {
      summary.passed = false; summary.finalizationError = safeError(error);
      try { fs.writeFileSync(path.join(out, "upgrade-report.json"), JSON.stringify(summary, null, 2)); } catch {}
    }
    await finishProofCli(summary.passed ? 0 : 1);
  }
}
