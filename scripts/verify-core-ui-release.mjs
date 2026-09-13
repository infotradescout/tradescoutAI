/** Run the unchanged strict release contract only after exact-head UI/database evidence exists.
 * Uses a second disposable loopback database. Does not attest GitHub status, merge or deploy production.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { startCabinetLoopbackTestDatabase } from "./start-cabinet-loopback-test-db.mjs";
import { finishProofCli } from "./finish-proof-cli.mjs";

const out = path.resolve(process.env.CORE_UI_PROOF_DIR || "test-results/core-ui-proof");
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const result = { head, passed: false, scope: "Unmodified release-mode gate with clean install, fresh loopback PostgreSQL, and previously executed exact-head browser evidence; no production smoke or deployment" };
let database;
try {
  for (const name of ["report.json", "homes-report.json", "home-record-report.json", "home-identity-report.json"]) {
    const report = JSON.parse(fs.readFileSync(path.join(out, name), "utf8"));
    assert.equal(report.head, head, `${name} must describe this exact commit`);
    assert.equal(report.passed, true, `${name} must pass before the release gate`);
  }
  for (const key of ["DATABASE_URL", "TEST_DATABASE_URL", "STRIPE_SECRET_KEY", "SENDGRID_API_KEY", "RESEND_API_KEY", "SMTP_PASS"]) {
    assert(!process.env[key], `Connected credentials are forbidden in this isolated check: ${key}`);
  }
  // Render's temporary local clone may omit origin/main or its older ancestors.
  // The unchanged readiness guard needs real canonical history, not a substituted ref.
  const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], { encoding: "utf8" }).trim() === "true";
  execFileSync("git", ["fetch", "--no-tags", ...(shallow ? ["--unshallow"] : []),
    "https://github.com/infotradescout/tradescoutAI.git", "main:refs/remotes/origin/main"], { stdio: "inherit" });
  assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), head);
  result.canonicalMain = execFileSync("git", ["rev-parse", "origin/main"], { encoding: "utf8" }).trim();
  database = await startCabinetLoopbackTestDatabase();
  result.database = database.evidence;
  const note = `Exact commit ${head}: executed Playwright shell, property overview, nine-section record and six-section package screens on desktop/mobile, plus canonical property editor with native PostgreSQL. Reports are report.json, homes-report.json, home-record-report.json and home-identity-report.json. Browser authentication and unrelated reads are fixtures; not live production or manual pixel review.`;
  const env = { ...process.env, NODE_ENV: "test", TEST_DATABASE_URL: database.url, DATABASE_URL: database.url,
    ALLOW_INSECURE_TEST_DATABASE: "true", TZ: "America/Chicago", VITEST_SERIAL: "true",
    SKIP_NPM_CI: "", BASE_URL: "", APP_URL: "", BROWSER_PROOF_NOTE: "" };
  // The gate's documented manual-evidence mode accepts an attested record of browser
  // execution; the note explicitly names the automated tests and their limitations.
  // This does not substitute invented evidence for an unexecuted browser check.
  const run = spawnSync("npm", ["run", "gate:minimum-release", "--", "--browser-proof=manual", `--browser-note=${note}`],
    { env, encoding: "utf8", timeout: 600000, maxBuffer: 50 * 1024 * 1024 });
  const log = `${run.stdout || ""}${run.stderr || ""}`.split(database.url).join("[DISPOSABLE_LOOPBACK_DATABASE]");
  fs.writeFileSync(path.join(out, "minimum-release.log"), log);
  console.log(log.slice(-26000));
  result.exitCode = run.status;
  const evidencePath = path.resolve("artifacts/release-contract", head.slice(0, 12), "evidence.json");
  if (fs.existsSync(evidencePath)) {
    const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
    fs.writeFileSync(path.join(out, "minimum-release-evidence.json"), JSON.stringify(evidence, null, 2));
    result.evidence = evidence;
  }
  assert.equal(run.status, 0, "Strict release contract failed; inspect minimum-release.log");
  assert.equal(result.evidence?.commit, head);
  assert.equal(result.evidence?.mode, "release");
  assert.equal(result.evidence?.result, "pass");
  assert.equal(result.evidence?.attestable, true);
  result.passed = true;
} catch (error) { result.error = String(error.stack || error); }
finally {
  try { await database?.stop(); } catch (error) {
    result.passed = false; result.cleanupError = String(error.stack || error);
  }
  try {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "minimum-release-report.json"), JSON.stringify(result, null, 2));
  } catch (error) {
    result.passed = false; result.finalizationError = String(error.stack || error);
    try { fs.writeFileSync(path.join(out, "minimum-release-report.json"), JSON.stringify(result, null, 2)); } catch {}
  } finally {
    try { console.log("CORE_UI_RELEASE_RESULT " + JSON.stringify(result)); } catch (error) {
      result.passed = false; result.finalizationError = String(error.stack || error);
      try { fs.writeFileSync(path.join(out, "minimum-release-report.json"), JSON.stringify(result, null, 2)); } catch {}
    }
    if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
      await finishProofCli(result.passed ? 0 : 1);
    } else if (!result.passed) {
      // Imported stages return the failure to the outer aggregate CLI. Only a
      // directly invoked command may terminate the hosting Node process.
      throw new Error("Core UI release verification failed: " + (result.error || result.cleanupError || result.finalizationError));
    }
  }
}
