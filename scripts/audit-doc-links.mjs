import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function stripCodeBlocks(markdown) {
  // Remove fenced blocks to avoid false positives on examples.
  return markdown.replace(/```[\s\S]*?```/g, "");
}

function extractLinks(markdown) {
  const text = stripCodeBlocks(markdown);
  const links = [];
  const re = /\[[^\]]+\]\(([^)]+)\)/g;
  for (const match of text.matchAll(re)) {
    const raw = String(match[1] || "").trim();
    if (!raw) continue;
    links.push(raw);
  }
  return links;
}

function normalizeTarget(rawTarget) {
  const target = String(rawTarget || "").trim();
  if (!target) return null;

  // Ignore external and non-file schemes.
  if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(target)) return null;

  // Drop fragment/query.
  const noHash = target.split("#")[0];
  const noQuery = noHash.split("?")[0];
  const clean = noQuery.trim();
  if (!clean) return null;

  // Ignore pure anchors.
  if (clean.startsWith("#")) return null;

  // Normalize leading ./ for path.resolve parity.
  return clean.replace(/^\.\/+/, "");
}

function checkFileLinks(filePath) {
  const abs = path.resolve(repoRoot, filePath);
  const dir = path.dirname(abs);
  const markdown = fs.readFileSync(abs, "utf8");
  const rawLinks = extractLinks(markdown);

  const broken = [];
  for (const raw of rawLinks) {
    const target = normalizeTarget(raw);
    if (!target) continue;

    // Treat absolute-ish repo paths as repo-root-relative.
    const targetAbs = target.startsWith("/")
      ? path.resolve(repoRoot, target.slice(1))
      : path.resolve(dir, target);

    if (!fs.existsSync(targetAbs)) {
      broken.push({ raw, target, resolved: path.relative(repoRoot, targetAbs).replaceAll("\\", "/") });
    }
  }

  return broken;
}

function main() {
  const files = process.argv.slice(2).filter(Boolean);
  if (files.length === 0) {
    console.error("Usage: node scripts/audit-doc-links.mjs <md-file> [more files...]");
    process.exit(2);
  }

  const missingFiles = files.filter((f) => !fs.existsSync(path.resolve(repoRoot, f)));
  if (missingFiles.length > 0) {
    console.error("Missing input file(s):");
    for (const f of missingFiles) console.error(`- ${f}`);
    process.exit(2);
  }

  const brokenByFile = new Map();
  for (const file of files) {
    const broken = checkFileLinks(file);
    if (broken.length > 0) brokenByFile.set(file, broken);
  }

  if (brokenByFile.size > 0) {
    console.error("❌ Broken doc links found:");
    for (const [file, broken] of brokenByFile.entries()) {
      console.error(`\n${file}`);
      for (const b of broken.slice(0, 20)) {
        console.error(`- ${b.raw}  (resolved: ${b.resolved})`);
      }
      if (broken.length > 20) {
        console.error(`...and ${broken.length - 20} more`);
      }
    }
    process.exit(1);
  }

  console.log(`✅ Doc links OK (${files.length} file(s))`);
}

main();

