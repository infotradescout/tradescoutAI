import fs from "node:fs";
import path from "node:path";
import {
  assertCleanWorktree,
  collectBloatMetrics,
  evaluateBloatBudget,
  resolveWithinRepo,
} from "./bloat-metrics-core.mjs";

function formatBytes(value) {
  if (value === null) return "not installed";
  return `${new Intl.NumberFormat("en-US").format(value)} B`;
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function parseArguments(argv) {
  const options = { enforce: false, json: false, gitRef: "HEAD", gitRefProvided: false };
  for (const argument of argv) {
    if (argument === "--enforce") options.enforce = true;
    else if (argument === "--json") options.json = true;
    else if (argument.startsWith("--git-ref=") && !options.gitRefProvided) {
      options.gitRef = argument.slice("--git-ref=".length);
      options.gitRefProvided = true;
    } else {
      throw new Error("Unknown or duplicate argument");
    }
  }
  if (!options.gitRef) throw new Error("Git report reference cannot be empty");
  if (options.enforce && options.gitRefProvided) {
    throw new Error("--git-ref is report-only and cannot be used with --enforce");
  }
  return options;
}

function printReportOnlyWarning(label, measurement, warning) {
  if (measurement.measurementSkipped) {
    console.log(`${label}: not scanned during deterministic enforcement; report-only`);
    return;
  }
  if (!measurement.present) {
    console.log(`${label}: not present; report-only warning level ${formatBytes(warning.warningBytes)}`);
    return;
  }
  console.log(
    `${label}: ${formatCount(measurement.files)} files, ${formatBytes(measurement.bytes)}; ` +
      `${warning.status}, report-only warning level ${formatBytes(warning.warningBytes)}`
  );
}

function printHuman(metrics, enforcement) {
  console.log(
    `TradeScout bloat report (${metrics.source.gitRef} -> ${metrics.source.resolvedCommit}; ` +
      `${metrics.source.trackedByteSource})`
  );
  console.log(`Tracked logical: ${formatCount(metrics.tracked.files)} paths, ${formatBytes(metrics.tracked.bytes)}`);
  console.log(
    `Tracked unique: ${formatCount(metrics.tracked.uniqueBlobs)} blobs, ${formatBytes(metrics.tracked.uniqueBytes)}`
  );
  console.log(
    `Tracked repetition: ${formatBytes(metrics.tracked.repeatedBytes)}, ` +
      `${formatCount(metrics.tracked.duplicateGroups)} duplicate groups, ` +
      `${formatCount(metrics.tracked.duplicateExtraPaths)} extra paths`
  );
  console.log(
    `Tracked Docker context estimate: ${formatCount(metrics.dockerContextTracked.files)} files, ` +
      `${formatBytes(metrics.dockerContextTracked.bytes)} ` +
      `(${formatCount(metrics.dockerContextTracked.excludedFiles)} files excluded by .dockerignore)`
  );
  console.log(
    `Docker context contract: ${metrics.dockerContextContract.status}` +
      (metrics.dockerContextContract.failures.length
        ? ` (${metrics.dockerContextContract.failures.join("; ")})`
        : "")
  );
  console.log(
    `Tracked client/public: ${formatCount(metrics.clientPublicTracked.files)} files, ` +
      formatBytes(metrics.clientPublicTracked.bytes)
  );
  console.log("Environment/build sizes (report-only warnings; not deterministic gates):");
  printReportOnlyWarning(
    "- Server bundle dist/index.js",
    metrics.buildOutputs.serverBundle,
    metrics.reportOnlyWarnings.serverBundle
  );
  printReportOnlyWarning(
    "- Client build dist/public",
    metrics.buildOutputs.public,
    metrics.reportOnlyWarnings.publicBuild
  );
  printReportOnlyWarning(
    "- Total dist",
    metrics.buildOutputs.distTotal,
    metrics.reportOnlyWarnings.distTotal
  );
  console.log("Monolith source sizes:");
  for (const [relativePath, measurement] of Object.entries(metrics.monoliths)) {
    console.log(`- ${relativePath}: ${measurement.present ? formatBytes(measurement.bytes) : "not present"}`);
  }

  const packages = metrics.productionInstalledPackages;
  console.log("Production-classified installed packages (platform-dependent):");
  if (packages.measurementSkipped) {
    console.log("- node_modules not scanned during deterministic enforcement; report-only");
  } else if (!packages.installationPresent) {
    console.log(
      `- node_modules not present; ${formatCount(packages.classifiedPackages)} lockfile packages classified; ` +
        `report-only warning level ${formatBytes(metrics.reportOnlyWarnings.productionPackagesPathLogical.warningBytes)}`
    );
  } else {
    console.log(
      `- ${formatCount(packages.installedPackages)}/${formatCount(packages.classifiedPackages)} packages, ` +
        `${formatCount(packages.files)} files, ${formatBytes(packages.bytes)} path-logical, ` +
        `${formatCount(packages.skippedSymlinks)} symlinks skipped; ` +
        `${metrics.reportOnlyWarnings.productionPackagesPathLogical.status}, report-only warning level ` +
        formatBytes(metrics.reportOnlyWarnings.productionPackagesPathLogical.warningBytes)
    );
  }

  if (enforcement) {
    console.log(`Budget baseline validation: ${enforcement.baselineValidation}`);
    for (const check of enforcement.checks) {
      console.log(
        `${check.status} ${check.metric}: ${formatCount(check.current)} <= ${formatCount(check.maximum)} ` +
          `(pinned baseline ${formatCount(check.baseline)}, signed delta ${formatCount(check.delta)})`
      );
    }
    console.log(`${enforcement.status} bloat budget`);
  }
}

function safeErrorMessage(error, repoRoot) {
  const message = error instanceof Error ? error.message : "Unknown measurement failure";
  return message.split(path.resolve(repoRoot)).join(".");
}

const repoRoot = process.cwd();

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.enforce) assertCleanWorktree(repoRoot);
  const metrics = collectBloatMetrics(repoRoot, {
    gitRef: options.gitRef,
    includeEnvironmentReports: !options.enforce,
  });
  let enforcement = null;

  if (options.enforce) {
    const budgetPath = resolveWithinRepo(repoRoot, "scripts/bloat-budget.json");
    const budget = JSON.parse(fs.readFileSync(budgetPath, "utf8"));
    enforcement = evaluateBloatBudget(metrics, budget, { repoRoot });
    if (metrics.dockerContextContract.status !== "PASS") {
      throw new Error(
        `Docker context contract failed: ${metrics.dockerContextContract.failures.join("; ")}`
      );
    }
  }

  if (options.json) {
    console.log(JSON.stringify(enforcement ? { ...metrics, enforcement } : metrics, null, 2));
  } else {
    printHuman(metrics, enforcement);
  }

  if (enforcement?.status === "FAIL") process.exitCode = 1;
} catch (error) {
  console.error(`FAIL bloat_report: ${safeErrorMessage(error, repoRoot)}`);
  process.exitCode = 1;
}
