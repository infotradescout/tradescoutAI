import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  assertNoUnreviewedDynamicLandingMedia,
  gitBlobSha,
  validatePublicShellDedupeManifest,
} from "./public-shell-local-dedupe-core.mjs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(
  fs.readFileSync(
    new URL("./data/public-shell-local-dedupe-manifest.json", import.meta.url),
    "utf8"
  )
);

test("Release A pins six aliases and four dead paths without deleting bytes", () => {
  assert.deepEqual(validatePublicShellDedupeManifest(manifest), {
    files: 10,
    bytes: 1433218,
    aliases: 6,
    deadPinned: 4,
    digest: "cc384baaf127ea06cfd89e6e12f15d1a4d1eb5a0b9189aa6b26ba097ca530839",
  });
  for (const entry of manifest.entries) {
    const bytes = fs.readFileSync(new URL(`client/public/${entry.publicPath.slice(1)}`, root));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(gitBlobSha(bytes), entry.gitBlobSha);
  }
});

test("every alias is byte-identical to its canonical retained file", () => {
  for (const entry of manifest.entries.filter((candidate) => candidate.kind === "alias")) {
    const alias = fs.readFileSync(new URL(`client/public/${entry.publicPath.slice(1)}`, root));
    const canonical = fs.readFileSync(
      new URL(`client/public/${entry.canonicalPath.slice(1)}`, root)
    );
    assert.deepEqual(alias, canonical);
  }
});

test("unsafe or changed alias contracts fail closed", () => {
  const unsafe = structuredClone(manifest);
  unsafe.entries[0].publicPath = "/%2e%2e/private.png";
  assert.throws(() => validatePublicShellDedupeManifest(unsafe), /Unsafe public shell path/);
  const changed = structuredClone(manifest);
  changed.entries[0].canonicalPath = changed.entries[0].publicPath;
  assert.throws(() => validatePublicShellDedupeManifest(changed), /Unsafe public shell alias/);
  const contentType = structuredClone(manifest);
  contentType.entries[0].contentType = "application/octet-stream";
  assert.throws(
    () => validatePublicShellDedupeManifest(contentType),
    /Invalid public shell content type/
  );
});

test("production route order canonicalizes aliases before identity and static serving", () => {
  const server = fs.readFileSync(new URL("../server/index.ts", import.meta.url), "utf8");
  const alias = server.indexOf("registerPublicShellAliasRoutes(app)");
  const identity = server.indexOf("const identityAssets = new Set", alias);
  const identityGet = server.indexOf("app.get(Array.from(identityAssets)", identity);
  const staticServe = server.indexOf("express.static(publicDistPath", identityGet);
  assert.ok(alias >= 0 && identity > alias && identityGet > identity && staticServe > identityGet);
});

test("dead landing paths stay reference-free while live owners remain explicit", () => {
  const verifier = fs.readFileSync(
    new URL("./verify-public-shell-local-dedupe.mjs", import.meta.url),
    "utf8"
  );
  assert.match(verifier, /dead-pinned/);
  assert.match(verifier, /Dead pinned shell path regained production references/);
  assert.match(verifier, /Live landing ownership changed/);
  assert.match(verifier, /assertNoUnreviewedDynamicLandingMedia\(sourceByPath, \[\]\)/);
});

test("dynamic landing media construction is rejected in every non-reviewed production source", () => {
  const clean = new Map([
    ["client/src/pages/landingVariants.ts", 'const hero = "/landing/hero.jpg";'],
  ]);
  assert.doesNotThrow(() => assertNoUnreviewedDynamicLandingMedia(clean, []));

  const mutated = new Map(clean);
  mutated.set(
    "client/src/pages/unrelated-production-source.ts",
    "const image = `/landing/${variant}.webp`;"
  );
  assert.throws(
    () => assertNoUnreviewedDynamicLandingMedia(mutated, []),
    /Dynamic landing media construction requires explicit review: client\/src\/pages\/unrelated-production-source\.ts/
  );
  assert.doesNotThrow(() =>
    assertNoUnreviewedDynamicLandingMedia(mutated, [
      "client/src/pages/unrelated-production-source.ts",
    ])
  );
});
