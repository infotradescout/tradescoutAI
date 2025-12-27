#!/usr/bin/env node
import fs from "fs";
import path from "path";
import os from "os";

const ROOT = process.cwd();

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "public",
  ".next",
  ".turbo",
  ".vercel",
  ".output",
  "coverage",
]);

const TEXT_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".md", ".css", ".scss",
  ".sql", ".prisma",
]);

function isIgnoredDir(p) {
  const parts = p.split(path.sep);
  return parts.some((x) => IGNORE_DIRS.has(x));
}

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (isIgnoredDir(full)) continue;
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function rel(p) {
  return path.relative(ROOT, p).replaceAll("\\", "/");
}

function findMatches(files, patterns) {
  const results = [];
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (!TEXT_EXTS.has(ext)) continue;
    const txt = readText(f);
    if (!txt) continue;
    for (const { name, re } of patterns) {
      const m = txt.match(re);
      if (m) {
        results.push({ file: rel(f), name, count: m.length });
      }
    }
  }
  return results;
}

function grepLines(files, re, maxPerFile = 8) {
  const hits = [];
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (!TEXT_EXTS.has(ext)) continue;
    const txt = readText(f);
    if (!txt) continue;
    const lines = txt.split(/\r?\n/);
    let n = 0;
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        hits.push({ file: rel(f), line: i + 1, text: lines[i].slice(0, 200) });
        n++;
        if (n >= maxPerFile) break;
      }
    }
  }
  return hits;
}

function section(title) {
  return `\n## ${title}\n`;
}

function mdTable(rows, cols) {
  if (!rows.length) return "_None found._\n";
  const header = `| ${cols.join(" | ")} |`;
  const sep = `| ${cols.map(() => "---").join(" | ")} |`;
  const body = rows.map(r => `| ${cols.map(c => String(r[c] ?? "")).join(" | ")} |`).join("\n");
  return `${header}\n${sep}\n${body}\n`;
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

const allFiles = walk(ROOT);
const textFiles = allFiles.filter(f => TEXT_EXTS.has(path.extname(f).toLowerCase()));

const patterns = [
  // Storage providers / SDKs
  { name: "AWS SDK", re: /\b(@aws-sdk\/|AWS\.S3|new S3\b|s3Client\b)\b/g },
  { name: "S3-compatible", re: /\bS3_ENDPOINT\b|\bR2\b|\bBackblaze\b|\bB2\b|\bMINIO\b/g },
  { name: "Cloudflare R2", re: /\bcloudflare\b.*\br2\b|\bR2_BUCKET\b/g },
  { name: "Presigned URL", re: /\bpresign(ed)?\b|\bgetSignedUrl\b|\bcreatePresignedPost\b/g },
  { name: "Multer/FormData", re: /\bmulter\b|\bformidable\b|\bbusboy\b|\bFormData\b/g },
  { name: "Sharp/image processing", re: /\bsharp\b|\bimage\/(resize|thumbnail)\b/g },
  { name: "Image mime validation", re: /\bimage\/(png|jpeg|webp|gif)\b|\bmime\b.*\bimage\b/g },

  // Media concepts
  { name: "media_assets table mention", re: /\bmedia_assets\b/g },
  { name: "avatar field mention", re: /\bavatar(_url|Url|_asset_id|AssetId)?\b/g },
  { name: "cover photo mention", re: /\bcover(_photo|Photo|_url|Url|_asset_id|AssetId)?\b/g },
  { name: "gallery mention", re: /\bgallery\b|\bphoto(s)?\b.*\bprofile\b/g },
  { name: "post image mention", re: /\bpost\b.*\bimage\b|\bimages\b.*\bpost\b/g },

  // API routes
  { name: "media API route", re: /\/api\/(media|upload|files|assets)\b/g },
  { name: "profile upload route", re: /\/api\/(users|profile)\/.*(avatar|photo|image|cover)/g },
  { name: "exchange image route", re: /\/api\/exchange\/.*(image|photo|upload)/g },
  { name: "community image route", re: /\/api\/community\/.*(image|photo|upload)/g },

  // Env vars commonly used
  { name: "Bucket env vars", re: /\b(S3_BUCKET|R2_BUCKET|BUCKET_NAME|AWS_REGION|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|S3_ENDPOINT)\b/g },
];

const matchSummary = findMatches(textFiles, patterns)
  .sort((a, b) => (b.count - a.count) || a.file.localeCompare(b.file));

const routeHints = grepLines(
  textFiles,
  /\/api\/(media|upload|files|assets|community|exchange|users).*?(image|photo|avatar|cover|gallery|upload)/i,
  10
);
const storageHints = grepLines(
  textFiles,
  /(getSignedUrl|presign|createPresignedPost|new S3|@aws-sdk\/|multer|sharp|R2_BUCKET|S3_BUCKET|S3_ENDPOINT)/,
  10
);
const schemaHints = grepLines(
  textFiles,
  /(media_assets|avatar(_asset_id|Url|_url)?|cover(_asset_id|Url|_url)?|gallery|post_media|exchange_item_media)/i,
  12
);
const uiHints = grepLines(
  textFiles,
  /(Avatar|Cover|Gallery|Upload|Uploader|Dropzone|FileInput|ImageInput|Photo)/,
  8
);

const likelySchemaFiles = textFiles.filter(f =>
  /schema\.(ts|js)$/.test(f) ||
  /drizzle/i.test(f) ||
  /migrations?/i.test(f) ||
  /\.sql$/.test(f)
);

const likelyRouteFiles = textFiles.filter(f =>
  /routes?\.(ts|js)$/.test(f) ||
  /server\/.*routes/i.test(f) ||
  /api\.(ts|js)$/.test(f)
);

const likelyProfileFiles = textFiles.filter(f =>
  /PublicProfileView\.tsx$/.test(f) ||
  /CommunityProfile/i.test(f) ||
  /profile/i.test(f) && f.includes("client/src")
);

const out = [];
out.push(`# TradeScout Media Progress Audit\n`);
out.push(`Generated: ${new Date().toISOString()}\n`);
out.push(`Root: \`${ROOT.replaceAll("\\", "/")}\`\n`);
out.push(section("High-level signal counts"));
const totals = patterns.map(p => {
  const total = matchSummary.filter(x => x.name === p.name).reduce((s, x) => s + x.count, 0);
  return { signal: p.name, total };
});
out.push(mdTable(totals, ["signal", "total"]));

out.push(section("Top files by media-related signals"));
const topByFile = {};
for (const r of matchSummary) {
  topByFile[r.file] = (topByFile[r.file] ?? 0) + r.count;
}
const topFiles = Object.entries(topByFile)
  .map(([file, total]) => ({ file, total }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 40);
out.push(mdTable(topFiles, ["file", "total"]));

out.push(section("Likely schema/migration files"));
out.push(mdTable(
  uniqBy(likelySchemaFiles.map(f => ({ file: rel(f) })), x => x.file).slice(0, 80),
  ["file"]
));

out.push(section("Likely route files"));
out.push(mdTable(
  uniqBy(likelyRouteFiles.map(f => ({ file: rel(f) })), x => x.file).slice(0, 80),
  ["file"]
));

out.push(section("Likely profile/media UI files"));
out.push(mdTable(
  uniqBy(likelyProfileFiles.map(f => ({ file: rel(f) })), x => x.file).slice(0, 80),
  ["file"]
));

out.push(section("Route line hits (where media endpoints may already exist)"));
out.push(mdTable(routeHints.slice(0, 120), ["file", "line", "text"]));

out.push(section("Storage line hits (S3/R2/presign/multer/sharp clues)"));
out.push(mdTable(storageHints.slice(0, 120), ["file", "line", "text"]));

out.push(section("Schema line hits (tables/fields: avatar/cover/gallery/media_assets)"));
out.push(mdTable(schemaHints.slice(0, 160), ["file", "line", "text"]));

out.push(section("UI component hits (Uploaders/Avatar/Cover/Gallery keywords)"));
out.push(mdTable(uiHints.slice(0, 160), ["file", "line", "text"]));

const reportPath = path.join(ROOT, "MEDIA_AUDIT_REPORT.md");
fs.writeFileSync(reportPath, out.join("\n"), "utf8");

console.log(`✅ Wrote ${reportPath}`);
console.log(`Tip: open MEDIA_AUDIT_REPORT.md and search for 'presign', 'media_assets', 'avatar', 'cover', 'gallery'.`);
