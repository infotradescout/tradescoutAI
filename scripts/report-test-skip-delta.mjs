import fs from "node:fs";
import path from "node:path";

function normalizePath(filePath) {
  return String(filePath || "").replace(/\\/g, "/");
}

function toWorkspaceRelative(filePath) {
  const normalized = normalizePath(filePath);
  const cwd = normalizePath(process.cwd());
  if (normalized.toLowerCase().startsWith(cwd.toLowerCase())) {
    return normalized.slice(cwd.length + 1);
  }
  return normalized;
}

function getArg(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function boolFromEnv(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function inferSkipReason(assertion) {
  const title = String(assertion?.title || "");
  const fullName = String(assertion?.fullName || "");
  const joined = `${title} ${fullName}`;

  const requiresMatch = joined.match(/requires\s+([A-Z0-9_]+)/i);
  if (requiresMatch?.[1]) return `requires_${requiresMatch[1]}`;

  if (joined.toLowerCase().includes("integration")) return "integration_guard";
  if (joined.toLowerCase().includes("e2e")) return "e2e_guard";
  return "unspecified_skip_guard";
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

const reportPath = path.resolve(
  getArg("report", process.env.VITEST_JSON_REPORT || "test-results/vitest-results.json")
);
const outputJsonPath = path.resolve(
  getArg("out", process.env.SKIP_DELTA_OUTPUT || "artifacts/test-skip-delta.json")
);
const outputMarkdownPath = path.resolve(
  getArg("markdown", process.env.SKIP_DELTA_MARKDOWN || "artifacts/test-skip-delta.md")
);
const baselinePath = getArg("baseline", process.env.SKIP_BASELINE_PATH || "");
const failOnIncrease = hasFlag("fail-on-increase") || boolFromEnv(process.env.SKIP_DELTA_FAIL_ON_INCREASE);

if (!fs.existsSync(reportPath)) {
  console.error(`[skip-delta] Missing Vitest report at ${reportPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const skippedByFile = {};
const skippedByReason = {};

for (const suite of report?.testResults || []) {
  const suiteFile = toWorkspaceRelative(suite?.name || "unknown");
  for (const assertion of suite?.assertionResults || []) {
    const status = String(assertion?.status || "").toLowerCase();
    if (status !== "skipped" && status !== "pending") continue;
    increment(skippedByFile, suiteFile);
    increment(skippedByReason, inferSkipReason(assertion));
  }
}

const current = {
  totalTests: Number(report?.numTotalTests || 0),
  passedTests: Number(report?.numPassedTests || 0),
  pendingTests: Number(report?.numPendingTests || 0),
  failedTests: Number(report?.numFailedTests || 0),
  totalSuites: Number(report?.numTotalTestSuites || 0),
  pendingSuites: Number(report?.numPendingTestSuites || 0),
};

let baseline = null;
if (baselinePath) {
  const resolved = path.resolve(baselinePath);
  if (fs.existsSync(resolved)) {
    const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
    baseline = {
      source: normalizePath(baselinePath),
      pendingTests: Number(parsed?.pendingTests || 0),
      pendingSuites: Number(parsed?.pendingSuites || 0),
      generatedAt: parsed?.generatedAt || null,
    };
  }
}

const delta = baseline
  ? {
      pendingTests: current.pendingTests - baseline.pendingTests,
      pendingSuites: current.pendingSuites - baseline.pendingSuites,
    }
  : null;

let status = "pass";
if (!baseline) {
  status = "no_baseline";
} else if (delta.pendingTests > 0) {
  status = failOnIncrease ? "fail" : "warn";
}

const topSkippedFiles = Object.entries(skippedByFile)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .map(([file, skipped]) => ({ file, skipped }));

const reasonCounts = Object.entries(skippedByReason)
  .sort((a, b) => b[1] - a[1])
  .map(([reason, count]) => ({ reason, count }));

const summary = {
  generatedAt: new Date().toISOString(),
  sourceReport: normalizePath(path.relative(process.cwd(), reportPath)),
  status,
  failOnIncrease,
  current,
  baseline,
  delta,
  reasonCounts,
  topSkippedFiles,
};

fs.mkdirSync(path.dirname(outputJsonPath), { recursive: true });
fs.writeFileSync(outputJsonPath, JSON.stringify(summary, null, 2));

const markdownLines = [
  "# Test Skip Delta",
  "",
  `Generated: ${summary.generatedAt}`,
  `Status: ${summary.status}`,
  "",
  "## Current",
  `- Pending tests: ${current.pendingTests}`,
  `- Pending suites: ${current.pendingSuites}`,
  `- Passed tests: ${current.passedTests}`,
  `- Failed tests: ${current.failedTests}`,
  "",
  "## Baseline",
  baseline
    ? `- Pending tests: ${baseline.pendingTests} (${baseline.source})`
    : "- None configured (set --baseline <path>)",
  baseline ? `- Pending suites: ${baseline.pendingSuites}` : "",
  baseline && baseline.generatedAt ? `- Baseline generated: ${baseline.generatedAt}` : "",
  "",
  "## Delta",
  baseline
    ? `- Pending tests delta: ${delta.pendingTests >= 0 ? "+" : ""}${delta.pendingTests}`
    : "- Delta unavailable (no baseline)",
  baseline
    ? `- Pending suites delta: ${delta.pendingSuites >= 0 ? "+" : ""}${delta.pendingSuites}`
    : "",
  "",
  "## Top Skip Reasons",
  ...(reasonCounts.length > 0
    ? reasonCounts.slice(0, 8).map((item) => `- ${item.reason}: ${item.count}`)
    : ["- none"]),
  "",
  "## Top Files",
  ...(topSkippedFiles.length > 0
    ? topSkippedFiles.slice(0, 10).map((item) => `- ${item.file}: ${item.skipped}`)
    : ["- none"]),
  "",
];

fs.mkdirSync(path.dirname(outputMarkdownPath), { recursive: true });
fs.writeFileSync(outputMarkdownPath, markdownLines.filter(Boolean).join("\n"));

console.log(`[skip-delta] wrote ${outputJsonPath}`);
console.log(`[skip-delta] wrote ${outputMarkdownPath}`);
console.log(
  `[skip-delta] pending tests: ${current.pendingTests}` +
    (delta ? ` (delta ${delta.pendingTests >= 0 ? "+" : ""}${delta.pendingTests})` : "")
);

if (status === "fail") {
  console.error("[skip-delta] pending tests increased against baseline");
  process.exit(1);
}
