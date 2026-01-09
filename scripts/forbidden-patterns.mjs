#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  ".vite",
  "client/node_modules",
  "server/node_modules",
]);

const ALLOWED_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
]);

const FORBIDDEN = [
  "Database offline, simulating",
  "mockDeals",
  "mockUserAffiliate",
  "stub-id",
  "stub-code",
  "stub-payout-id",
  "Mock partnerships",
];

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ALLOWED_EXT.has(ext)) out.push(full);
    }
  }
  return out;
}

function main() {
  const files = walk(ROOT);
  const hits = [];

  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    if (rel === "scripts/forbidden-patterns.mjs") continue;

    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    for (const pattern of FORBIDDEN) {
      const idx = content.indexOf(pattern);
      if (idx !== -1) {
        const upTo = content.slice(0, idx);
        const line = upTo.split("\n").length;
        hits.push({ file: rel, line, pattern });
      }
    }
  }

  if (hits.length) {
    console.error("\nForbidden patterns detected (mock/stub regression):\n");
    for (const hit of hits) {
      console.error(`- ${hit.file}:${hit.line}  contains: "${hit.pattern}"`);
    }
    console.error("\nFix: remove mock/stub/simulated paths or move them behind explicit 501/503.\n");
    process.exit(1);
  }

  console.log("✅ Forbidden-pattern check passed (no mocks/stubs detected).");
}

main();
