import fs from "node:fs";
import path from "node:path";

const checks = [
  {
    file: "server/routes.ts",
    pattern: /for now using in-memory storage/i,
    message: "In-memory production dependency marker found in server routes.",
  },
];

const failures = [];

for (const check of checks) {
  const full = path.resolve(check.file);
  if (!fs.existsSync(full)) continue;
  const content = fs.readFileSync(full, "utf8");
  if (check.pattern.test(content)) {
    failures.push(`${check.file}: ${check.message}`);
  }
}

if (failures.length > 0) {
  console.error("[production-debt] blocking findings:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("[production-debt] no blocking in-memory dependency markers found");
