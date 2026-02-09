import fs from "node:fs";
import path from "node:path";

const root = path.resolve("server");
const exts = new Set([".ts", ".tsx", ".js", ".mjs"]);
const suspiciousFragments = [
  "unauthorized",
  "forbidden",
  "access denied",
  "not found",
  "missing",
  "required",
  "invalid request",
  "validation",
  "already",
  "conflict",
  "not allowed",
  "must be",
  "cannot",
  "bad request",
];

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (exts.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function scanFile(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const findings = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/status\s*\(\s*500\s*\)/.test(line)) continue;
    const context = [line, lines[i + 1] || "", lines[i + 2] || ""].join(" ").toLowerCase();
    const matched = suspiciousFragments.find((fragment) => context.includes(fragment));
    if (!matched) continue;
    findings.push({
      file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
      line: i + 1,
      matched,
      snippet: line.trim(),
    });
  }
  return findings;
}

const files = walk(root);
const findings = files.flatMap(scanFile);

if (findings.length === 0) {
  console.log("[http-semantics] no suspicious 500 status handlers found");
  process.exit(0);
}

console.error("[http-semantics] suspicious 500 status handlers found:");
for (const finding of findings) {
  console.error(
    `  - ${finding.file}:${finding.line} matched "${finding.matched}" :: ${finding.snippet}`
  );
}
console.error(
  "\nUse 4xx for client/guard/validation outcomes. Reserve 500 for true server faults."
);
process.exit(1);
