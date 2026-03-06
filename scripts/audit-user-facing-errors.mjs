import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["client/src"];
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

// This audit is intentionally narrow:
// We want to prevent raw internal errors from being surfaced to users.
//
// If you need to bypass for an exceptional case, add:
//   // audit:user-facing-errors-ignore
// on the same line as the match.
const ignoreLinePattern = /audit:user-facing-errors-ignore/i;

const patterns = [
  {
    id: "toast_description_message",
    description: "toast({ description: error.message }) should use formatUserFacingErrorMessage",
    re: /toast\s*\(\s*\{[\s\S]{0,600}?description\s*:\s*[^,}]*\b(?:err|error)\??\.message\b/gi,
  },
  {
    id: "seterror_message",
    description: "setError(err.message) should use formatUserFacingErrorMessage",
    re: /setError\s*\(\s*(?:err|error)\??\.message\b/gi,
  },
  {
    id: "seterror_conditional_message",
    description:
      "setError(err instanceof Error ? err.message : ...) should use formatUserFacingErrorMessage",
    re: /setError\s*\(\s*(?:err|error)\s+instanceof\s+Error\s*\?\s*(?:err|error)\.message\b/gi,
  },
  {
    id: "error_tostring",
    description: "error.toString() should not be used in user surfaces",
    re: /\berror\.toString\s*\(\s*\)/gi,
  },
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

function buildLineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function indexToLine(lineStarts, idx) {
  // Binary search last start <= idx
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lineStarts[mid] <= idx) lo = mid + 1;
    else hi = mid - 1;
  }
  return Math.max(1, hi + 1);
}

const failures = [];

for (const relRoot of scanRoots) {
  const fullRoot = path.join(root, relRoot);
  const files = walk(fullRoot);

  for (const filePath of files) {
    const relPath = path.relative(root, filePath).replaceAll("\\", "/");
    const content = fs.readFileSync(filePath, "utf8");
    const lineStarts = buildLineIndex(content);
    const lines = content.split(/\r?\n/);

    for (const p of patterns) {
      for (const match of content.matchAll(p.re)) {
        const matchIndex = match.index ?? 0;
        const lineNo = indexToLine(lineStarts, matchIndex);
        const line = lines[lineNo - 1] || "";
        if (ignoreLinePattern.test(line)) continue;

        failures.push({
          id: p.id,
          description: p.description,
          loc: `${relPath}:${lineNo}`,
          sample: line.trim().slice(0, 240),
        });
      }
    }
  }
}

if (failures.length > 0) {
  console.error("[user-facing-errors] blocking findings:");
  for (const f of failures) {
    console.error(`  - ${f.loc} (${f.id}): ${f.description}`);
    if (f.sample) console.error(`      ${f.sample}`);
  }
  process.exit(1);
}

console.log("[user-facing-errors] pass");

