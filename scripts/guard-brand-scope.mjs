import fs from "node:fs";
import path from "node:path";

const ROOTS = [path.resolve("client", "src"), path.resolve("server")];
const INCLUDE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".html"]);
const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "test-results",
  "coverage",
  "exports",
  "tests",
]);
const FORBIDDEN = [
  { label: "MealScout", re: /\bMealScout\b/i },
  { label: "Trader's Corner", re: /\bTrader'?s\s+Corner\b/i },
];

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(abs, out);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!INCLUDE_EXT.has(ext)) continue;
    if (/\.(?:test|spec)\.[^.]+$/i.test(entry.name)) continue;
    out.push(abs);
  }
}

function rel(p) {
  return path.relative(process.cwd(), p).replace(/\\/g, "/");
}

const files = [];
for (const root of ROOTS) {
  if (fs.existsSync(root)) walk(root, files);
}

const violations = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const token of FORBIDDEN) {
      if (!token.re.test(line)) continue;
      violations.push(`${rel(file)}:${idx + 1} contains forbidden brand token "${token.label}"`);
    }
  });
}

if (violations.length > 0) {
  console.error("FAIL brand_scope_guard:");
  for (const v of violations) console.error(`- ${v}`);
  process.exit(1);
}

console.log(`PASS brand_scope_guard: scanned ${files.length} files`);
