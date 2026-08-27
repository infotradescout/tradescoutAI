import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  markerObjectKey,
  sha256,
  sourceAssetUrl,
  targetObjectKey,
  validateRedGranitiPublicMediaManifest,
} from "./red-graniti-public-media-core.mjs";

const manifest = JSON.parse(
  fs.readFileSync(new URL("./data/red-graniti-public-media-manifest.json", import.meta.url), "utf8")
);

test("R.E.D. Graniti public media manifest is complete and internally consistent", () => {
  const summary = validateRedGranitiPublicMediaManifest(manifest);
  assert.equal(summary.files, 11);
  assert.equal(summary.bytes, 2433960);
});

test("legacy URLs map into the isolated object prefix", () => {
  const asset = manifest.assets.find((candidate) => candidate.relativePath === "home-hero.svg");
  assert.ok(asset);
  assert.equal(
    targetObjectKey(manifest, asset.relativePath),
    "public-media/images/businesses/red-graniti/source/home-hero.svg"
  );
  assert.equal(
    sourceAssetUrl(manifest, asset.relativePath),
    "https://www.thetradescout.com/images/businesses/red-graniti/source/home-hero.svg"
  );
  assert.equal(
    markerObjectKey(manifest),
    "public-media/manifests/red-graniti-public-media-v1.json"
  );
});

test("source digest verification rejects changed bytes", () => {
  assert.equal(
    sha256(Buffer.from("hello\n")),
    "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"
  );
  assert.notEqual(
    sha256(Buffer.from("changed\n")),
    "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03"
  );
});
