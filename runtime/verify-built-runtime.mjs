import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";

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
  "dist/release/run-production-predeploy.mjs",
  "dist/release/ensure-public-media-ready.mjs",
  "dist/release/migrate-jw-stone-public-media.mjs",
  "dist/release/migrate-red-graniti-public-media.mjs",
  "dist/release/migrate-profile-public-media.mjs",
  "dist/release/db-migrate-safe.mjs",
  "dist/release/check-required-production-schema.mjs",
  "dist/release/manifests/jw-stone-public-media-manifest.json",
  "dist/release/manifests/red-graniti-public-media-manifest.json",
  "dist/release/manifests/profile-public-media-manifest.json",
  "dist/release/manifests/public-shell-local-dedupe-manifest.json",
  "migrations/meta/_journal.json",
  "runtime/database-url-security.mjs",
  "runtime/drizzle.config.mjs",
  "runtime/run-release.mjs",
]) {
  assert.ok(
    fs.existsSync(path.join(appRoot, requiredPath)),
    `missing runtime artifact: ${requiredPath}`
  );
}

const databaseUrlSecuritySource = fs.readFileSync(
  path.join(appRoot, "runtime", "database-url-security.mjs"),
  "utf8"
);
assert.match(
  databaseUrlSecuritySource,
  /sslmode["']?,?\s*["']verify-full["']/,
  "runtime database URL guard must enforce sslmode=verify-full"
);
assert.doesNotMatch(
  databaseUrlSecuritySource,
  /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0/,
  "runtime database URL guard may not disable TLS certificate verification"
);

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

const shellDedupeManifest = JSON.parse(
  fs.readFileSync(
    path.join(appRoot, "dist/release/manifests/public-shell-local-dedupe-manifest.json"),
    "utf8"
  )
);
const shellEntries = shellDedupeManifest.entries || [];
assert.equal(shellEntries.length, 10, "public shell runtime manifest path count changed");
assert.equal(
  shellEntries.filter((entry) => entry.kind === "alias").length,
  6,
  "public shell runtime alias count changed"
);
assert.equal(
  shellEntries.filter((entry) => entry.kind === "dead-pinned").length,
  4,
  "public shell runtime dead-path count changed"
);
const gitBlobSha = (buffer) =>
  createHash("sha1").update(`blob ${buffer.length}\0`).update(buffer).digest("hex");
for (const entry of shellEntries) {
  const publicFile = path.join(appRoot, "dist/public", `.${entry.publicPath}`);
  assert.equal(
    fs.existsSync(publicFile),
    false,
    `removed public shell path leaked into runtime: ${entry.publicPath}`
  );
  if (entry.kind === "alias") {
    const canonicalFile = path.join(appRoot, "dist/public", `.${entry.canonicalPath}`);
    assert.ok(
      fs.existsSync(canonicalFile),
      `public shell canonical path missing: ${entry.canonicalPath}`
    );
    const canonicalBytes = fs.readFileSync(canonicalFile);
    assert.equal(
      canonicalBytes.length,
      entry.bytes,
      `public shell canonical bytes changed: ${entry.canonicalPath}`
    );
    assert.equal(
      gitBlobSha(canonicalBytes),
      entry.gitBlobSha,
      `public shell canonical blob changed: ${entry.canonicalPath}`
    );
  }
}

console.log(`Built runtime boundary passed (${evidence.packages?.length || 0} externals).`);
