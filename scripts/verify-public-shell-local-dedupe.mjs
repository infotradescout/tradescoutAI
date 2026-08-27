#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  assertNoUnreviewedDynamicLandingMedia,
  gitBlobSha,
  validatePublicShellDedupeManifest,
} from "./public-shell-local-dedupe-core.mjs";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "scripts/data/public-shell-local-dedupe-manifest.json"), "utf8")
);
const summary = validatePublicShellDedupeManifest(manifest);

function productionSourceFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (relative.includes("/tests") || relative === "scripts/data") continue;
      files.push(...productionSourceFiles(absolute));
    } else if (
      /\.(?:css|html|js|mjs|ts|tsx)$/.test(entry.name) &&
      !/\.test\.|\.contract\./.test(entry.name) &&
      relative !== "scripts/verify-public-shell-local-dedupe.mjs" &&
      relative !== "scripts/public-shell-local-dedupe-core.mjs"
    ) {
      files.push(relative);
    }
  }
  return files.sort();
}

const productionFiles = ["client/src", "server", "shared", "scripts"]
  .flatMap((directory) => productionSourceFiles(path.join(root, directory)))
  .sort();
const sourceByPath = new Map(
  productionFiles.map((relative) => [relative, fs.readFileSync(path.join(root, relative), "utf8")])
);
for (const entry of manifest.entries.filter((candidate) => candidate.kind === "dead-pinned")) {
  const references = [...sourceByPath]
    .filter(([, source]) => source.includes(entry.publicPath))
    .map(([relative]) => relative);
  if (references.length) {
    throw new Error(`Dead pinned shell path regained production references: ${entry.publicPath}`);
  }
}
for (const [publicPath, expectedOwners] of Object.entries(manifest.liveLandingOwners)) {
  const owners = [...sourceByPath]
    .filter(([, source]) => source.includes(publicPath))
    .map(([relative]) => relative);
  if (JSON.stringify(owners) !== JSON.stringify(expectedOwners)) {
    throw new Error(`Live landing ownership changed: ${publicPath}`);
  }
}
assertNoUnreviewedDynamicLandingMedia(sourceByPath, []);

const roots = [path.join(root, manifest.source.pathPrefix)];
if (process.argv.includes("--built")) roots.push(path.join(root, "dist/public"));
for (const publicRoot of roots) {
  for (const entry of manifest.entries) {
    const removedPath = path.join(publicRoot, `.${entry.publicPath}`);
    if (fs.existsSync(removedPath))
      throw new Error(`Removed public shell path leaked into Release B: ${entry.publicPath}`);
    if (entry.kind === "alias") {
      const canonical = fs.readFileSync(path.join(publicRoot, `.${entry.canonicalPath}`));
      if (canonical.length !== entry.bytes || gitBlobSha(canonical) !== entry.gitBlobSha) {
        throw new Error(`Public shell canonical identity changed: ${entry.canonicalPath}`);
      }
    }
  }
}
function publicFileStats(directory) {
  let files = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = publicFileStats(absolute);
      files += nested.files;
      bytes += nested.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += fs.statSync(absolute).size;
    }
  }
  return { files, bytes };
}
const clientPublic = publicFileStats(path.join(root, manifest.source.pathPrefix));
if (
  clientPublic.files !== manifest.expected.clientPublicFiles ||
  clientPublic.bytes !== manifest.expected.clientPublicBytes
) {
  throw new Error("Release B client/public totals changed without review");
}
console.log(
  `[public-shell-dedupe] Release B verified ${summary.files} removed paths (${summary.bytes} bytes), ${summary.aliases} compatibility aliases, and ${summary.deadPinned} dead pinned paths`
);
