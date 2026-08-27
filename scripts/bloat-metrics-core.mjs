import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

export const MONOLITH_PATHS = Object.freeze([
  "server/routes.ts",
  "server/routes/direct-connect.ts",
  "server/storage.ts",
  "shared/schema.ts",
]);

export const BLOAT_BUDGET_METRIC_KEYS = Object.freeze([
  "tracked.files",
  "tracked.bytes",
  "tracked.uniqueBlobs",
  "tracked.uniqueBytes",
  "tracked.repeatedBytes",
  "tracked.duplicateGroups",
  "tracked.duplicateExtraPaths",
  "dockerContextTracked.files",
  "dockerContextTracked.bytes",
  "clientPublicTracked.files",
  "clientPublicTracked.bytes",
  ...MONOLITH_PATHS.map((relativePath) => `monolith:${relativePath}`),
]);

export const REPORT_ONLY_WARNING_LEVELS = Object.freeze({
  serverBundleBytes: 24_000_000,
  publicBuildBytes: 41_000_000,
  distTotalBytes: 65_000_000,
  productionPackagePathLogicalBytes: 625_000_000,
});

export const CANONICAL_BASELINE_GIT_REF = "3ebe93911ed988942e6c5f6966fafe1fee7a5cbd";
export const CANONICAL_BLOAT_POLICY_SHA256 =
  "36270374cf986106e480d37dd3879d1cdce4b89499752caa2e981bcd879cf856";

const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;

function normalizeRepoRelative(relativePath) {
  return String(relativePath).replace(/\\/g, "/");
}

export function assertSafeRepoRelative(relativePath) {
  const rawPath = String(relativePath);
  if (rawPath.includes("\\")) throw new Error("Backslashes are not allowed in repository-relative paths");
  const normalized = rawPath;
  const parts = normalized.split("/");

  if (
    !normalized ||
    normalized.includes("\0") ||
    path.posix.isAbsolute(normalized) ||
    parts.some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error("Unsafe repository-relative path");
  }

  return normalized;
}

export function resolveWithinRepo(repoRoot, relativePath) {
  const normalized = assertSafeRepoRelative(relativePath);
  const resolvedRoot = path.resolve(repoRoot);
  const resolved = path.resolve(resolvedRoot, ...normalized.split("/"));
  const prefix = `${resolvedRoot}${path.sep}`;

  if (!resolved.startsWith(prefix)) {
    throw new Error("Unsafe repository-relative path");
  }

  return resolved;
}

export function assertSafeFilesystemPath(repoRoot, relativePath) {
  const safePath = assertSafeRepoRelative(relativePath);
  const resolvedRoot = path.resolve(repoRoot);
  const absolutePath = resolveWithinRepo(resolvedRoot, safePath);
  let rootStat;

  try {
    rootStat = fs.lstatSync(resolvedRoot);
  } catch {
    throw new Error("Repository root is unavailable for measurement");
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("Repository root must be a real directory");
  }

  const realRoot = fs.realpathSync(resolvedRoot);
  let currentPath = resolvedRoot;
  const components = safePath.split("/");

  for (let index = 0; index < components.length; index += 1) {
    currentPath = path.join(currentPath, components[index]);
    let stat;
    try {
      stat = fs.lstatSync(currentPath);
    } catch (error) {
      if (error?.code === "ENOENT") return { absolutePath, exists: false };
      throw new Error(`Unable to validate measured path: ${components.slice(0, index + 1).join("/")}`);
    }

    const checkedPath = components.slice(0, index + 1).join("/");
    if (stat.isSymbolicLink()) {
      throw new Error(`Symlink or junction not allowed in measured path: ${checkedPath}`);
    }
    const realCurrent = fs.realpathSync(currentPath);
    if (realCurrent !== realRoot && !realCurrent.startsWith(`${realRoot}${path.sep}`)) {
      throw new Error(`Measured path escapes repository: ${checkedPath}`);
    }
  }

  return { absolutePath, exists: true };
}

function assertSafeGitRef(gitRef) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/@{}^~:+-]*$/.test(gitRef)) {
    throw new Error("Unsafe Git reference");
  }
  return gitRef;
}

function runGit(repoRoot, args) {
  const result = spawnSync("git", ["-C", path.resolve(repoRoot), ...args], {
    encoding: null,
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error || result.status !== 0) {
    throw new Error(`Git measurement command failed: ${args[0] || "unknown"}`);
  }

  return result.stdout;
}

export function resolveGitCommit(repoRoot, gitRef = "HEAD") {
  const safeRef = assertSafeGitRef(gitRef);
  const resolved = runGit(repoRoot, ["rev-parse", "--verify", `${safeRef}^{commit}`])
    .toString("utf8")
    .trim();
  if (!/^[0-9a-f]{40}$/.test(resolved)) throw new Error("Git reference did not resolve to a commit");
  return resolved;
}

export function assertCleanWorktree(repoRoot) {
  const status = runGit(repoRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (status.length > 0) {
    throw new Error("Bloat enforcement requires a clean worktree (tracked and untracked files)");
  }
}

function gitCommitExists(repoRoot, commitOid) {
  const result = spawnSync(
    "git",
    ["-C", path.resolve(repoRoot), "cat-file", "-e", `${commitOid}^{commit}`],
    { encoding: null, stdio: ["ignore", "pipe", "pipe"] }
  );
  if (result.error) throw new Error("Unable to validate baseline Git commit");
  return result.status === 0;
}

export function readGitTree(repoRoot, gitRef = "HEAD") {
  const safeRef = assertSafeGitRef(gitRef);
  const output = runGit(repoRoot, ["ls-tree", "-r", "-z", "-l", safeRef]);
  const entries = [];

  for (const rawEntry of output.toString("utf8").split("\0")) {
    if (!rawEntry) continue;
    const tabIndex = rawEntry.indexOf("\t");
    if (tabIndex === -1) throw new Error("Unexpected Git tree entry");

    const metadata = rawEntry.slice(0, tabIndex);
    const relativePath = assertSafeRepoRelative(rawEntry.slice(tabIndex + 1));
    const match = metadata.match(/^(\d+)\s+(blob|commit)\s+([0-9a-f]+)\s+(\d+|-)$/);
    if (!match) throw new Error("Unexpected Git tree metadata");

    entries.push({
      path: relativePath,
      mode: match[1],
      type: match[2],
      oid: match[3],
      bytes: match[4] === "-" ? 0 : Number(match[4]),
    });
  }

  return entries.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

function readGitFile(repoRoot, gitRef, relativePath) {
  const safeRef = assertSafeGitRef(gitRef);
  const safePath = assertSafeRepoRelative(relativePath);
  return runGit(repoRoot, ["show", `${safeRef}:${safePath}`]);
}

function escapeRegex(character) {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
}

function dockerGlobToRegexSource(pattern) {
  let source = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*") {
      const isDouble = pattern[index + 1] === "*";
      if (isDouble) {
        index += 1;
        if (pattern[index + 1] === "/") {
          index += 1;
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
    } else if (character === "?") {
      source += "[^/]";
    } else {
      source += escapeRegex(character);
    }
  }

  return source;
}

export function parseDockerignore(source) {
  const rules = [];
  const text = String(source);
  if (text.startsWith("\uFEFF")) throw new Error("Unsupported .dockerignore byte-order mark");
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("!") || /[\\[\]]/.test(line)) {
      throw new Error(`Unsupported .dockerignore syntax at line ${lineIndex + 1}`);
    }
    line = line.replace(/^\/+|\/+$/g, "");
    if (!line || line === ".") continue;
    if (line.split("/").some((component) => !component || component === "." || component === "..")) {
      throw new Error(`Unsupported .dockerignore path at line ${lineIndex + 1}`);
    }

    const globSource = dockerGlobToRegexSource(line);
    const expression = new RegExp(`^${globSource}(?:$|/)`);
    rules.push({ expression });
  }

  return rules;
}

export function isDockerIgnored(relativePath, rules) {
  const normalized = assertSafeRepoRelative(relativePath);
  let ignored = false;

  for (const rule of rules) {
    if (rule.expression.test(normalized)) ignored = true;
  }

  return ignored;
}

function summarizeEntries(entries) {
  return {
    files: entries.length,
    bytes: entries.reduce((total, entry) => total + entry.bytes, 0),
  };
}

function summarizeTrackedEntries(entries) {
  const logical = summarizeEntries(entries);
  const blobs = new Map();

  for (const entry of entries) {
    if (entry.type !== "blob") continue;
    const existing = blobs.get(entry.oid);
    if (existing) {
      existing.paths += 1;
    } else {
      blobs.set(entry.oid, { bytes: entry.bytes, paths: 1 });
    }
  }

  const duplicateBlobs = [...blobs.values()].filter((blob) => blob.paths > 1);
  const uniqueBytes = [...blobs.values()].reduce((total, blob) => total + blob.bytes, 0);
  return {
    ...logical,
    uniqueBlobs: blobs.size,
    uniqueBytes,
    repeatedBytes: logical.bytes - uniqueBytes,
    duplicateGroups: duplicateBlobs.length,
    duplicateExtraPaths: duplicateBlobs.reduce((total, blob) => total + blob.paths - 1, 0),
  };
}

function absentMeasurement(relativePath) {
  return { path: relativePath, present: false, files: 0, bytes: 0 };
}

export function measureOptionalFile(repoRoot, relativePath) {
  const safePath = assertSafeRepoRelative(relativePath);
  const validated = assertSafeFilesystemPath(repoRoot, safePath);
  if (!validated.exists) return absentMeasurement(safePath);
  const absolutePath = validated.absolutePath;
  let stat;

  try {
    stat = fs.lstatSync(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT") return absentMeasurement(safePath);
    throw new Error(`Unable to measure optional file: ${safePath}`);
  }

  if (stat.isSymbolicLink()) throw new Error(`Symlink not allowed in measured path: ${safePath}`);
  if (!stat.isFile()) throw new Error(`Expected a regular measured file: ${safePath}`);
  return { path: safePath, present: true, files: 1, bytes: stat.size };
}

function walkMeasuredDirectory(rootPath, currentPath, relativePath, totals) {
  const names = fs.readdirSync(currentPath).sort((left, right) => left.localeCompare(right, "en"));

  for (const name of names) {
    const absolute = path.join(currentPath, name);
    const relative = normalizeRepoRelative(path.relative(rootPath, absolute));
    const stat = fs.lstatSync(absolute);

    if (stat.isSymbolicLink()) {
      throw new Error(`Symlink not allowed in measured path: ${relativePath}/${relative}`);
    }
    if (stat.isDirectory()) {
      walkMeasuredDirectory(rootPath, absolute, relativePath, totals);
    } else if (stat.isFile()) {
      totals.files += 1;
      totals.bytes += stat.size;
    } else {
      throw new Error(`Non-regular entry not allowed in measured path: ${relativePath}/${relative}`);
    }
  }
}

export function measureOptionalDirectory(repoRoot, relativePath) {
  const safePath = assertSafeRepoRelative(relativePath);
  const validated = assertSafeFilesystemPath(repoRoot, safePath);
  if (!validated.exists) return absentMeasurement(safePath);
  const absolutePath = validated.absolutePath;
  let stat;

  try {
    stat = fs.lstatSync(absolutePath);
  } catch (error) {
    if (error?.code === "ENOENT") return absentMeasurement(safePath);
    throw new Error(`Unable to measure optional directory: ${safePath}`);
  }

  if (stat.isSymbolicLink()) throw new Error(`Symlink not allowed in measured path: ${safePath}`);
  if (!stat.isDirectory()) throw new Error(`Expected a measured directory: ${safePath}`);

  const totals = { files: 0, bytes: 0 };
  walkMeasuredDirectory(absolutePath, absolutePath, safePath, totals);
  return { path: safePath, present: true, ...totals };
}

function walkPackageFiles(packageRoot, currentPath, totals) {
  const names = fs.readdirSync(currentPath).sort((left, right) => left.localeCompare(right, "en"));

  for (const name of names) {
    if (name === "node_modules") continue;
    const absolute = path.join(currentPath, name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      totals.skippedSymlinks += 1;
    } else if (stat.isDirectory()) {
      walkPackageFiles(packageRoot, absolute, totals);
    } else if (stat.isFile()) {
      totals.files += 1;
      totals.bytes += stat.size;
    }
  }
}

function productionPackagePaths(packageLock) {
  return Object.entries(packageLock?.packages || {})
    .filter(([packagePath, metadata]) => packagePath.startsWith("node_modules/") && metadata?.dev !== true)
    .map(([packagePath]) => assertSafeRepoRelative(packagePath))
    .sort((left, right) => left.localeCompare(right, "en"));
}

export function measureProductionInstalledPackages(repoRoot, packageLock) {
  const packagePaths = productionPackagePaths(packageLock);
  const nodeModules = assertSafeFilesystemPath(repoRoot, "node_modules");

  if (!nodeModules.exists) {
    return {
      platformDependent: true,
      classification: "package-lock entries where dev is not true",
      installationPresent: false,
      classifiedPackages: packagePaths.length,
      installedPackages: 0,
      missingPackages: packagePaths.length,
      files: null,
      bytes: null,
      byteAccounting: "path-logical",
      skippedSymlinks: 0,
    };
  }

  if (!fs.lstatSync(nodeModules.absolutePath).isDirectory()) {
    throw new Error("node_modules must be a real directory for measurement");
  }

  const totals = { files: 0, bytes: 0, skippedSymlinks: 0 };
  let installedPackages = 0;

  for (const packagePath of packagePaths) {
    const validated = assertSafeFilesystemPath(repoRoot, packagePath);
    if (!validated.exists) continue;
    const absolutePath = validated.absolutePath;
    let stat;
    try {
      stat = fs.lstatSync(absolutePath);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw new Error("Unable to measure installed production package");
    }

    if (stat.isSymbolicLink()) {
      totals.skippedSymlinks += 1;
      continue;
    }
    if (!stat.isDirectory()) continue;
    installedPackages += 1;
    walkPackageFiles(absolutePath, absolutePath, totals);
  }

  return {
    platformDependent: true,
    classification: "package-lock entries where dev is not true",
    installationPresent: true,
    classifiedPackages: packagePaths.length,
    installedPackages,
    missingPackages: packagePaths.length - installedPackages,
    byteAccounting: "path-logical",
    ...totals,
  };
}

function skippedProductionInstalledPackages(packageLock) {
  const classifiedPackages = productionPackagePaths(packageLock).length;
  return {
    platformDependent: true,
    classification: "package-lock entries where dev is not true",
    measurementSkipped: true,
    skipReason: "environment-dependent scans are disabled during deterministic enforcement",
    installationPresent: false,
    classifiedPackages,
    installedPackages: 0,
    missingPackages: classifiedPackages,
    files: null,
    bytes: null,
    byteAccounting: "path-logical",
    skippedSymlinks: 0,
  };
}

export function classifyReportOnlyWarning(currentBytes, warningBytes, available) {
  return {
    reportOnly: true,
    warningBytes,
    currentBytes: available ? currentBytes : null,
    status: !available ? "NOT_AVAILABLE" : currentBytes > warningBytes ? "WARN" : "OK",
  };
}

export function collectBloatMetrics(
  repoRoot,
  { gitRef = "HEAD", includeEnvironmentReports = true } = {}
) {
  const resolvedCommit = resolveGitCommit(repoRoot, gitRef);
  const entries = readGitTree(repoRoot, resolvedCommit);
  const alternateDockerignores = entries.filter(
    (entry) => entry.path !== ".dockerignore" && entry.path.endsWith(".dockerignore")
  );
  if (alternateDockerignores.length > 0) {
    throw new Error("Dockerfile-specific or nested .dockerignore files are unsupported");
  }
  const tracked = summarizeTrackedEntries(entries);
  const dockerignoreSource = readGitFile(repoRoot, resolvedCommit, ".dockerignore").toString("utf8");
  const dockerignoreRules = parseDockerignore(dockerignoreSource);
  const dockerEntries = entries.filter((entry) => !isDockerIgnored(entry.path, dockerignoreRules));
  const dockerContextTracked = {
    ...summarizeEntries(dockerEntries),
    excludedFiles: tracked.files - dockerEntries.length,
    excludedBytes: tracked.bytes - dockerEntries.reduce((total, entry) => total + entry.bytes, 0),
  };
  const clientPublicEntries = entries.filter((entry) => entry.path.startsWith("client/public/"));
  const clientPublicTracked = {
    path: "client/public",
    present: clientPublicEntries.length > 0,
    ...summarizeEntries(clientPublicEntries),
  };
  const entryByPath = new Map(entries.map((entry) => [entry.path, entry]));
  const monoliths = Object.fromEntries(
    MONOLITH_PATHS.map((monolithPath) => {
      const entry = entryByPath.get(monolithPath);
      return [monolithPath, { present: Boolean(entry), bytes: entry?.bytes || 0 }];
    })
  );
  const packageLock = JSON.parse(readGitFile(repoRoot, resolvedCommit, "package-lock.json").toString("utf8"));
  const skippedBuild = (relativePath) => ({
    ...absentMeasurement(relativePath),
    measurementSkipped: true,
    skipReason: "environment-dependent scans are disabled during deterministic enforcement",
  });
  const serverBundle = includeEnvironmentReports
    ? measureOptionalFile(repoRoot, "dist/index.js")
    : skippedBuild("dist/index.js");
  const publicBuild = includeEnvironmentReports
    ? measureOptionalDirectory(repoRoot, "dist/public")
    : skippedBuild("dist/public");
  const distTotal = includeEnvironmentReports
    ? measureOptionalDirectory(repoRoot, "dist")
    : skippedBuild("dist");
  const productionInstalledPackages = includeEnvironmentReports
    ? measureProductionInstalledPackages(repoRoot, packageLock)
    : skippedProductionInstalledPackages(packageLock);

  return {
    schemaVersion: 1,
    source: {
      gitRef,
      resolvedCommit,
      trackedByteSource: "Git blob sizes",
      dockerIgnoreSource: ".dockerignore",
      environmentReports: includeEnvironmentReports
        ? "filesystem-scanned"
        : "skipped-for-deterministic-enforcement",
    },
    tracked,
    dockerContextTracked,
    clientPublicTracked,
    buildOutputs: {
      serverBundle,
      public: publicBuild,
      distTotal,
    },
    monoliths,
    productionInstalledPackages,
    reportOnlyWarnings: {
      note: "Build and installed-package sizes are environment-dependent reports, not deterministic gates.",
      serverBundle: classifyReportOnlyWarning(
        serverBundle.bytes,
        REPORT_ONLY_WARNING_LEVELS.serverBundleBytes,
        serverBundle.present
      ),
      publicBuild: classifyReportOnlyWarning(
        publicBuild.bytes,
        REPORT_ONLY_WARNING_LEVELS.publicBuildBytes,
        publicBuild.present
      ),
      distTotal: classifyReportOnlyWarning(
        distTotal.bytes,
        REPORT_ONLY_WARNING_LEVELS.distTotalBytes,
        distTotal.present
      ),
      productionPackagesPathLogical: classifyReportOnlyWarning(
        productionInstalledPackages.bytes,
        REPORT_ONLY_WARNING_LEVELS.productionPackagePathLogicalBytes,
        productionInstalledPackages.installationPresent
      ),
    },
  };
}

export function getBloatBudgetMetric(metrics, metricName) {
  if (metricName === "tracked.files") return metrics.tracked.files;
  if (metricName === "tracked.bytes") return metrics.tracked.bytes;
  if (metricName === "tracked.uniqueBlobs") return metrics.tracked.uniqueBlobs;
  if (metricName === "tracked.uniqueBytes") return metrics.tracked.uniqueBytes;
  if (metricName === "tracked.repeatedBytes") return metrics.tracked.repeatedBytes;
  if (metricName === "tracked.duplicateGroups") return metrics.tracked.duplicateGroups;
  if (metricName === "tracked.duplicateExtraPaths") return metrics.tracked.duplicateExtraPaths;
  if (metricName === "dockerContextTracked.files") return metrics.dockerContextTracked.files;
  if (metricName === "dockerContextTracked.bytes") return metrics.dockerContextTracked.bytes;
  if (metricName === "clientPublicTracked.files") return metrics.clientPublicTracked.files;
  if (metricName === "clientPublicTracked.bytes") return metrics.clientPublicTracked.bytes;

  const monolithPrefix = "monolith:";
  if (metricName.startsWith(monolithPrefix)) {
    const relativePath = metricName.slice(monolithPrefix.length);
    return metrics.monoliths[relativePath]?.bytes;
  }

  throw new Error(`Unknown bloat budget metric: ${metricName}`);
}

export function computeBaselineSnapshotSha256(budget) {
  const metrics = Object.fromEntries(
    BLOAT_BUDGET_METRIC_KEYS.map((metric) => [metric, budget?.ceilings?.[metric]?.baseline])
  );
  const payload = JSON.stringify({
    schemaVersion: 1,
    baselineGitRef: budget?.baselineGitRef,
    metrics,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function computeBloatPolicySha256(budget) {
  const ceilings = Object.fromEntries(
    BLOAT_BUDGET_METRIC_KEYS.map((metric) => {
      const ceiling = budget?.ceilings?.[metric];
      return [
        metric,
        {
          baseline: ceiling?.baseline,
          allowance: ceiling?.allowance,
          maximum: ceiling?.maximum,
        },
      ];
    })
  );
  const payload = JSON.stringify({
    schemaVersion: 1,
    baselineGitRef: budget?.baselineGitRef,
    ceilings,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function evaluateBloatBudget(metrics, budget, { repoRoot, baselineMetrics } = {}) {
  if (
    budget?.schemaVersion !== 1 ||
    typeof budget?.ceilings !== "object" ||
    !/^[0-9a-f]{40}$/.test(budget?.baselineGitRef || "") ||
    !/^[0-9a-f]{64}$/.test(budget?.baselineSnapshotSha256 || "") ||
    !/^[0-9a-f]{64}$/.test(budget?.policySha256 || "")
  ) {
    throw new Error("Unsupported bloat budget schema");
  }

  const expectedKeys = [...BLOAT_BUDGET_METRIC_KEYS].sort();
  const actualKeys = Object.keys(budget.ceilings).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error("Bloat budget metric keys do not match the canonical set");
  }
  if (
    budget.baselineGitRef !== CANONICAL_BASELINE_GIT_REF ||
    budget.policySha256 !== CANONICAL_BLOAT_POLICY_SHA256 ||
    computeBloatPolicySha256(budget) !== CANONICAL_BLOAT_POLICY_SHA256
  ) {
    throw new Error("Bloat budget does not match the code-pinned canonical policy");
  }
  if (computeBaselineSnapshotSha256(budget) !== budget.baselineSnapshotSha256) {
    throw new Error("Bloat budget baseline snapshot digest does not match");
  }

  let recomputedBaseline = baselineMetrics || null;
  let baselineValidation = baselineMetrics ? "git-ref-recomputed" : "snapshot-digest";
  if (!recomputedBaseline && repoRoot && gitCommitExists(repoRoot, budget.baselineGitRef)) {
    recomputedBaseline = collectBloatMetrics(repoRoot, {
      gitRef: budget.baselineGitRef,
      includeEnvironmentReports: false,
    });
    baselineValidation = "git-ref-recomputed";
  }
  if (!recomputedBaseline && !repoRoot) {
    throw new Error("Bloat budget baseline was not independently validated");
  }
  if (recomputedBaseline && recomputedBaseline.source?.resolvedCommit !== budget.baselineGitRef) {
    throw new Error("Bloat budget baseline commit was not independently recomputed");
  }

  const checks = BLOAT_BUDGET_METRIC_KEYS.map((metric) => {
    const ceiling = budget.ceilings[metric];
    if (
      !Number.isSafeInteger(ceiling?.baseline) ||
      !Number.isSafeInteger(ceiling?.allowance) ||
      !Number.isSafeInteger(ceiling?.maximum) ||
      ceiling.baseline < 0 ||
      ceiling.allowance < 0
    ) {
      throw new Error(`Invalid bloat budget ceiling: ${metric}`);
    }
    if (ceiling.maximum < ceiling.baseline) {
      throw new Error(`Bloat budget maximum is below baseline: ${metric}`);
    }
    if (ceiling.maximum !== ceiling.baseline + ceiling.allowance) {
      throw new Error(`Bloat budget allowance does not equal maximum: ${metric}`);
    }

    if (recomputedBaseline) {
      const recomputed = getBloatBudgetMetric(recomputedBaseline, metric);
      if (ceiling.baseline !== recomputed) {
        throw new Error(`Bloat budget baseline does not match ${budget.baselineGitRef}: ${metric}`);
      }
    }

    const current = getBloatBudgetMetric(metrics, metric);
    if (!Number.isSafeInteger(current) || current < 0) {
      throw new Error(`Bloat metric is unavailable: ${metric}`);
    }

    return {
      metric,
      baseline: ceiling.baseline,
      allowance: ceiling.allowance,
      maximum: ceiling.maximum,
      current,
      status: current <= ceiling.maximum ? "PASS" : "FAIL",
    };
  });

  return {
    status: checks.some((check) => check.status === "FAIL") ? "FAIL" : "PASS",
    baselineValidation,
    checks,
  };
}
