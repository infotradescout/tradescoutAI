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
  // Scan the original bytes, including duplicate JSON keys. Mask only the one flat
  // sourceRepository install field that records Infinity's historical setup.
  const historicalField = /("sourceRepository"\s*:\s*\{[^{}]*"install"\s*:\s*")corepack pnpm install --frozen-lockfile(")/g;
  const matches = [...content.matchAll(historicalField)];
  if (matches.length !== 1) return content;
  return content.replace(historicalField, "$1[historical source installation]$2");
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
  const raw = fs.readFileSync(path.join(root, infinityReuseProof), "utf8");
  const proof = JSON.parse(raw);
  assert.equal(proof.checks.sourceRepository.install, historicalInfinityInstall);
  assert.equal(forbiddenManager.test(authorityScanContent(infinityReuseProof, raw)), false);

  const alteredInstall = raw.replace(historicalInfinityInstall, "corepack yarn install");
  assert.equal(forbiddenManager.test(authorityScanContent(infinityReuseProof, alteredInstall)), true);
  const duplicateGuidance = raw.replace(
    '"sourceRepository": {',
    '"consumerInstructions": "Use pnpm install", "consumerInstructions": "Use npm", "sourceRepository": {'
  );
  assert.notEqual(duplicateGuidance, raw);
  assert.equal(forbiddenManager.test(authorityScanContent(infinityReuseProof, duplicateGuidance)), true);
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
