import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { frontendItems } from "./split-workspaces.config.mjs";
import {
  assertCleanWorktree,
  assertSafeRepoRelative,
  classifyReportOnlyWarning,
  collectBloatMetrics,
  computeBaselineSnapshotSha256,
  computeBloatPolicySha256,
  evaluateBloatBudget,
  evaluateDockerContextContract,
  isDockerIgnored,
  measureOptionalDirectory,
  measureOptionalFile,
  measureProductionInstalledPackages,
  parseDockerignore,
  resolveWithinRepo,
} from "./bloat-metrics-core.mjs";

const BASELINE_REF = "a5329eae77698c439ea1a3fdc52d9c916b665b0a";

function temporaryDirectory(t) {
  const fixtureRoot = path.join(process.cwd(), "tmp");
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const directory = fs.mkdtempSync(path.join(fixtureRoot, "tradescout-bloat-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function writeFile(root, relativePath, contents) {
  const absolute = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, contents);
}

function commitAll(repoRoot, message = "fixture") {
  execFileSync("git", ["-C", repoRoot, "add", "."]);
  execFileSync("git", [
    "-C",
    repoRoot,
    "-c",
    "user.name=Bloat Test",
    "-c",
    "user.email=bloat@test.invalid",
    "commit",
    "-qm",
    message,
  ]);
}

function initializeFixture(repoRoot) {
  execFileSync("git", ["init", "-q", repoRoot]);
  commitAll(repoRoot);
}

function symlinkOrSkip(t, target, linkPath, type) {
  try {
    fs.symlinkSync(target, linkPath, type);
    return true;
  } catch (error) {
    if (error?.code === "EPERM" || error?.code === "EACCES") {
      t.skip("symlink creation is unavailable on this platform");
      return false;
    }
    throw error;
  }
}

test("supported root-relative .dockerignore patterns are deterministic and unsupported syntax fails", () => {
  const rules = parseDockerignore("node_modules\ndist\ndata\n*.log\nserver/logs\ndocs/**/draft?.md\n");
  assert.equal(isDockerIgnored("node_modules/pkg/index.js", rules), true);
  assert.equal(isDockerIgnored("nested/node_modules/pkg/index.js", rules), false);
  assert.equal(isDockerIgnored("data/export.json", rules), true);
  assert.equal(isDockerIgnored("server/logs/app.txt", rules), true);
  assert.equal(isDockerIgnored("debug.log", rules), true);
  assert.equal(isDockerIgnored("client/src/debug.log", rules), false);
  assert.equal(isDockerIgnored("docs/a/b/draft1.md", rules), true);
  assert.equal(isDockerIgnored("client/src/main.tsx", rules), false);
  assert.throws(() => parseDockerignore("!dist/keep.txt\n"), /Unsupported .dockerignore syntax/);
  assert.throws(() => parseDockerignore("[ab].txt\n"), /Unsupported .dockerignore syntax/);
  assert.throws(() => parseDockerignore("folder\\file\n"), /Unsupported .dockerignore syntax/);
  assert.throws(() => parseDockerignore("../outside\n"), /Unsupported .dockerignore path/);
  assert.throws(() => parseDockerignore("\uFEFFdist\n"), /byte-order mark/);
});

test("alternate Dockerfile-specific ignore files fail closed", (t) => {
  const repoRoot = temporaryDirectory(t);
  writeFile(repoRoot, ".dockerignore", "dist\n");
  writeFile(repoRoot, "build.Dockerfile.dockerignore", "secret\n");
  writeFile(repoRoot, "package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: {} }));
  initializeFixture(repoRoot);
  assert.throws(() => collectBloatMetrics(repoRoot), /Dockerfile-specific or nested/);
});

test("repository baseline matches exact current .dockerignore and Git storage totals", () => {
  const metrics = collectBloatMetrics(process.cwd(), {
    gitRef: BASELINE_REF,
    includeEnvironmentReports: false,
  });
  assert.deepEqual(metrics.tracked, {
    files: 5664,
    bytes: 305149888,
    uniqueBlobs: 4566,
    uniqueBytes: 195115609,
    repeatedBytes: 110034279,
    duplicateGroups: 1046,
    duplicateExtraPaths: 1098,
  });
  assert.deepEqual(metrics.dockerContextTracked, {
    files: 5059,
    bytes: 146513568,
    excludedFiles: 605,
    excludedBytes: 158636320,
  });
});

test("Docker context contract keeps build inputs and excludes non-build roots", () => {
  const rules = parseDockerignore(fs.readFileSync(new URL("../.dockerignore", import.meta.url), "utf8"));
  const entries = collectBloatMetrics(process.cwd(), {
    gitRef: BASELINE_REF,
    includeEnvironmentReports: false,
  });
  const tracked = execFileSync("git", ["ls-tree", "-r", "-z", "--name-only", "HEAD"], {
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
    .map((filePath) => ({ path: filePath }));
  const contract = evaluateDockerContextContract(tracked, rules);
  assert.equal(entries.source.resolvedCommit, BASELINE_REF);
  assert.deepEqual(contract.failures, []);
  assert.equal(contract.status, "PASS");
});

test("workspace splits and UI audits remain generated-only outputs", () => {
  assert.equal(frontendItems.includes("assets"), false);
  assert.equal(frontendItems.includes("client"), true);
  assert.equal(frontendItems.includes("shared"), true);

  for (const generatedPath of [
    "exports/workspaces/frontend/package.json",
    "tmp/local-preview.mjs",
    "artifacts/ui-surface-audit/ui-surface-audit.json",
  ]) {
    assert.doesNotThrow(() =>
      execFileSync("git", ["check-ignore", "--no-index", "--quiet", generatedPath], {
        cwd: process.cwd(),
      })
    );
  }

  assert.equal(fs.existsSync(path.join(process.cwd(), "ui-surface-audit.json")), false);
  assert.equal(fs.existsSync(path.join(process.cwd(), "ui-surface-audit.md")), false);
  assert.equal(fs.existsSync(path.join(process.cwd(), "types.ts")), true);
  assert.equal(fs.existsSync(path.join(process.cwd(), "scripts/verify-legacy-guard.js")), true);
});

test("Git blob accounting counts duplicate paths once and never follows a tracked symlink", (t) => {
  const parent = temporaryDirectory(t);
  const repoRoot = path.join(parent, "repo");
  fs.mkdirSync(repoRoot);
  writeFile(repoRoot, ".dockerignore", "dist\n*.log\n");
  writeFile(repoRoot, "package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: {} }));
  writeFile(repoRoot, "keep.txt", "same");
  writeFile(repoRoot, "keep-copy.txt", "same");
  writeFile(repoRoot, "dist/bundle.js", "ignored bundle");
  writeFile(repoRoot, "debug.log", "ignored log");
  writeFile(repoRoot, "client/public/logo.txt", "logo");
  writeFile(parent, "outside-secret.txt", "secret bytes must not be counted");
  if (!symlinkOrSkip(t, "../outside-secret.txt", path.join(repoRoot, "escape-link"), "file")) return;
  initializeFixture(repoRoot);

  const metrics = collectBloatMetrics(repoRoot);
  assert.equal(metrics.tracked.files, 8);
  assert.equal(metrics.dockerContextTracked.files, 6);
  assert.ok(metrics.tracked.uniqueBlobs < metrics.tracked.files);
  assert.ok(metrics.tracked.repeatedBytes >= Buffer.byteLength("same"));
  assert.ok(metrics.tracked.duplicateGroups >= 1);
  assert.ok(metrics.tracked.duplicateExtraPaths >= 1);
  assert.ok(metrics.tracked.bytes < fs.statSync(path.join(parent, "outside-secret.txt")).size + 250);
});

test("literal backslashes in Git paths are rejected instead of normalized", (t) => {
  if (process.platform === "win32") {
    t.skip("Windows does not permit a literal backslash in a filename");
    return;
  }
  const repoRoot = temporaryDirectory(t);
  writeFile(repoRoot, ".dockerignore", "");
  writeFile(repoRoot, "package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: {} }));
  writeFile(repoRoot, "bad\\name.txt", "bad");
  initializeFixture(repoRoot);
  assert.throws(() => collectBloatMetrics(repoRoot), /Backslashes are not allowed/);
  assert.throws(() => assertSafeRepoRelative("bad\\name.txt"), /Backslashes are not allowed/);
});

test("budget validation rejects subsets, extras, and every policy-contract mutation", (t) => {
  const baseline = collectBloatMetrics(process.cwd(), {
    gitRef: BASELINE_REF,
    includeEnvironmentReports: false,
  });
  const budget = JSON.parse(fs.readFileSync(new URL("./bloat-budget.json", import.meta.url), "utf8"));
  const atCeilings = structuredClone(baseline);
  for (const metric of Object.keys(budget.ceilings)) {
    const parts = metric.split(".");
    if (metric.startsWith("monolith:")) {
      const monolithPath = metric.slice("monolith:".length);
      atCeilings.monoliths[monolithPath].bytes = budget.ceilings[metric].maximum;
    } else if (parts.length === 2) {
      atCeilings[parts[0]][parts[1]] = budget.ceilings[metric].maximum;
    }
  }
  assert.equal(evaluateBloatBudget(atCeilings, budget, { baselineMetrics: baseline }).status, "PASS");
  assert.equal(evaluateBloatBudget(baseline, budget, { baselineMetrics: baseline }).status, "FAIL");
  assert.ok(
    Object.values(budget.ceilings).some((ceiling) => ceiling.delta < 0),
    "cleanup policy must contain negative ratchets"
  );

  const growth = structuredClone(baseline);
  growth.tracked.files = budget.ceilings["tracked.files"].maximum + 1;
  assert.equal(evaluateBloatBudget(growth, budget, { baselineMetrics: baseline }).status, "FAIL");

  const missing = structuredClone(budget);
  delete missing.ceilings["tracked.bytes"];
  assert.throws(
    () => evaluateBloatBudget(baseline, missing, { baselineMetrics: baseline }),
    /canonical set/
  );
  const extra = structuredClone(budget);
  extra.ceilings["unknown.metric"] = { baseline: 0, delta: 0, maximum: 0 };
  assert.throws(() => evaluateBloatBudget(baseline, extra, { baselineMetrics: baseline }), /canonical set/);
  const stale = structuredClone(budget);
  stale.ceilings["tracked.bytes"].baseline += 1;
  stale.ceilings["tracked.bytes"].maximum += 1;
  stale.baselineSnapshotSha256 = computeBaselineSnapshotSha256(stale);
  stale.policySha256 = computeBloatPolicySha256(stale);
  assert.throws(
    () => evaluateBloatBudget(baseline, stale, { baselineMetrics: baseline }),
    /canonical policy/
  );
  const below = structuredClone(budget);
  below.ceilings["tracked.bytes"].maximum -= 1;
  assert.throws(
    () => evaluateBloatBudget(atCeilings, below, { baselineMetrics: baseline }),
    /signed delta/
  );
  const raised = structuredClone(budget);
  raised.ceilings["tracked.bytes"].delta += 1;
  raised.ceilings["tracked.bytes"].maximum += 1;
  raised.policySha256 = computeBloatPolicySha256(raised);
  assert.throws(
    () => evaluateBloatBudget(baseline, raised, { baselineMetrics: baseline }),
    /canonical policy/
  );
  const invalidRef = structuredClone(budget);
  invalidRef.baselineGitRef = "f".repeat(40);
  invalidRef.baselineSnapshotSha256 = computeBaselineSnapshotSha256(invalidRef);
  invalidRef.policySha256 = computeBloatPolicySha256(invalidRef);
  assert.throws(
    () => evaluateBloatBudget(baseline, invalidRef, { repoRoot: temporaryDirectory(t) }),
    /canonical policy/
  );
  const badDigest = structuredClone(budget);
  badDigest.baselineSnapshotSha256 = "0".repeat(64);
  assert.throws(() => evaluateBloatBudget(baseline, badDigest, { baselineMetrics: baseline }), /snapshot digest/);
});

test("clean-worktree enforcement rejects tracked and untracked changes", (t) => {
  const repoRoot = temporaryDirectory(t);
  writeFile(repoRoot, "tracked.txt", "clean");
  initializeFixture(repoRoot);
  assert.doesNotThrow(() => assertCleanWorktree(repoRoot));
  writeFile(repoRoot, "tracked.txt", "dirty");
  assert.throws(() => assertCleanWorktree(repoRoot), /clean worktree/);
  commitAll(repoRoot, "tracked change");
  writeFile(repoRoot, "untracked.txt", "dirty");
  assert.throws(() => assertCleanWorktree(repoRoot), /clean worktree/);
});

test("missing build outputs are report-only and warning levels are exact", (t) => {
  const repoRoot = temporaryDirectory(t);
  assert.deepEqual(measureOptionalFile(repoRoot, "dist/index.js"), {
    path: "dist/index.js",
    present: false,
    files: 0,
    bytes: 0,
  });
  assert.deepEqual(measureOptionalDirectory(repoRoot, "dist/public"), {
    path: "dist/public",
    present: false,
    files: 0,
    bytes: 0,
  });
  assert.equal(classifyReportOnlyWarning(24_000_001, 24_000_000, true).status, "WARN");
  assert.equal(classifyReportOnlyWarning(24_000_000, 24_000_000, true).status, "OK");
  assert.equal(classifyReportOnlyWarning(0, 24_000_000, false).status, "NOT_AVAILABLE");
});

test("deterministic enforcement collection skips unsafe report-only filesystem trees", (t) => {
  const parent = temporaryDirectory(t);
  const repoRoot = path.join(parent, "repo");
  const outside = path.join(parent, "outside");
  fs.mkdirSync(repoRoot);
  writeFile(repoRoot, ".dockerignore", "dist\nnode_modules\n");
  writeFile(repoRoot, "package-lock.json", JSON.stringify({ lockfileVersion: 3, packages: {} }));
  initializeFixture(repoRoot);
  writeFile(outside, "index.js", "outside bytes");
  if (!symlinkOrSkip(t, outside, path.join(repoRoot, "dist"), "dir")) return;
  if (!symlinkOrSkip(t, outside, path.join(repoRoot, "node_modules"), "dir")) return;

  const metrics = collectBloatMetrics(repoRoot, { includeEnvironmentReports: false });
  assert.equal(metrics.source.environmentReports, "skipped-for-deterministic-enforcement");
  assert.equal(metrics.buildOutputs.distTotal.measurementSkipped, true);
  assert.equal(metrics.productionInstalledPackages.measurementSkipped, true);
  assert.throws(() => collectBloatMetrics(repoRoot), /Symlink or junction not allowed/);
});

test("filesystem measurements reject leaf and ancestor symlinks without exposing targets", (t) => {
  const parent = temporaryDirectory(t);
  writeFile(parent, "outside-file.txt", "sensitive fixture contents");
  const outsideDirectory = path.join(parent, "outside-directory");
  writeFile(outsideDirectory, "index.js", "outside bundle");

  const leafRepo = path.join(parent, "leaf-repo");
  fs.mkdirSync(path.join(leafRepo, "dist"), { recursive: true });
  if (!symlinkOrSkip(t, path.join(parent, "outside-file.txt"), path.join(leafRepo, "dist", "index.js"), "file")) return;
  assert.throws(() => measureOptionalFile(leafRepo, "dist/index.js"), /Symlink or junction not allowed/);

  const ancestorRepo = path.join(parent, "ancestor-repo");
  fs.mkdirSync(ancestorRepo);
  if (!symlinkOrSkip(t, outsideDirectory, path.join(ancestorRepo, "dist"), "dir")) return;
  for (const measure of [
    () => measureOptionalFile(ancestorRepo, "dist/index.js"),
    () => measureOptionalDirectory(ancestorRepo, "dist"),
  ]) {
    assert.throws(measure, (error) => {
      assert.match(error.message, /Symlink or junction not allowed/);
      assert.doesNotMatch(error.message, /outside-directory|outside bundle|sensitive fixture contents/);
      return true;
    });
  }
});

test("production package measurement rejects a node_modules ancestor symlink", (t) => {
  const parent = temporaryDirectory(t);
  const repoRoot = path.join(parent, "repo");
  const outside = path.join(parent, "outside-node-modules");
  fs.mkdirSync(repoRoot);
  writeFile(outside, "pkg/index.js", "outside package bytes");
  if (!symlinkOrSkip(t, outside, path.join(repoRoot, "node_modules"), "dir")) return;
  const lock = { packages: { "node_modules/pkg": {} } };
  assert.throws(() => measureProductionInstalledPackages(repoRoot, lock), (error) => {
    assert.match(error.message, /Symlink or junction not allowed/);
    assert.doesNotMatch(error.message, /outside-node-modules|outside package bytes/);
    return true;
  });
});

test("package scripts put focused tests before the clean-tree bloat guard", () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.scripts["report:bloat"], "node scripts/report-bloat.mjs");
  assert.equal(packageJson.scripts["guard:bloat"], "node scripts/report-bloat.mjs --enforce");
  assert.equal(packageJson.scripts["test:bloat"], "node --test scripts/bloat-metrics.test.mjs");
  assert.match(packageJson.scripts.verify, /^npm run test:bloat && npm run guard:bloat && npm run check/);
});
