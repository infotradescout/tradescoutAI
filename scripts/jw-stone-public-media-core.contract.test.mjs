import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  gitBlobSha,
  markerObjectKey,
  sourceAssetUrl,
  targetObjectKey,
  validateJwStonePublicMediaManifest,
} from "./jw-stone-public-media-core.mjs";

const manifest = JSON.parse(
  fs.readFileSync(new URL("./data/jw-stone-public-media-manifest.json", import.meta.url), "utf8")
);

test("JW Stone public media manifest is complete and internally consistent", () => {
  const summary = validateJwStonePublicMediaManifest(manifest);
  assert.equal(summary.files, 899);
  assert.equal(summary.bytes, 175020735);
});

test("public media migration preserves URL paths under an isolated object prefix", () => {
  const asset = manifest.assets.find((candidate) => candidate.relativePath.endsWith("logo.svg"));
  assert.ok(asset);
  assert.equal(
    targetObjectKey(manifest, asset.relativePath),
    `public-media/images/businesses/jw-stone/${asset.relativePath}`
  );
  assert.match(
    sourceAssetUrl(manifest, asset.relativePath),
    /^https:\/\/raw\.githubusercontent\.com\//
  );
  assert.equal(markerObjectKey(manifest), "public-media/manifests/jw-stone-public-media-v1.json");
});

test("Git blob verification rejects changed media bytes", () => {
  assert.equal(gitBlobSha(Buffer.from("hello\n")), "ce013625030ba8dba906f756967f9e9ca394464a");
  assert.notEqual(gitBlobSha(Buffer.from("changed\n")), "ce013625030ba8dba906f756967f9e9ca394464a");
});
