import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { runVerifiedMigration, DATABASE_RECOVERY_GUIDANCE } from "../lib/verified-migration-runner.mjs";

const run = (migrate, verify) => runVerifiedMigration({ migrate, verify, report: () => {} });
test("a successful SQL command is not success when schema verification fails", async () => {
  assert.equal(await run(async () => 0, async () => 1), 1);
});
test("success requires both the SQL command and schema proof, in that order", async () => {
  const calls = [];
  assert.equal(await run(async () => { calls.push("sql"); return 0; }, async () => { calls.push("verify"); return 0; }), 0);
  assert.deepEqual(calls, ["sql", "verify"]);
});
test("failed SQL is neither retried nor baselined, and its exit code is retained", async () => {
  let calls = 0;
  assert.equal(await run(async () => { calls++; return 7; }, async () => { assert.fail("must not verify failed SQL"); }), 7);
  assert.equal(calls, 1);
});
test("a thrown SQL error remains a failure", async () => {
  await assert.rejects(run(async () => { throw new Error("synthetic SQL failure"); }, async () => 0), /synthetic SQL failure/);
});
test("a thrown verification error remains a failure", async () => {
  await assert.rejects(run(async () => 0, async () => { throw new Error("synthetic verification failure"); }), /synthetic verification failure/);
});
test("missing or invalid child-process statuses cannot pass", async () => {
  for (const value of [undefined, null, -1, NaN, "0", 0.5]) {
    await assert.rejects(run(async () => value, async () => 0), /valid exit status/);
    await assert.rejects(run(async () => 0, async () => value), /valid exit status/);
  }
});
test("failure guidance separates base prerequisites from current successors", () => {
  for (const text of ["users", "businesses", "user_profiles", "profiles", "0118_profile_account_public_routes", "0129_restore_profile_account_identity_contract", "0131_preserve_jw_stone_pricing_revocation", "not a complete empty-database bootstrap recipe", "LF/CRLF"]) {
    assert.ok(DATABASE_RECOVERY_GUIDANCE.includes(text), text);
  }
  assert.match(DATABASE_RECOVERY_GUIDANCE, /older backfills can erase current entitlement decisions/);
});
test("the retired baseline refuses without attempting a database connection", () => {
  const result = spawnSync(process.execPath, ["scripts/db-baseline-drizzle.mjs"], {
    encoding: "utf8", env: { ...process.env, DATABASE_URL: "not-a-database-url", TEST_DATABASE_URL: "" }, timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /recording the latest migration without executing it/);
  const source = fs.readFileSync("scripts/db-baseline-drizzle.mjs", "utf8");
  assert.doesNotMatch(source, /new Client|client\.query|from ["']pg["']/);
});
test("the migration runner uses an independent verifier and contains no baseline shortcut", () => {
  const source = fs.readFileSync("scripts/db-migrate-safe.mjs", "utf8");
  assert.match(source, /check-required-production-schema\.mjs/);
  assert.match(source, /DATABASE_URL: dbUrl/);
  assert.doesNotMatch(source, /baselineEntrypoint|migrationCount|insert into drizzle|Attempting baseline/);
});
test("gap recovery rejects the unsafe mark flag and contains no mark-on-error branch", () => {
  const result = spawnSync(process.execPath, ["scripts/db-migrate-fill-gaps.mjs", "--mark-already-applied"], {
    encoding: "utf8", env: { ...process.env, DATABASE_URL: "not-a-database-url", TEST_DATABASE_URL: "" }, timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /one duplicate object does not prove/);
  assert.doesNotMatch(fs.readFileSync("scripts/db-migrate-fill-gaps.mjs", "utf8"), /if \(markAlreadyApplied/);
});
test("all original required-schema SQL and predicates are preserved exactly", () => {
  const original = spawnSync("git", ["show", "908d2d4e2c76141ffe2cdcfa52e756dfb52fae84:scripts/check-required-production-schema.mjs"], { encoding: "utf8" });
  assert.equal(original.status, 0, "the release-base verifier must be available for comparison");
  const current = fs.readFileSync("scripts/check-required-production-schema.mjs", "utf8");
  const allowed = original.stdout
    .replace('import pg from "pg";\n', 'import pg from "pg";\nimport { DATABASE_RECOVERY_GUIDANCE } from "./lib/verified-migration-runner.mjs";\n')
    .replace(/        "Recover by reconciling[\s\S]*?"migrations\/0130_business_managed_partner_contact\.sql before deployment\.",/, "        DATABASE_RECOVERY_GUIDANCE,");
  assert.equal(current.trimEnd(), allowed.trimEnd(), "only the diagnostic import and guidance may change");
});
