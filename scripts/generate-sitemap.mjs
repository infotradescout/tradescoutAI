#!/usr/bin/env node

/**
 * Production prebuild entrypoint.
 *
 * JW Stone color logic and the server-media manifest are contract-checked before
 * Vite reads the catalog. The R.E.D. Graniti public-media manifest is checked in
 * the same gate. Media is created during ingest or migration, never downloaded,
 * copied, or regenerated inside the client build.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

const scriptsDir = import.meta.dirname;
const repoRoot = path.resolve(scriptsDir, "..");

function runNode(args) {
  execFileSync(process.execPath, args, {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

runNode([
  "--test",
  path.join(scriptsDir, "jw-stone-face-color-core.contract.test.mjs"),
  path.join(scriptsDir, "jw-stone-color-bucket-accuracy.contract.test.mjs"),
  path.join(scriptsDir, "jw-stone-public-media-core.contract.test.mjs"),
  path.join(scriptsDir, "red-graniti-public-media-core.contract.test.mjs"),
  path.join(scriptsDir, "public-media-deployment-gate-core.contract.test.mjs"),
  path.join(scriptsDir, "server-object-storage.contract.test.mjs"),
  path.join(scriptsDir, "postgres-public-media-s3-client.contract.test.mjs"),
]);
runNode([path.join(scriptsDir, "verify-jw-stone-public-media.mjs")]);
runNode([path.join(scriptsDir, "verify-red-graniti-public-media.mjs")]);

await import("./generate-sitemap-core.mjs");
