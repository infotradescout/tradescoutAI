import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("production release entries are bundled with evidence and an external guard", () => {
  const source = read("build-server.mjs");
  for (const entry of [
    "ensure-public-media-ready",
    "migrate-jw-stone-public-media",
    "migrate-red-graniti-public-media",
    "db-migrate-safe",
    "db-baseline-drizzle",
    "check-required-production-schema",
    "seed-businesses-places-new",
  ]) {
    assert.match(source, new RegExp(`['\"]${entry}['\"]\\s*:`));
  }
  assert.match(source, /metafile:\s*true/);
  assert.match(source, /assertRuntimeExternals\(externals\)/);
  assert.match(source, /dist\/runtime-externals\.json/);
  assert.match(source, /runtime['"], ['"]package\.json/);
  assert.match(source, /releaseManifestDirectory/);
  assert.match(source, /outExtension:\s*\{ ['"]\.js['"]: ['"]\.mjs['"] \}/);
});

test("media readiness supports source and colocated bundled migrations", () => {
  const source = read("scripts/ensure-public-media-ready.mjs");
  assert.match(source, /findRuntimeRoot/);
  assert.match(source, /path\.join\(scriptDirectory, scriptName\)/);
  assert.match(source, /PUBLIC_MEDIA_MANIFEST_DIR/);
  assert.match(source, /scriptDirectory, "manifests", filename/);
});

test("both bundled migration workers resolve copied manifests", () => {
  const resolver = read("scripts/public-media-manifest-path.mjs");
  assert.match(resolver, /PUBLIC_MEDIA_MANIFEST_DIR/);
  assert.match(resolver, /scriptDirectory, "manifests", filename/);
  for (const script of [
    "scripts/migrate-jw-stone-public-media.mjs",
    "scripts/migrate-red-graniti-public-media.mjs",
  ]) {
    assert.match(read(script), /resolvePublicMediaManifest\(/);
    assert.doesNotMatch(read(script), /scripts\/data\/(jw-stone|red-graniti)-public-media-manifest/);
  }
});

test("bundled database repair launches its colocated baseline helper", () => {
  const source = read("scripts/db-migrate-safe.mjs");
  assert.match(source, /path\.join\(scriptDirectory, "db-baseline-drizzle\.mjs"\)/);
  assert.match(source, /node \$\{baselineEntrypoint\(\)\}/);
});

test("runtime entrypoint resolver prefers a built production worker and preserves dev source", () => {
  const source = read("server/runtimeEntrypoints.ts");
  assert.match(source, /process\.env\.NODE_ENV === "production"/);
  assert.match(source, /fs\.existsSync\(bundledPath\)/);
  assert.match(source, /return bundledPath/);
  assert.match(source, /return path\.join\(cwd, sourceRelativePath\)/);
});

test("admin seed execution resolves the stable runtime worker", () => {
  const source = read("server/routes/admin.ts");
  assert.match(source, /resolveRuntimeEntrypoint\(/);
  assert.match(source, /"seed-businesses-places-new\.mjs"/);
  assert.doesNotMatch(source, /spawn\(process\.execPath, \["scripts\/seed_businesses_places_new\.mjs"\]/);
});
