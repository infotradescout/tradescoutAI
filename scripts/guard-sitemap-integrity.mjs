import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.resolve("client", "public");
const INDEX_PATH = path.join(PUBLIC_DIR, "sitemap-index.xml");

function fail(msg) {
  console.error(`FAIL sitemap_integrity: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`PASS sitemap_integrity: ${msg}`);
}

if (!existsSync(INDEX_PATH)) {
  fail("Missing client/public/sitemap-index.xml");
}

const xml = readFileSync(INDEX_PATH, "utf-8");
const matches = [...xml.matchAll(/<loc>https:\/\/www\.thetradescout\.com\/([^<]+)<\/loc>/g)].map(
  (m) => String(m[1] || "").trim()
);

if (matches.length === 0) {
  fail("Sitemap index has no loc entries");
}

const missing = matches.filter((name) => !existsSync(path.join(PUBLIC_DIR, name)));
if (missing.length > 0) {
  fail(`Index references missing sitemap files: ${missing.join(", ")}`);
}

pass(`Validated ${matches.length} sitemap index targets`);