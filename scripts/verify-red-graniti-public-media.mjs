#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateRedGranitiPublicMediaManifest } from "./red-graniti-public-media-core.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "scripts/data/red-graniti-public-media-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const summary = validateRedGranitiPublicMediaManifest(manifest);
const manifestPaths = new Set(manifest.assets.map((asset) => asset.relativePath));
const legacyPrefix = manifest.target.legacyUrlPrefix;
const bundledMediaRoot = path.join(repoRoot, "client/public/images/businesses/red-graniti/source");
const productionRoots = [
  path.join(repoRoot, "client/src"),
  path.join(repoRoot, "server"),
  path.join(repoRoot, "shared"),
  path.join(repoRoot, "scripts"),
];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json"]);
const literalMediaPath =
  /\/images\/businesses\/red-graniti\/source\/[A-Za-z0-9_./-]+\.(?:avif|gif|jpe?g|png|svg|webp)/g;

function listFiles(root, excludedNames = new Set()) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (excludedNames.has(entry.name)) continue;
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(absolute, excludedNames));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

const bundledFiles = listFiles(bundledMediaRoot).filter(
  (filePath) => path.basename(filePath) !== ".gitkeep"
);
if (bundledFiles.length > 0) {
  throw new Error(
    `R.E.D. Graniti source media returned to the client build (${bundledFiles.length} files). Upload it through the public-media migration instead.`
  );
}

const referencedPaths = new Set();
const missingManifestPaths = new Set();
for (const root of productionRoots) {
  for (const filePath of listFiles(root, new Set(["tests", "_archive"]))) {
    if (!sourceExtensions.has(path.extname(filePath))) continue;
    if (/\.(?:test|spec)\.[^.]+$/.test(filePath)) continue;
    if (filePath === manifestPath) continue;
    const source = fs.readFileSync(filePath, "utf8");
    for (const match of source.matchAll(literalMediaPath)) {
      const publicPath = match[0];
      const relativePath = publicPath.slice(legacyPrefix.length);
      referencedPaths.add(publicPath);
      if (!manifestPaths.has(relativePath)) missingManifestPaths.add(publicPath);
    }
  }
}

if (missingManifestPaths.size > 0) {
  throw new Error(
    `Public R.E.D. Graniti media references are missing from the migration manifest:\n${[
      ...missingManifestPaths,
    ]
      .slice(0, 30)
      .join("\n")}`
  );
}

console.log(
  `[red-graniti-public-media] verified ${summary.files} R2 assets (${summary.bytes} bytes), ${referencedPaths.size} source references, and zero bundled source-media files`
);
