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
const summary = audit?.summary || {};
const rootViolations = Number(summary.rootViolations) || 0;

// Allowlist exceptions (rare). Put exact relative paths here if you truly want a page to own its background.
const ALLOW = new Set([
  "client/src/pages/landing.tsx",
  "client/src/pages/SimpleLanding.tsx",
]);

const offenders = (audit?.results || [])
  .filter((r) => r?.isRootViolation)
  .map((r) => String(r.file || ""))
  .filter((f) => f && !ALLOW.has(f));

if (offenders.length > 0) {
  console.error(`❌ UI root-violations remain: ${offenders.length}`);
  console.error(offenders.slice(0, 25).map((f) => `- ${f}`).join("\n"));
  if (offenders.length > 25) console.error(`...and ${offenders.length - 25} more`);
  process.exit(1);
}

console.log(`✅ UI root-violations: 0 (allowlist excluded).`);
console.log(`(Audit summary reported: ${rootViolations} root violations total.)`);
