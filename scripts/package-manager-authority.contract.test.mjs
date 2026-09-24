import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const allowedMigrationRecord = "docs/audits/DEPENDENCY_MANAGER_MIGRATION.md";
const infinityReuseProof = "vendor/infinity/reuse-proof.json";
const historicalInfinityInstall = "corepack pnpm install --frozen-lockfile";
const forbiddenManager = /(?:^|[\s"'`])(?:pnpm|yarn)(?:\s|$)/m;

function authorityScanContent(relative, content) {
  if (relative !== infinityReuseProof) return content;
  const proof = JSON.parse(content);
  // This one field records how Infinity's source was installed, not TradeScout guidance.
  if (proof?.checks?.sourceRepository?.install === historicalInfinityInstall) {
    proof.checks.sourceRepository.install = "[historical source installation]";
  }
  return JSON.stringify(proof);
}

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-co", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
}

test("npm and package-lock are the only package-manager authority", () => {
  assert.equal(packageJson.packageManager, "npm@10.8.2");
  assert.equal(fs.existsSync(path.join(root, "package-lock.json")), true);
  for (const forbiddenLock of ["pnpm-lock.yaml", "yarn.lock", "yarn-error.log"]) {
    assert.equal(fs.existsSync(path.join(root, forbiddenLock)), false, forbiddenLock);
  }
});

test("Infinity's recorded source install does not exempt other package-manager guidance", () => {
  const proof = JSON.parse(fs.readFileSync(path.join(root, infinityReuseProof), "utf8"));
  assert.equal(proof.checks.sourceRepository.install, historicalInfinityInstall);
  assert.equal(forbiddenManager.test(authorityScanContent(infinityReuseProof, JSON.stringify(proof))), false);

  proof.checks.sourceRepository.install = "corepack yarn install";
  assert.equal(forbiddenManager.test(authorityScanContent(infinityReuseProof, JSON.stringify(proof))), true);
  proof.checks.sourceRepository.install = historicalInfinityInstall;
  proof.consumerInstructions = "Use pnpm install";
  assert.equal(forbiddenManager.test(authorityScanContent(infinityReuseProof, JSON.stringify(proof))), true);
});

test("tracked commands and guidance do not reintroduce pnpm or yarn", () => {
  const violations = [];
  for (const relative of trackedFiles()) {
    if (relative === allowedMigrationRecord || relative === "scripts/package-manager-authority.contract.test.mjs") {
      continue;
    }
    if (/^(?:package-lock\.json|runtime\/package-lock\.json)$/.test(relative)) continue;
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const content = authorityScanContent(relative, fs.readFileSync(absolute, "utf8"));
    if (forbiddenManager.test(content)) violations.push(relative);
  }
  assert.deepEqual(violations, []);
});
