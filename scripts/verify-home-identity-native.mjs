import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { startCabinetLoopbackTestDatabase } from "./start-cabinet-loopback-test-db.mjs";
import { finishProofCli } from "./finish-proof-cli.mjs";

const out = path.resolve(process.env.CORE_UI_PROOF_DIR || "test-results/core-ui-proof");
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const build = JSON.parse(fs.readFileSync(path.join(out, "report.json"), "utf8"));
assert.equal(build.head, head);
assert(build.checks.some((entry) => entry.command === "npm run build" && entry.code === 0));
for (const key of ["DATABASE_URL", "TEST_DATABASE_URL", "STRIPE_SECRET_KEY", "SENDGRID_API_KEY", "RESEND_API_KEY", "SMTP_PASS"]) {
  assert(!process.env[key], `${key} must not be inherited by the isolated property-edit proof`);
}
let database;
const report = { head, passed: false, scope: "Fresh loopback PostgreSQL and actual property-edit router; browser identity is a test fixture, not production authentication", steps: [] };
try {
  database = await startCabinetLoopbackTestDatabase();
  report.database = database.evidence;
  const env = { ...process.env, NODE_ENV: "test", TEST_DATABASE_URL: database.url, DATABASE_URL: database.url, ALLOW_INSECURE_TEST_DATABASE: "true", TZ: "America/Chicago", HOME_IDENTITY_PROOF_DIR: out };
  for (const [label, command, args] of [
    ["Fresh schema migrations", "npm", ["run", "db:migrate"]],
    ["Required schema verification", "npm", ["run", "db:verify:required"]],
    ["Native property-edit and browser proof", "node", ["--import", "tsx", "scripts/tests/home-identity.native.ts"]],
  ]) {
    const result = spawnSync(command, args, { env, encoding: "utf8", timeout: 300000, maxBuffer: 40 * 1024 * 1024 });
    const log = ((result.stdout || "") + (result.stderr || "")).split(database.url).join("[ISOLATED_TEST_DATABASE]");
    fs.writeFileSync(path.join(out, `identity-${report.steps.length + 1}.log`), log);
    report.steps.push({ label, status: result.status });
    console.log(`HOME_IDENTITY_STEP ${label}: ${result.status}\n${log.slice(-10000)}`);
    assert.equal(result.status, 0, label);
  }
  report.native = JSON.parse(fs.readFileSync(path.join(out, "home-identity-native.json"), "utf8"));
  assert.equal(report.native.head, head); assert.equal(report.native.passed, true);
  report.passed = true;
} catch (error) { report.error = String(error.stack || error); }
finally {
  try { await database?.stop(); } catch (error) {
    report.passed = false; report.cleanupError = String(error.stack || error);
  }
  try {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, "home-identity-report.json"), JSON.stringify(report, null, 2));
  } catch (error) {
    report.passed = false; report.finalizationError = String(error.stack || error);
    try { fs.writeFileSync(path.join(out, "home-identity-report.json"), JSON.stringify(report, null, 2)); } catch {}
  } finally {
    try { console.log("HOME_IDENTITY_RESULT " + JSON.stringify(report)); } catch (error) {
      report.passed = false; report.finalizationError = String(error.stack || error);
      try { fs.writeFileSync(path.join(out, "home-identity-report.json"), JSON.stringify(report, null, 2)); } catch {}
    }
    if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
      await finishProofCli(report.passed ? 0 : 1);
    } else if (!report.passed) {
      throw new Error("Native property verification failed: " + (report.error || report.cleanupError || report.finalizationError));
    }
  }
}
