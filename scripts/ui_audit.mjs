import fs from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "audit");
const OUT_MD = path.join(OUT_DIR, "ui-audit-report.md");
const OUT_JSON = path.join(OUT_DIR, "ui-audit-report.json");

// Directories to scan (adjust if your repo differs)
const SCAN_DIRS = [
  "client/src",
  "server",
  "shared",
];

// File extensions to include
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".md"]);

// Ignore dirs
const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "public",
  ".git",
  ".vercel",
  ".next",
  ".turbo",
  "coverage",
  "audit",
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name)) continue;
      walk(full, out);
    } else {
      const ext = path.extname(e.name);
      if (EXT.has(ext)) out.push(full);
    }
  }
  return out;
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function rel(p) {
  return path.relative(ROOT, p).replaceAll("\\", "/");
}

function sha1(text) {
  return crypto.createHash("sha1").update(text).digest("hex");
}

// Regexes
const HEX_COLOR = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const RGB_COLOR = /\brgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(?:0?\.\d+|1|0))?\s*\)/g;

// Tailwind color utility matcher for common patterns
const TW_COLOR = /\b(?:bg|text|border|ring|from|to|via|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b/g;

// Theme variables usage (semantic token contract)
const THEME_VAR = /\bvar\(--ts-[a-z0-9-_]+\)\b/g;
const CSS_THEME_DECL = /--ts-[a-z0-9-_]+\s*:/g;

// Hardcoded “blue-ish” tailwind (specific callout)
const TW_BLUE = /\b(?:bg|text|border|ring|from|to|via)-(?:blue|sky|indigo)(?:-\d{2,3})?\b/g;

// Quick checks for common UI shells / wrappers
const COMMUNITY_SHELL = /\bCommunityShell\b/g;
const TABS = /\bTabs(List|Content|Trigger)\b/g;

function summarizeMatches(text, re) {
  const m = text.match(re);
  return m ? m.length : 0;
}

function uniqueMatches(text, re) {
  const m = text.match(re) || [];
  return [...new Set(m)];
}

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function main() {
  const files = [];
  for (const d of SCAN_DIRS) files.push(...walk(path.join(ROOT, d)));

  const byFile = [];
  let totals = {
    filesScanned: 0,
    hexColorRefs: 0,
    rgbColorRefs: 0,
    tailwindColorRefs: 0,
    tailwindBlueRefs: 0,
    themeVarRefs: 0,
    cssThemeDecls: 0,
    communityShellRefs: 0,
    tabsRefs: 0,
  };

  for (const f of files) {
    const text = readText(f);
    if (!text) continue;

    const hexCount = summarizeMatches(text, HEX_COLOR);
    const rgbCount = summarizeMatches(text, RGB_COLOR);
    const twCount = summarizeMatches(text, TW_COLOR);
    const blueCount = summarizeMatches(text, TW_BLUE);
    const themeVarCount = summarizeMatches(text, THEME_VAR);
    const themeDeclCount = summarizeMatches(text, CSS_THEME_DECL);
    const shellCount = summarizeMatches(text, COMMUNITY_SHELL);
    const tabsCount = summarizeMatches(text, TABS);

    const size = Buffer.byteLength(text, "utf8");
    const lineCount = text.split(/\r?\n/).length;

    if (
      hexCount ||
      rgbCount ||
      twCount ||
      themeVarCount ||
      themeDeclCount ||
      shellCount ||
      tabsCount
    ) {
      byFile.push({
        file: rel(f),
        bytes: size,
        lines: lineCount,
        sha1: sha1(text),
        counts: {
          hex: hexCount,
          rgb: rgbCount,
          tailwindColor: twCount,
          tailwindBlue: blueCount,
          themeVar: themeVarCount,
          themeDecl: themeDeclCount,
          communityShell: shellCount,
          tabs: tabsCount,
        },
        samples: {
          hex: uniqueMatches(text, HEX_COLOR).slice(0, 12),
          rgb: uniqueMatches(text, RGB_COLOR).slice(0, 12),
          tw: uniqueMatches(text, TW_COLOR).slice(0, 24),
          twBlue: uniqueMatches(text, TW_BLUE).slice(0, 24),
          themeVar: uniqueMatches(text, THEME_VAR).slice(0, 24),
        },
      });
    }

    totals.filesScanned += 1;
    totals.hexColorRefs += hexCount;
    totals.rgbColorRefs += rgbCount;
    totals.tailwindColorRefs += twCount;
    totals.tailwindBlueRefs += blueCount;
    totals.themeVarRefs += themeVarCount;
    totals.cssThemeDecls += themeDeclCount;
    totals.communityShellRefs += shellCount;
    totals.tabsRefs += tabsCount;
  }

  // Top offenders
  const topHex = [...byFile]
    .filter((x) => x.counts.hex || x.counts.rgb)
    .sort((a, b) => (b.counts.hex + b.counts.rgb) - (a.counts.hex + a.counts.rgb))
    .slice(0, 40);

  const topTW = [...byFile]
    .filter((x) => x.counts.tailwindColor)
    .sort((a, b) => b.counts.tailwindColor - a.counts.tailwindColor)
    .slice(0, 40);

  const topBlue = [...byFile]
    .filter((x) => x.counts.tailwindBlue)
    .sort((a, b) => b.counts.tailwindBlue - a.counts.tailwindBlue)
    .slice(0, 40);

  const biggest = [...byFile]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 40);

  const report = {
    generatedAt: new Date().toISOString(),
    root: ROOT,
    scanDirs: SCAN_DIRS,
    totals,
    byFile,
    top: {
      hardcodedColors: topHex,
      tailwindColors: topTW,
      tailwindBlue: topBlue,
      biggestFiles: biggest,
    },
  };

  ensureOutDir();
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), "utf8");

  const md = [];
  md.push(`# TradeScout UI Audit Report`);
  md.push(`Generated: ${report.generatedAt}`);
  md.push("");
  md.push(`## Totals`);
  md.push(`- Files scanned: ${totals.filesScanned}`);
  md.push(`- Hardcoded HEX refs: ${totals.hexColorRefs}`);
  md.push(`- Hardcoded RGB/RGBA refs: ${totals.rgbColorRefs}`);
  md.push(`- Tailwind color utility refs: ${totals.tailwindColorRefs}`);
  md.push(`- Tailwind blue/sky/indigo refs: ${totals.tailwindBlueRefs}`);
  md.push(`- Theme var usage refs: ${totals.themeVarRefs}`);
  md.push(`- Theme CSS declarations refs: ${totals.cssThemeDecls}`);
  md.push("");

  function table(title, rows, cols) {
    md.push(`## ${title}`);
    md.push(`| ${cols.join(" | ")} |`);
    md.push(`| ${cols.map(() => "---").join(" | ")} |`);
    for (const r of rows) {
      md.push(`| ${cols.map((c) => String(r[c] ?? "")).join(" | ")} |`);
    }
    md.push("");
  }

  table(
    "Top hardcoded color offenders (HEX/RGB)",
    topHex.map((x) => ({
      file: x.file,
      hex: x.counts.hex,
      rgb: x.counts.rgb,
      themeVar: x.counts.themeVar,
      bytes: x.bytes,
    })),
    ["file", "hex", "rgb", "themeVar", "bytes"]
  );

  table(
    "Top Tailwind color utility offenders",
    topTW.map((x) => ({
      file: x.file,
      twColors: x.counts.tailwindColor,
      twBlue: x.counts.tailwindBlue,
      themeVar: x.counts.themeVar,
      bytes: x.bytes,
    })),
    ["file", "twColors", "twBlue", "themeVar", "bytes"]
  );

  table(
    "Top blue/sky/indigo offenders",
    topBlue.map((x) => ({
      file: x.file,
      twBlue: x.counts.tailwindBlue,
      twColors: x.counts.tailwindColor,
      bytes: x.bytes,
    })),
    ["file", "twBlue", "twColors", "bytes"]
  );

  table(
    "Largest files (often UI complexity hotspots)",
    biggest.map((x) => ({
      file: x.file,
      bytes: x.bytes,
      lines: x.lines,
      twColors: x.counts.tailwindColor,
      hex: x.counts.hex,
      themeVar: x.counts.themeVar,
    })),
    ["file", "bytes", "lines", "twColors", "hex", "themeVar"]
  );

  md.push(`## How to use this report`);
  md.push(`- Start with **Top blue offenders** and remove hardcoded Tailwind blues in favor of theme tokens / CSS vars.`);
  md.push(`- Then eliminate **hardcoded HEX/RGB** in components/pages (convert to theme vars).`);
  md.push(`- Finally, standardize shared shells (e.g., CommunityShell usage) and shared components (buttons/cards/tabs).`);
  md.push("");

  fs.writeFileSync(OUT_MD, md.join("\n"), "utf8");

  console.log(`✅ UI audit complete.`);
  console.log(`- ${rel(OUT_MD)}`);
  console.log(`- ${rel(OUT_JSON)}`);
}

main();
