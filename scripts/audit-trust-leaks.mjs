import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["client/src/pages", "client/src/components"];
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

// Keep this focused on user-facing trust-leak copy, not implementation comments.
const blockedPhrases = [
  /coming soon/i,
  /work in progress/i,
  /not implemented/i,
  /unimplemented/i,
];

const lineIgnorePatterns = [
  /placeholder/i,
  /data-\[placeholder\]/i,
  /::placeholder/i,
  /placeholder:/i,
  /\/\/\s*/i,
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walk(full, out);
      continue;
    }
    if (allowedExtensions.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function hasQuotedString(text) {
  return /["'`].*["'`]/.test(text);
}

const failures = [];

for (const relRoot of scanRoots) {
  const fullRoot = path.join(root, relRoot);
  const files = walk(fullRoot);
  for (const filePath of files) {
    const relPath = path.relative(root, filePath).replaceAll("\\", "/");
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (!hasQuotedString(line)) return;
      if (lineIgnorePatterns.some((p) => p.test(line))) return;
      for (const phrase of blockedPhrases) {
        if (phrase.test(line)) {
          failures.push(`${relPath}:${idx + 1}: ${line.trim()}`);
          break;
        }
      }
    });
  }
}

if (failures.length > 0) {
  console.error("[trust-leaks] blocking findings:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("[trust-leaks] pass (no blocked user-facing phrases found)");
