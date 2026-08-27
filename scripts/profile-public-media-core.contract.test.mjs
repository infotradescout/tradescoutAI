import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  profilePublicMediaMarkerObjectKey,
  profilePublicMediaObjectMatches,
  profilePublicMediaSourceUrl,
  validateProfilePublicMediaManifest,
} from "./profile-public-media-core.mjs";
import { migrationArgumentsForReadiness } from "./public-media-deployment-gate-core.mjs";

const manifest = JSON.parse(
  fs.readFileSync(new URL("./data/profile-public-media-manifest.json", import.meta.url), "utf8")
);

test("profile public media manifest pins the complete Release A contract", () => {
  const summary = validateProfilePublicMediaManifest(manifest);
  assert.deepEqual(summary, {
    files: 56,
    bytes: 24531208,
    newObjects: 43,
    newObjectBytes: 20585139,
    aliases: 13,
    digest: "bedcce252d7bbf8ddedbe318e51eb00089085fbb177884c2272cfff368c2c814",
  });
  assert.equal(new Set(manifest.assets.map((asset) => asset.publicPath)).size, 56);
});

test("thirteen explicit legacy paths reuse verified JW objects", () => {
  const aliases = manifest.assets.filter((asset) => asset.aliasOfExistingObject);
  assert.equal(aliases.length, 13);
  assert.ok(
    aliases.every((asset) => asset.objectKey.includes("/jw-stone/inventory/onyx/honey-onyx/"))
  );
  assert.equal(
    manifest.assets.find((asset) => asset.publicPath.endsWith("hero-poster.jpg")).objectKey,
    "public-media/images/businesses/jw-stone/inventory/onyx/honey-onyx/2.jpg"
  );
});

test("new objects preserve their public compatibility paths and immutable source", () => {
  const asset = manifest.assets.find((candidate) => candidate.publicPath.endsWith("hero-reel.mp4"));
  assert.equal(asset.objectKey, `public-media${asset.publicPath}`);
  assert.match(
    profilePublicMediaSourceUrl(manifest, asset),
    /^https:\/\/raw\.githubusercontent\.com\//
  );
  assert.equal(
    profilePublicMediaMarkerObjectKey(manifest),
    "public-media/manifests/profile-public-media-v1.json"
  );
});

test("validator rejects traversal and unversioned inventory changes", () => {
  const changed = structuredClone(manifest);
  changed.assets[0].publicPath = "/images/businesses/%2e%2e/private.jpg";
  assert.throws(
    () => validateProfilePublicMediaManifest(changed),
    /Unsafe profile media public path/
  );
});

test("missing or corrupt alias objects fail identity verification", async () => {
  const alias = manifest.assets.find((asset) => asset.aliasOfExistingObject);
  const body = fs.readFileSync(
    new URL(`../${manifest.source.pathPrefix}${alias.publicPath}`, import.meta.url)
  );
  const valid = {
    ContentLength: alias.bytes,
    ContentType: alias.contentType,
    CacheControl: "public, max-age=31536000, immutable",
    Metadata: { "source-blob-sha": alias.gitBlobSha, "migration-id": "jw-stone-public-media-v1" },
    Body: body,
  };
  assert.equal(await profilePublicMediaObjectMatches(alias, null, manifest.migrationId), false);
  assert.equal(
    await profilePublicMediaObjectMatches(
      alias,
      { ...valid, Body: Buffer.alloc(alias.bytes, 0x61) },
      manifest.migrationId
    ),
    false,
    "equal-length corruption must fail the Git blob hash"
  );
  assert.equal(
    await profilePublicMediaObjectMatches(
      alias,
      { ...valid, ContentType: "image/png" },
      manifest.migrationId
    ),
    false,
    "wrong MIME must fail"
  );
  assert.equal(
    await profilePublicMediaObjectMatches(
      alias,
      { ...valid, CacheControl: "no-cache" },
      manifest.migrationId
    ),
    false,
    "wrong cache policy must fail"
  );
  assert.equal(await profilePublicMediaObjectMatches(alias, valid, manifest.migrationId), true);
});

test("migration markers record completion but never skip per-object verification", () => {
  const source = fs.readFileSync(
    new URL("./migrate-profile-public-media.mjs", import.meta.url),
    "utf8"
  );
  const poolIndex = source.indexOf("await runPool(uniqueAssets");
  const markerIndex = source.indexOf("const existingMarker = await readJson");
  assert.ok(poolIndex >= 0 && markerIndex > poolIndex);
  assert.doesNotMatch(source.slice(0, markerIndex), /if \(migrationMarkerMatches/);
  assert.doesNotMatch(source, /if \(migrationMarkerMatches[^)]*\)\s*(?:return|process\.exit)/);
  assert.match(source, /required existing JW alias object is missing or unverified/);
  assert.match(source, /const uniqueAssets =/);
  assert.match(source, /await getObject\(/);
});

test("startup always verifies profile objects even when a deployment marker is valid", () => {
  assert.deepEqual(migrationArgumentsForReadiness(false, true), []);
  assert.deepEqual(migrationArgumentsForReadiness(true, true), ["--verify-only"]);
  assert.equal(migrationArgumentsForReadiness(true, false), null);
  const source = fs.readFileSync(
    new URL("./ensure-public-media-ready.mjs", import.meta.url),
    "utf8"
  );
  assert.match(
    source,
    /migrationScript: "migrate-profile-public-media\.mjs",\s+alwaysVerify: true/
  );
  assert.match(source, /migrationArgumentsForReadiness/);
  assert.match(source, /runMigration\(contracts\[index\]\.migrationScript, migrationArgs\)/);
});
