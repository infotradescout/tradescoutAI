import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Pack a repository into a single AI-friendly file (Markdown or XML).
 *
 * Defaults are conservative: skips node_modules, dist/build, .git, binaries, and common secret dirs/files.
 *
 * Usage:
 *   node scripts/pack-repo.mjs --out repo-pack.md
 *   node scripts/pack-repo.mjs --format xml --out repo-pack.xml
 *   node scripts/pack-repo.mjs --all --max-bytes 5000000
 */

const DEFAULT_INCLUDE = [
  "package.json",
  "tsconfig.json",
  "tsconfig.lint.json",
  "vite.config.ts",
  "vitest.config.ts",
  "TECHNICAL_OVERVIEW.md",
  "README.md",
  "AGENTS.md",
  "server",
  "client/src",
  "client/vite.config.ts",
  "shared",
  "scripts",
  "tools",
  "types",
];

const DEFAULT_EXCLUDE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "assets",
  "client/dist",
  "client/public",
  "logs",
  "__trash_candidate__",
  "secrets",
  "ssl",
  ".vscode",
  ".idea",
]);

const DEFAULT_EXCLUDE_FILE_BASENAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".env.test",
]);

const TEXT_EXT_ALLOW = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".css",
  ".scss",
  ".html",
  ".yml",
  ".yaml",
  ".toml",
  ".sql",
  ".prisma",
  ".graphql",
  ".txt",
  ".sh",
  ".ps1",
  ".bat",
  ".cmd",
  ".gitignore",
  ".prettierignore",
  ".prettierrc",
]);

function parseArgs(argv) {
  const args = {
    format: "md",
    out: "",
    root: process.cwd(),
    include: [],
    exclude: [],
    all: false,
    maxBytes: 12_000_000,
    maxFileBytes: 800_000,
    maxFiles: 2000,
    includeTree: true,
    includeHashes: true,
  };

  const it = argv[Symbol.iterator]();
  for (let cur = it.next(); !cur.done; cur = it.next()) {
    const a = cur.value;
    if (a === "--format") args.format = String(it.next().value || "md");
    else if (a === "--out") args.out = String(it.next().value || "");
    else if (a === "--root") args.root = path.resolve(String(it.next().value || process.cwd()));
    else if (a === "--include") args.include.push(String(it.next().value || ""));
    else if (a === "--exclude") args.exclude.push(String(it.next().value || ""));
    else if (a === "--all") args.all = true;
    else if (a === "--no-tree") args.includeTree = false;
    else if (a === "--no-hash") args.includeHashes = false;
    else if (a === "--max-bytes") args.maxBytes = Number(it.next().value || args.maxBytes);
    else if (a === "--max-file-bytes") args.maxFileBytes = Number(it.next().value || args.maxFileBytes);
    else if (a === "--max-files") args.maxFiles = Number(it.next().value || args.maxFiles);
    else if (a === "--help" || a === "-h") args.help = true;
  }

  return args;
}

function printHelp() {
  // Keep help minimal and copy/paste friendly.
  const lines = [
    "pack-repo.mjs",
    "",
    "Packs selected repo files into one AI-friendly Markdown or XML file.",
    "",
    "Options:",
    "  --format md|xml         Output format (default: md)",
    "  --out <path>            Output path (required)",
    "  --root <path>           Repo root (default: cwd)",
    "  --include <path>        Add include path (repeatable)",
    "  --exclude <path>        Add exclude path (repeatable)",
    "  --all                   Include everything except default excludes",
    "  --max-bytes <n>         Total output byte budget (default: 12000000)",
    "  --max-file-bytes <n>    Skip files larger than this (default: 800000)",
    "  --max-files <n>         Stop after this many files (default: 2000)",
    "  --no-tree               Don't include tree section",
    "  --no-hash               Don't include per-file sha256 hashes",
    "",
    "Examples:",
    "  node scripts/pack-repo.mjs --out repo-pack.md",
    "  node scripts/pack-repo.mjs --format xml --out repo-pack.xml",
    "  node scripts/pack-repo.mjs --all --max-bytes 5000000 --out repo-pack.md",
  ];
  console.log(lines.join("\n"));
}

function normalizeRel(p) {
  return p.replace(/\\/g, "/");
}

function isExcludedPath(rel, extraExclude) {
  const parts = rel.split(/[\\/]/g).filter(Boolean);
  if (parts.some((p) => DEFAULT_EXCLUDE_DIRS.has(p))) return true;
  if (DEFAULT_EXCLUDE_FILE_BASENAMES.has(path.basename(rel))) return true;
  if (rel.endsWith(".lock")) return true;

  for (const ex of extraExclude) {
    if (!ex) continue;
    const exNorm = normalizeRel(ex);
    const relNorm = normalizeRel(rel);
    if (relNorm === exNorm) return true;
    if (relNorm.startsWith(exNorm.endsWith("/") ? exNorm : `${exNorm}/`)) return true;
  }

  return false;
}

function isLikelyTextFile(rel) {
  const base = path.basename(rel);
  if (base.startsWith(".env")) return false;
  const ext = path.extname(rel).toLowerCase();
  if (!ext && TEXT_EXT_ALLOW.has(base)) return true;
  return TEXT_EXT_ALLOW.has(ext);
}

function looksBinary(buf) {
  // Quick heuristic: NUL byte in first 8KB => binary.
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i += 1) {
    if (buf[i] === 0) return true;
  }
  return false;
}

async function* walkFiles(rootDir, relDir) {
  const abs = path.join(rootDir, relDir);
  const entries = await fs.promises.readdir(abs, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const ent of entries) {
    const rel = path.join(relDir, ent.name);
    if (isExcludedPath(rel, [])) continue;
    if (ent.isDirectory()) {
      yield* walkFiles(rootDir, rel);
    } else if (ent.isFile()) {
      yield rel;
    }
  }
}

async function gatherIncludedFiles(args) {
  const include = args.all
    ? ["."]
    : [...DEFAULT_INCLUDE, ...args.include].filter(Boolean);

  const seen = new Set();
  const files = [];

  for (const inc of include) {
    const incAbs = path.resolve(args.root, inc);
    const incRel = path.relative(args.root, incAbs) || ".";

    if (isExcludedPath(incRel, args.exclude)) continue;
    if (!fs.existsSync(incAbs)) continue;

    const stat = await fs.promises.stat(incAbs);
    if (stat.isDirectory()) {
      for await (const rel of walkFiles(args.root, incRel)) {
        if (files.length >= args.maxFiles) return files;
        if (isExcludedPath(rel, args.exclude)) continue;
        if (!seen.has(rel)) {
          seen.add(rel);
          files.push(rel);
        }
      }
    } else if (stat.isFile()) {
      const rel = incRel;
      if (!seen.has(rel)) {
        seen.add(rel);
        files.push(rel);
      }
    }
  }

  files.sort((a, b) => normalizeRel(a).localeCompare(normalizeRel(b)));
  return files;
}

function fileLang(rel) {
  const ext = path.extname(rel).toLowerCase();
  if (ext === ".ts") return "ts";
  if (ext === ".tsx") return "tsx";
  if (ext === ".js") return "js";
  if (ext === ".jsx") return "jsx";
  if (ext === ".json") return "json";
  if (ext === ".md") return "md";
  if (ext === ".yml" || ext === ".yaml") return "yaml";
  if (ext === ".css") return "css";
  if (ext === ".html") return "html";
  if (ext === ".sql") return "sql";
  if (ext === ".ps1") return "powershell";
  if (ext === ".sh") return "sh";
  return "";
}

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function escapeXmlText(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlAttr(s) {
  return escapeXmlText(s).replace(/"/g, "&quot;");
}

async function renderMarkdown(args, files) {
  const lines = [];
  lines.push(`# Repo Pack`);
  lines.push("");
  lines.push(`- Root: \`${normalizeRel(path.resolve(args.root))}\``);
  lines.push(`- Generated: \`${new Date().toISOString()}\``);
  lines.push(`- Files: \`${files.length}\``);
  lines.push(`- Max bytes budget: \`${args.maxBytes}\``);
  lines.push("");

  if (args.includeTree) {
    lines.push("## File List");
    lines.push("");
    for (const rel of files) {
      lines.push(`- \`${normalizeRel(rel)}\``);
    }
    lines.push("");
  }

  lines.push("## Files");
  lines.push("");

  let totalBytes = Buffer.byteLength(lines.join("\n"), "utf8");

  for (const rel of files) {
    if (totalBytes >= args.maxBytes) break;
    if (isExcludedPath(rel, args.exclude)) continue;
    if (!isLikelyTextFile(rel)) continue;

    const abs = path.resolve(args.root, rel);
    let buf;
    try {
      buf = await fs.promises.readFile(abs);
    } catch {
      continue;
    }

    if (buf.length > args.maxFileBytes) continue;
    if (looksBinary(buf)) continue;

    const header = [`### ${normalizeRel(rel)}`];
    if (args.includeHashes) header.push(`- sha256: \`${sha256Hex(buf)}\``);
    header.push("");
    const lang = fileLang(rel);
    header.push("```" + lang);
    const content = buf.toString("utf8");
    header.push(content);
    if (!content.endsWith("\n")) header.push("");
    header.push("```");
    header.push("");

    const chunk = header.join("\n");
    const chunkBytes = Buffer.byteLength(chunk, "utf8");
    if (totalBytes + chunkBytes > args.maxBytes) break;

    lines.push(chunk);
    totalBytes += chunkBytes;
  }

  return lines.join("\n");
}

async function renderXml(args, files) {
  const lines = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(
    `<repo root="${escapeXmlAttr(normalizeRel(path.resolve(args.root)))}" generated="${escapeXmlAttr(
      new Date().toISOString()
    )}">`
  );
  lines.push(`  <meta files="${files.length}" maxBytes="${args.maxBytes}" />`);
  lines.push(`  <files>`);

  let totalBytes = Buffer.byteLength(lines.join("\n"), "utf8");

  for (const rel of files) {
    if (totalBytes >= args.maxBytes) break;
    if (isExcludedPath(rel, args.exclude)) continue;
    if (!isLikelyTextFile(rel)) continue;

    const abs = path.resolve(args.root, rel);
    let buf;
    try {
      buf = await fs.promises.readFile(abs);
    } catch {
      continue;
    }

    if (buf.length > args.maxFileBytes) continue;
    if (looksBinary(buf)) continue;

    const content = buf.toString("utf8");
    const hash = args.includeHashes ? sha256Hex(buf) : "";

    const open = `    <file path="${escapeXmlAttr(normalizeRel(rel))}"${
      hash ? ` sha256="${hash}"` : ""
    }>`;
    const close = `    </file>`;
    const body = `      <content>${escapeXmlText(content)}</content>`;

    const chunk = [open, body, close].join("\n");
    const chunkBytes = Buffer.byteLength(chunk + "\n", "utf8");
    if (totalBytes + chunkBytes > args.maxBytes) break;

    lines.push(open);
    lines.push(body);
    lines.push(close);
    totalBytes += chunkBytes;
  }

  lines.push(`  </files>`);
  lines.push(`</repo>`);
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.out) {
    console.error("Missing required --out <path>");
    printHelp();
    process.exit(2);
  }

  const format = String(args.format || "md").toLowerCase();
  if (format !== "md" && format !== "xml") {
    console.error(`Unsupported --format ${args.format} (use md|xml)`);
    process.exit(2);
  }

  const files = await gatherIncludedFiles(args);

  const output =
    format === "xml" ? await renderXml(args, files) : await renderMarkdown(args, files);

  const outAbs = path.resolve(process.cwd(), args.out);
  await fs.promises.mkdir(path.dirname(outAbs), { recursive: true });
  await fs.promises.writeFile(outAbs, output, "utf8");

  console.log(`Wrote ${format.toUpperCase()} pack to ${outAbs}`);
  console.log(`Files considered: ${files.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

