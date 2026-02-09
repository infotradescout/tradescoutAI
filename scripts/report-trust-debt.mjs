import fs from "node:fs";
import path from "node:path";

const prodPath = path.resolve("artifacts/trust-debt-production.json");
const secretsPath = path.resolve("artifacts/trust-debt-secrets-history.json");

function readReport(filePath, fallbackName) {
  if (!fs.existsSync(filePath)) {
    return {
      name: fallbackName,
      status: "error",
      findings: [],
      error: `Missing report: ${filePath}`,
    };
  }
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return {
    name: fallbackName,
    status: payload.status || "error",
    findings: payload.findings || [],
    error: payload.error,
  };
}

const production = readReport(prodPath, "production_debt");
const secrets = readReport(secretsPath, "secrets_history");
const checks = [production, secrets];

const hasFailure = checks.some((c) => c.status !== "pass");

const lines = [
  "## Trust Debt Summary",
  "",
  "| Check | Status | Findings |",
  "| --- | --- | ---: |",
];

for (const check of checks) {
  lines.push(`| ${check.name} | ${String(check.status).toUpperCase()} | ${check.findings.length} |`);
}

for (const check of checks) {
  if (check.findings.length > 0) {
    lines.push("", `### ${check.name} findings`);
    for (const finding of check.findings) {
      if (typeof finding === "string") {
        lines.push(`- ${finding}`);
      } else if (finding?.path) {
        lines.push(`- ${finding.path}${finding.commits ? ` (${finding.commits} commits)` : ""}`);
      } else {
        lines.push(`- ${JSON.stringify(finding)}`);
      }
    }
  }
  if (check.error) {
    lines.push("", `### ${check.name} error`, `- ${check.error}`);
  }
}

console.log(lines.join("\n"));
process.exit(hasFailure ? 1 : 0);
