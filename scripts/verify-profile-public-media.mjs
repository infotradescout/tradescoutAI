#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { gitBlobSha } from "./jw-stone-public-media-core.mjs";
import { validateProfilePublicMediaManifest } from "./profile-public-media-core.mjs";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "scripts/data/profile-public-media-manifest.json"), "utf8")
);
const summary = validateProfilePublicMediaManifest(manifest);
for (const asset of manifest.assets) {
  const sourcePath = path.join(root, manifest.source.pathPrefix, `.${asset.publicPath}`);
  const bytes = fs.readFileSync(sourcePath);
  if (bytes.length !== asset.bytes || gitBlobSha(bytes) !== asset.gitBlobSha) {
    throw new Error(`Profile media source identity changed: ${asset.publicPath}`);
  }
}
console.log(
  `[profile-public-media] Release A verified ${summary.files} retained paths (${summary.bytes} bytes), ${summary.aliases} aliases, and ${summary.newObjects} new objects`
);
