import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const allowedMigrationRecord = "docs/audits/DEPENDENCY_MANAGER_MIGRATION.md";
const historicalReceiptPath = "vendor/infinity/reuse-proof.json";
const historicalReceiptSha256 = "ff7d8634b97e3aa99d7365e2d4bd6295908d82e359c9fe66bd7a0a2d64fedb2d";

function hasForeignPackageManagerCommand(relative, content) {
  // This immutable receipt describes how the separate Infinity repository was
  // reproduced. It is not installation guidance for this npm-owned repository.
  // Only its verified historical install field is omitted; changed receipts,
  // current commands and every other field remain subject to the normal guard.
  const normalized = content.replace(/\r\n/g, "\n");
  if (
    relative === historicalReceiptPath &&
    createHash("sha256").update(normalized).digest("hex") === historicalReceiptSha256
  ) {
    const receipt = JSON.parse(normalized);
    assert.equal(
      receipt.source.repository,
      "https://github.com/infotradescout/tradescout-infinity"
    );
    assert.equal(receipt.source.revision, "8898e5a94722be2bf55351dd9772af7bd2ca173d");
    assert.equal(receipt.checks.cleanSourceReproduction.revision, receipt.source.revision);
    assert.equal(receipt.checks.cleanSourceReproduction.byteIdenticalArchive, true);
    assert.equal(
      receipt.checks.sourceRepository.install,
      "corepack pnpm install --frozen-lockfile"
    );
    delete receipt.checks.sourceRepository.install;
    content = JSON.stringify(receipt);
  }
  return /(?:^|[\s"'`])(?:pnpm|yarn)(?:\s|$)/m.test(content);
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

test("tracked commands and guidance do not reintroduce pnpm or yarn", () => {
  const violations = [];
  for (const relative of trackedFiles()) {
    if (
      relative === allowedMigrationRecord ||
      relative === "scripts/package-manager-authority.contract.test.mjs"
    ) {
      continue;
    }
    if (/^(?:package-lock\.json|runtime\/package-lock\.json)$/.test(relative)) continue;
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) continue;
    const content = fs.readFileSync(absolute, "utf8");
    if (hasForeignPackageManagerCommand(relative, content)) violations.push(relative);
  }
  assert.deepEqual(violations, []);
});

test("historical external receipt allowance cannot authorize current commands", () => {
  const content = fs.readFileSync(path.join(root, historicalReceiptPath), "utf8");
  assert.equal(hasForeignPackageManagerCommand(historicalReceiptPath, content), false);
  assert.equal(
    hasForeignPackageManagerCommand(historicalReceiptPath, content.replace(/\r?\n/g, "\r\n")),
    false
  );
  assert.equal(hasForeignPackageManagerCommand("README.md", content), true);
  for (const command of ["pnpm install", "yarn install"]) {
    assert.equal(hasForeignPackageManagerCommand("README.md", command), true);
    assert.equal(
      hasForeignPackageManagerCommand("vendor/current-setup.json", JSON.stringify({ command })),
      true
    );
    const changed = JSON.parse(content);
    changed.currentTradeScoutSetup = command;
    assert.equal(
      hasForeignPackageManagerCommand(historicalReceiptPath, JSON.stringify(changed)),
      true
    );
  }
  const changedOwner = JSON.parse(content);
  changedOwner.source.repository = "https://github.com/infotradescout/tradescoutAI";
  assert.equal(
    hasForeignPackageManagerCommand(historicalReceiptPath, JSON.stringify(changedOwner)),
    true
  );
  assert.equal(hasForeignPackageManagerCommand("README.md", "npm ci"), false);
});
