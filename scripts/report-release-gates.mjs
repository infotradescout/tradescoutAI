import fs from "node:fs";
import path from "node:path";

const reportPath = path.resolve(".playwright/test-results/results.json");
const outputDir = path.resolve("artifacts");
const outputPath = path.join(outputDir, "release-gate-metrics.json");

const gateFileMatchers = [
  {
    gate: "account_creation",
    matches: [
      "journeys/auth_buttons_present.spec.ts",
      "journeys/pre_scout_auth_integrity.spec.ts",
    ],
  },
  {
    gate: "direct_connect",
    matches: ["direct-connect.e2e.spec.ts"],
  },
  {
    gate: "verification",
    matches: ["address-verification.smoke.spec.ts"],
  },
  {
    gate: "scout_routing",
    matches: ["scout-routing.e2e.spec.ts"],
  },
];

function normalizeFile(filePath) {
  return String(filePath || "").replace(/\\/g, "/");
}

function resolveGateFromFile(filePath) {
  const normalized = normalizeFile(filePath).replace(/^\.?\/?/, "");
  for (const entry of gateFileMatchers) {
    for (const match of entry.matches) {
      if (normalized === match || normalized.endsWith(`/${match}`)) {
        return entry.gate;
      }
    }
  }
  return null;
}

function ensureGateMetrics() {
  return {
    account_creation: { passed: 0, failed: 0, skipped: 0 },
    direct_connect: { passed: 0, failed: 0, skipped: 0 },
    verification: { passed: 0, failed: 0, skipped: 0 },
    scout_routing: { passed: 0, failed: 0, skipped: 0 },
  };
}

function statusBucket(status) {
  if (status === "passed") return "passed";
  if (status === "skipped" || status === "interrupted") return "skipped";
  return "failed";
}

function collectResults(node, metrics, currentFile = "") {
  const nextFile = node?.file ? normalizeFile(node.file) : currentFile;
  const gate = resolveGateFromFile(nextFile);

  if (gate && Array.isArray(node?.tests)) {
    for (const test of node.tests) {
      if (!Array.isArray(test?.results) || test.results.length === 0) {
        metrics[gate].skipped += 1;
        continue;
      }
      let final = "skipped";
      for (const result of test.results) {
        final = result?.status || final;
        if (final === "passed") break;
      }
      metrics[gate][statusBucket(final)] += 1;
    }
  }

  if (Array.isArray(node?.suites)) {
    for (const suite of node.suites) collectResults(suite, metrics, nextFile);
  }
  if (Array.isArray(node?.specs)) {
    for (const spec of node.specs) collectResults(spec, metrics, nextFile);
  }
}

if (!fs.existsSync(reportPath)) {
  console.error(`[release-gates] Missing Playwright JSON report: ${reportPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const metrics = ensureGateMetrics();
collectResults(report, metrics);

const requiredGates = Object.keys(metrics);
const failures = [];
for (const gate of requiredGates) {
  const gateMetrics = metrics[gate];
  const totalExecuted = gateMetrics.passed + gateMetrics.failed;
  if (totalExecuted === 0) {
    if (gateMetrics.skipped > 0) {
      failures.push(
        `${gate}: no executed tests (${gateMetrics.skipped} skipped; check E2E prerequisites such as TEST_DATABASE_URL)`
      );
    } else {
      failures.push(`${gate}: no executed tests`);
    }
  }
  if (gateMetrics.failed > 0) failures.push(`${gate}: ${gateMetrics.failed} failed`);
}

const summary = {
  generatedAt: new Date().toISOString(),
  metrics,
  passRate:
    requiredGates.filter((gate) => {
      const gateMetrics = metrics[gate];
      return gateMetrics.failed === 0 && gateMetrics.passed > 0;
    }).length / requiredGates.length,
  status: failures.length === 0 ? "pass" : "fail",
  failures,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));

console.log("[release-gates] metrics written:", outputPath);
console.log("[release-gates] status:", summary.status);
if (failures.length > 0) {
  for (const issue of failures) console.error(`[release-gates] ${issue}`);
  process.exit(1);
}
