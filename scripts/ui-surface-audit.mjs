import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "artifacts", "ui-surface-audit");
// Scout previously had no coverage at all here -- this script only ever
// walked client/src/pages/**, so client/src/scout/** (ScoutHome.tsx et al.)
// was structurally invisible to it regardless of content.
const SCAN_DIRS = [
  path.join(ROOT, "client", "src", "pages"),
  path.join(ROOT, "client", "src", "scout"),
];

const TARGET_EXTS = new Set([".ts", ".tsx"]);
const PATTERNS = [
  // Viewport-claiming height utilities are forbidden at FeatureSurface level.
  // (AppSurface/AppFrame own viewport height; features must not recreate it.)
  { id: "min-h-viewport", re: /min-h-(?:screen|\[(?:calc\([^\]]+\)|100vh)\])/g },
  { id: "h-screen", re: /\bh-screen\b/g },
  { id: "w-screen", re: /\bw-screen\b/g },
  { id: "bg-*", re: /\bbg-[a-z0-9\-\/\[\]\(\)\.\%]+/gi },
  { id: "gradient", re: /\b(bg-gradient-to|from-|via-|to-)\b/gi },
];

function compareStableText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function walk(dir, out = []) {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => compareStableText(a.name, b.name));
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      walk(p, out);
    } else if (e.isFile()) {
      const ext = path.extname(e.name);
      if (TARGET_EXTS.has(ext)) out.push(p);
    }
  }
  return out;
}

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const rel = path.relative(ROOT, filePath).replaceAll("\\", "/");
  const hits = [];

  for (const p of PATTERNS) {
    const matches = [...text.matchAll(p.re)];
    if (matches.length) {
      const locs = [];
      for (const m of matches.slice(0, 5)) {
        const idx = m.index ?? 0;
        const before = text.slice(0, idx);
        const line = before.split("\n").length;
        locs.push(line);
      }
      hits.push({ pattern: p.id, count: matches.length, lines: locs });
    }
  }

  const claimsViewportHeight =
    hits.some((h) => h.pattern === "min-h-viewport") || hits.some((h) => h.pattern === "h-screen");
  const isRootViolation = claimsViewportHeight && hits.some((h) => h.pattern === "bg-*");

  return { file: rel, isRootViolation, hits };
}

const files = SCAN_DIRS.flatMap((dir) => walk(dir));
const results = files.map(scanFile);

results.sort((a, b) => {
  if (a.isRootViolation !== b.isRootViolation) return a.isRootViolation ? -1 : 1;
  const aCount = a.hits.reduce((s, h) => s + h.count, 0);
  const bCount = b.hits.reduce((s, h) => s + h.count, 0);
  const countDelta = bCount - aCount;
  if (countDelta !== 0) return countDelta;
  return compareStableText(a.file, b.file);
});

const summary = {
  scannedFiles: results.length,
  rootViolations: results.filter((r) => r.isRootViolation).length,
  filesWithViewportHeight: results.filter((r) => r.hits.some((h) => h.pattern === "min-h-viewport" || h.pattern === "h-screen")).length,
  filesWithBg: results.filter((r) => r.hits.some((h) => h.pattern === "bg-*")).length,
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(
  path.join(OUTPUT_DIR, "ui-surface-audit.json"),
  JSON.stringify({ summary, results }, null, 2)
);

const top = results.slice(0, 40);
const md = [
  `# UI Surface Audit`,
  ``,
  `Scanned files: **${summary.scannedFiles}**`,
  `Root violations (viewport-height + bg-*): **${summary.rootViolations}**`,
  `Files claiming viewport height: **${summary.filesWithViewportHeight}**`,
  `Files with bg-* classes: **${summary.filesWithBg}**`,
  ``,
  `## Top offenders`,
  ...top.map((r) => {
    const hitStr = r.hits
      .map((h) => `${h.pattern} (${h.count}) @ lines ${h.lines.join(",")}`)
      .join(" | ");
    return `- ${r.isRootViolation ? "🚫" : "•"} \`${r.file}\` — ${hitStr}`;
  }),
  ``,
].join("\n");

fs.writeFileSync(path.join(OUTPUT_DIR, "ui-surface-audit.md"), md);

console.log("Wrote artifacts/ui-surface-audit/ui-surface-audit.json and ui-surface-audit.md");
console.log(`Root violations: ${summary.rootViolations}`);
