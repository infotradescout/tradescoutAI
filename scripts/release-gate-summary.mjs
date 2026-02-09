import fs from "node:fs";
import path from "node:path";

const metricsPath = path.resolve("artifacts/release-gate-metrics.json");

if (!fs.existsSync(metricsPath)) {
  console.error(`[release-gates] metrics file not found: ${metricsPath}`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
const metrics = payload.metrics || {};
const gates = Object.keys(metrics);

function gateRow(name, data) {
  const passed = Number(data?.passed || 0);
  const failed = Number(data?.failed || 0);
  const skipped = Number(data?.skipped || 0);
  const status = failed > 0 || passed === 0 ? "FAIL" : "PASS";
  return `| ${name} | ${status} | ${passed} | ${failed} | ${skipped} |`;
}

const lines = [
  "## Release Gate Summary",
  "",
  `- Generated: ${payload.generatedAt || "unknown"}`,
  `- Overall: **${String(payload.status || "unknown").toUpperCase()}**`,
  "",
  "| Gate | Status | Passed | Failed | Skipped |",
  "| --- | --- | ---: | ---: | ---: |",
  ...gates.map((gate) => gateRow(gate, metrics[gate])),
];

if (Array.isArray(payload.failures) && payload.failures.length > 0) {
  lines.push("", "### Failures");
  for (const issue of payload.failures) lines.push(`- ${issue}`);
}

console.log(lines.join("\n"));
