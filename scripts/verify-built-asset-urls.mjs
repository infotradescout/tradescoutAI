import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const publicDistPath = path.join(repositoryRoot, "dist", "public");
const assetsPath = path.join(publicDistPath, "assets");
const htmlEntryPaths = [
  path.join(publicDistPath, "index.html"),
  path.join(publicDistPath, "landing.html"),
];

function fail(message, details = []) {
  console.error(`[built-asset-urls] ${message}`);
  for (const detail of details.slice(0, 20)) {
    console.error(`  - ${detail}`);
  }
  process.exit(1);
}

if (htmlEntryPaths.some((entryPath) => !fs.existsSync(entryPath)) || !fs.existsSync(assetsPath)) {
  fail("Vite output is missing an HTML entry or the assets directory");
}

const htmlAssetReferences = htmlEntryPaths.flatMap((entryPath) => {
  const html = fs.readFileSync(entryPath, "utf8");
  return [...html.matchAll(/\b(?:src|href)=["']([^"']*assets\/[^"']+)["']/g)].map(
    (match) => `${path.basename(entryPath)}: ${match[1]}`
  );
});

const nonCanonicalHtmlReferences = htmlAssetReferences.filter(
  (reference) => !reference.slice(reference.indexOf(": ") + 2).startsWith("/assets/")
);
if (nonCanonicalHtmlReferences.length > 0) {
  fail("an HTML entry contains non-canonical asset URLs", nonCanonicalHtmlReferences);
}

const javascriptFiles = fs
  .readdirSync(assetsPath)
  .filter((filename) => filename.endsWith(".js"));
const rootlessDependencies = [];
const doubledDependencies = [];
const missingCanonicalDependencies = [];

for (const filename of javascriptFiles) {
  const source = fs.readFileSync(path.join(assetsPath, filename), "utf8");

  for (const match of source.matchAll(/["'](assets\/[^"'\\]+\.(?:js|css))["']/g)) {
    rootlessDependencies.push(`${filename}: ${match[1]}`);
  }

  for (const match of source.matchAll(/["'](\/assets\/assets\/[^"'\\]+)["']/g)) {
    doubledDependencies.push(`${filename}: ${match[1]}`);
  }

  for (const match of source.matchAll(/["']\/assets\/([^"'\\]+\.(?:js|css))["']/g)) {
    const dependency = match[1];
    if (!fs.existsSync(path.join(assetsPath, dependency))) {
      missingCanonicalDependencies.push(`${filename}: /assets/${dependency}`);
    }
  }
}

if (rootlessDependencies.length > 0) {
  fail(
    "JavaScript bundles contain rootless asset dependencies that crawlers can double-prefix",
    rootlessDependencies
  );
}

if (doubledDependencies.length > 0) {
  fail("JavaScript bundles contain doubled asset dependencies", doubledDependencies);
}

if (missingCanonicalDependencies.length > 0) {
  fail(
    "JavaScript bundles reference canonical assets that do not exist",
    missingCanonicalDependencies
  );
}

console.log(
  `[built-asset-urls] verified ${javascriptFiles.length} JavaScript bundles and ${htmlAssetReferences.length} HTML asset references`
);
