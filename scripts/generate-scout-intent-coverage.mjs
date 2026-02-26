import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const REGISTRY_PATH = path.join(ROOT, "scout-behavior-registry.json");
const OUTPUT_PATH = path.join(ROOT, "SCOUT_INTENT_COVERAGE.md");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function toMarkdownTable(rows) {
  if (!rows.length) return "_No entries found._";

  const header = [
    "| ID | Surface | Label | Test Coverage |",
    "| --- | --- | --- | --- |",
  ];

  const body = rows.map((row) => {
    const tests = row.tests.length > 0 ? `${row.tests.length} tests` : "0 tests";
    return `| ${row.id} | ${row.surface} | ${row.label.replace(/\|/g, "\\|")} | ${tests} |`;
  });

  return [...header, ...body].join("\n");
}

function run() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    throw new Error(`Missing registry file: ${REGISTRY_PATH}`);
  }

  const registry = readJson(REGISTRY_PATH);
  const entries = Array.isArray(registry.entries) ? registry.entries : [];

  const normalized = entries.map((entry) => ({
    id: String(entry.id || "unknown"),
    surface: String(entry.surface || "unknown"),
    label: String(entry.label || "(no label)"),
    tests: Array.isArray(entry.tests) ? entry.tests : [],
    targetBelief: String(entry.targetBelief || ""),
    targetBehavior: String(entry.targetBehavior || ""),
    riskPrevented: String(entry.riskPrevented || ""),
  }));

  const bySurface = normalized.reduce(
    (acc, entry) => {
      acc[entry.surface] = (acc[entry.surface] || 0) + 1;
      return acc;
    },
    {}
  );

  const missingTests = normalized.filter((entry) => entry.tests.length === 0);

  const dated = new Date().toISOString();
  const summaryLines = [
    "# Scout Intent Coverage",
    "",
    `Generated: ${dated}`,
    `Registry Version: ${registry.version || "unknown"}`,
    "",
    "## Summary",
    `- Total registered behaviors: ${normalized.length}`,
    `- Client behaviors: ${bySurface.client || 0}`,
    `- Server behaviors: ${bySurface.server || 0}`,
    `- Behaviors without mapped tests: ${missingTests.length}`,
    "",
    "## Representation Signal",
    "- Target belief: Scout behavior is deliberate and test-governed.",
    "- Target behavior: teams verify maturity with concrete coverage, not claims.",
    "- Principle: transparency through measurable evidence.",
    "- Risk prevented: under-representing existing system depth.",
    "",
    "## Coverage Table",
    toMarkdownTable(normalized),
    "",
    "## Missing Test Mapping",
  ];

  if (missingTests.length === 0) {
    summaryLines.push("- None");
  } else {
    for (const entry of missingTests) {
      summaryLines.push(`- ${entry.id} (${entry.surface})`);
    }
  }

  summaryLines.push("", "## Belief/Behavior Contract", "");

  for (const entry of normalized) {
    summaryLines.push(`### ${entry.id}`);
    summaryLines.push(`- Label: ${entry.label}`);
    summaryLines.push(`- Target belief: ${entry.targetBelief || "(not specified)"}`);
    summaryLines.push(`- Target behavior: ${entry.targetBehavior || "(not specified)"}`);
    summaryLines.push(`- Risk prevented: ${entry.riskPrevented || "(not specified)"}`);
    summaryLines.push("");
  }

  fs.writeFileSync(OUTPUT_PATH, `${summaryLines.join("\n")}\n`, "utf-8");
  console.log(`[scout-intent-coverage] wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
}

run();
