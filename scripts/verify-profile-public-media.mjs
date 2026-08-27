#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { validateProfilePublicMediaManifest } from "./profile-public-media-core.mjs";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "scripts/data/profile-public-media-manifest.json"), "utf8")
);
const summary = validateProfilePublicMediaManifest(manifest);
const manifestPaths = new Set(manifest.assets.map((asset) => asset.publicPath));

for (const asset of manifest.assets) {
  const sourcePath = path.join(root, manifest.source.pathPrefix, `.${asset.publicPath}`);
  if (fs.existsSync(sourcePath)) {
    throw new Error(`Release B profile media leaked into client/public: ${asset.publicPath}`);
  }
}

const migratedPrefixes = [
  "/images/businesses/honey-onyx/",
  "/images/businesses/issa-build/",
  "/images/businesses/jrs-auto-glass/",
  "/images/businesses/la-plumbing-solutions/",
  "/images/businesses/pro-fab-specialty-services/",
  "/images/businesses/red-graniti/logo/",
  "/images/businesses/steel-home-packages/",
  "/images/profiles/precision-aerial/",
];
const publicMediaReference =
  /\/images\/(?:businesses|profiles)\/[A-Za-z0-9._/-]+\.(?:avif|gif|jpe?g|png|svg|webp|mp4)/g;
const referenceRoots = ["client/src", "server", "shared"];

function* textFiles(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* textFiles(entryPath);
    else if (/\.(?:c?js|mjs|ts|tsx|json)$/.test(entry.name)) yield entryPath;
  }
}

const uncoveredReferences = [];
for (const relativeRoot of referenceRoots) {
  for (const filename of textFiles(path.join(root, relativeRoot))) {
    if (filename.includes(`${path.sep}tests${path.sep}`)) continue;
    const source = fs.readFileSync(filename, "utf8");
    for (const match of source.matchAll(publicMediaReference)) {
      const publicPath = match[0];
      if (
        migratedPrefixes.some((prefix) => publicPath.startsWith(prefix)) &&
        !manifestPaths.has(publicPath)
      ) {
        uncoveredReferences.push(`${path.relative(root, filename)}: ${publicPath}`);
      }
    }
  }
}
if (uncoveredReferences.length) {
  throw new Error(
    `Profile media references are outside the storage manifest:\n${uncoveredReferences.join("\n")}`
  );
}

if (process.argv.includes("--built")) {
  for (const asset of manifest.assets) {
    const builtPath = path.join(root, "dist/public", `.${asset.publicPath}`);
    if (fs.existsSync(builtPath)) {
      throw new Error(`Release B profile media leaked into dist/public: ${asset.publicPath}`);
    }
  }
}

console.log(
  `[profile-public-media] Release B verified ${summary.files} storage-only paths (${summary.bytes} bytes), zero client copies${process.argv.includes("--built") ? ", and zero built copies" : ""}`
);
