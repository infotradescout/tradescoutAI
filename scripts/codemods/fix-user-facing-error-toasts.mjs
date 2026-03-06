import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const TARGET_DIRS = [path.join(repoRoot, "client", "src")];

function walk(dir) {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function isTargetFile(p) {
  return p.endsWith(".ts") || p.endsWith(".tsx") || p.endsWith(".js") || p.endsWith(".jsx");
}

const importLine = `import { formatUserFacingErrorMessage } from "@/lib/userFacingError";`;

function ensureImport(source) {
  if (source.includes(`from "@/lib/userFacingError"`)) return source;
  const lines = source.split(/\r?\n/);
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImportIdx = i;
    else if (lastImportIdx >= 0) break;
  }
  if (lastImportIdx < 0) return `${importLine}\n${source}`;
  lines.splice(lastImportIdx + 1, 0, importLine);
  return lines.join("\n");
}

function fixDescriptions(source) {
  let changed = false;
  let out = source;

const replacers = [
    // description: err?.message || "fallback"
    [
      /description:\s*(err|error)\?\.\s*message\s*\|\|\s*("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g,
      (_m, v, fb) => {
        changed = true;
        return `description: formatUserFacingErrorMessage(${v}, ${fb})`;
      },
    ],
    // description:\n  err?.message || "fallback"
    [
      /description:\s*\n\s*(err|error)\?\.\s*message\s*\|\|\s*("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g,
      (_m, v, fb) => {
        changed = true;
        return `description: formatUserFacingErrorMessage(${v}, ${fb})`;
      },
    ],
    // description: err?.message ?? "fallback"
    [
      /description:\s*(err|error)\?\.\s*message\s*\?\?\s*("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g,
      (_m, v, fb) => {
        changed = true;
        return `description: formatUserFacingErrorMessage(${v}, ${fb})`;
      },
    ],
    // description:\n  err?.message ?? "fallback"
    [
      /description:\s*\n\s*(err|error)\?\.\s*message\s*\?\?\s*("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g,
      (_m, v, fb) => {
        changed = true;
        return `description: formatUserFacingErrorMessage(${v}, ${fb})`;
      },
    ],
    // description: err.message || "fallback"
    [
      /description:\s*(err|error)\.\s*message\s*\|\|\s*("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g,
      (_m, v, fb) => {
        changed = true;
        return `description: formatUserFacingErrorMessage(${v}, ${fb})`;
      },
    ],
    // description:\n  err.message || "fallback"
    [
      /description:\s*\n\s*(err|error)\.\s*message\s*\|\|\s*("([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g,
      (_m, v, fb) => {
        changed = true;
        return `description: formatUserFacingErrorMessage(${v}, ${fb})`;
      },
    ],
    // description: err.message,
    [
      /description:\s*(err|error)\.\s*message\s*,/g,
      (_m, v) => {
        changed = true;
        return `description: formatUserFacingErrorMessage(${v}, "Please try again."),`;
      },
    ],
    // description:\n  err.message,
    [
      /description:\s*\n\s*(err|error)\.\s*message\s*,/g,
      (_m, v) => {
        changed = true;
        return `description: formatUserFacingErrorMessage(${v}, "Please try again."),`;
      },
    ],
  ];

  for (const [re, fn] of replacers) {
    out = out.replace(re, fn);
  }

  return { changed, out };
}

let touched = 0;

for (const dir of TARGET_DIRS) {
  const files = walk(dir).filter(isTargetFile);
  for (const filePath of files) {
    const rel = path.relative(repoRoot, filePath).replaceAll("\\", "/");
    const source = fs.readFileSync(filePath, "utf8");
    const { changed, out } = fixDescriptions(source);
    if (!changed) continue;

    const withImport = ensureImport(out);
    fs.writeFileSync(filePath, withImport, "utf8");
    touched++;
    console.log(`[fix-user-facing-error-toasts] updated ${rel}`);
  }
}

console.log(`[fix-user-facing-error-toasts] done (files changed: ${touched})`);
