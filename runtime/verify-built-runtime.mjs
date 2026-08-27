import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const appRoot = process.cwd();
const requireFromRunner = createRequire(path.join(appRoot, "package.json"));
const evidence = JSON.parse(
  fs.readFileSync(path.join(appRoot, "dist", "runtime-externals.json"), "utf8")
);
const runtimePackage = JSON.parse(
  fs.readFileSync(path.join(appRoot, "runtime", "package.json"), "utf8")
);
const declared = new Set(Object.keys(runtimePackage.dependencies || {}));
const optional = new Set([
  "@aws-sdk/signature-v4-crt",
  "@node-rs/xxhash",
  "@opentelemetry/api",
  "@opentelemetry/sdk-metrics",
  "encoding",
  "pg-native",
  "utf-8-validate",
]);

const packageName = (specifier) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];

for (const specifier of evidence.packages || []) {
  const owner = packageName(specifier);
  assert.ok(
    declared.has(owner) || optional.has(owner),
    `undeclared runtime external: ${specifier}`
  );
  try {
    requireFromRunner.resolve(specifier);
  } catch (error) {
    if (!optional.has(owner)) throw error;
  }
}

for (const forbiddenRoot of ["server", "shared", "scripts", "client", "docs", "data"]) {
  assert.equal(
    fs.existsSync(path.join(appRoot, forbiddenRoot)),
    false,
    `${forbiddenRoot} leaked into runner`
  );
}

for (const requiredPath of [
  "dist/index.js",
  "dist/release/ensure-public-media-ready.mjs",
  "dist/release/migrate-jw-stone-public-media.mjs",
  "dist/release/migrate-red-graniti-public-media.mjs",
  "dist/release/migrate-profile-public-media.mjs",
  "dist/release/db-migrate-safe.mjs",
  "dist/release/check-required-production-schema.mjs",
  "dist/release/manifests/jw-stone-public-media-manifest.json",
  "dist/release/manifests/red-graniti-public-media-manifest.json",
  "dist/release/manifests/profile-public-media-manifest.json",
  "migrations/meta/_journal.json",
  "runtime/drizzle.config.mjs",
  "runtime/run-release.mjs",
]) {
  assert.ok(
    fs.existsSync(path.join(appRoot, requiredPath)),
    `missing runtime artifact: ${requiredPath}`
  );
}

const profileMediaManifest = JSON.parse(
  fs.readFileSync(
    path.join(appRoot, "dist/release/manifests/profile-public-media-manifest.json"),
    "utf8"
  )
);
for (const asset of profileMediaManifest.assets || []) {
  assert.equal(
    fs.existsSync(path.join(appRoot, "dist/public", `.${asset.publicPath}`)),
    false,
    `profile media leaked into the production runner: ${asset.publicPath}`
  );
}

console.log(`Built runtime boundary passed (${evidence.packages?.length || 0} externals).`);
