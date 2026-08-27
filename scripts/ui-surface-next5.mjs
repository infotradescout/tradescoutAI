import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const AUDIT_PATH = path.join(
  ROOT,
  "artifacts",
  "ui-surface-audit",
  "ui-surface-audit.json"
);

if (!fs.existsSync(AUDIT_PATH)) {
  console.error(`Missing ${AUDIT_PATH}. Run: node ./scripts/ui-surface-audit.mjs`);
  process.exit(1);
}

const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8"));
const results = Array.isArray(audit?.results) ? audit.results : [];

const offenders = results
  .filter((r) => r && r.isRootViolation === true)
  .map((r) => {
    const hits = Array.isArray(r.hits) ? r.hits : [];
    const weight = hits.reduce((sum, h) => sum + (Number(h.count) || 0), 0);
    const minH = hits.find((h) => h.pattern === "min-h-viewport")?.count || 0;
    const bg = hits.find((h) => h.pattern === "bg-*")?.count || 0;
    const gradient = hits.find((h) => h.pattern === "gradient")?.count || 0;
    return {
      file: String(r.file || ""),
      weight,
      minH,
      bg,
      gradient,
    };
  })
  .sort((a, b) => b.weight - a.weight);

const next5 = offenders.slice(0, 5);

console.log("Next 5 root-violation offenders (highest combined pattern weight):");
for (const [i, o] of next5.entries()) {
  console.log(
    `${String(i + 1).padStart(2, "0")}. ${o.file}  (weight=${o.weight}, viewport-height=${o.minH}, bg=${o.bg}, gradient=${o.gradient})`
  );
}

if (next5.length === 0) {
  console.log("✅ No root violations left.");
}
