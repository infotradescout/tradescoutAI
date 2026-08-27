import test from "node:test";
import assert from "node:assert/strict";
import {
  createDeploymentVerificationMarker,
  deploymentMarkerObjectKey,
  deploymentRevisionFromEnvironment,
  deploymentVerificationMarkerMatches,
} from "./public-media-deployment-gate-core.mjs";

const revision = "4aaf534ffb6831d060987b1882ca4cc9e6556333";
const manifest = { migrationId: "jw-stone-public-media-v1" };
const summary = { digest: "a".repeat(64), files: 899, bytes: 175020735 };

test("deployment markers are isolated to the exact Render release", () => {
  assert.equal(
    deploymentMarkerObjectKey(manifest, revision),
    `public-media/deployments/${revision}/jw-stone-public-media-v1.json`
  );
  assert.equal(deploymentRevisionFromEnvironment({ RENDER_GIT_COMMIT: revision }), revision);
});

test("deployment verification rejects another release or changed totals", () => {
  const marker = createDeploymentVerificationMarker(
    manifest,
    summary,
    revision,
    "2026-08-27T00:00:00.000Z"
  );
  assert.equal(deploymentVerificationMarkerMatches(marker, manifest, summary, revision), true);
  assert.equal(
    deploymentVerificationMarkerMatches(marker, manifest, summary, "b".repeat(40)),
    false
  );
  assert.equal(
    deploymentVerificationMarkerMatches(marker, manifest, { ...summary, files: 898 }, revision),
    false
  );
});

test("malformed release identities and migration ids are rejected", () => {
  assert.throws(
    () => deploymentRevisionFromEnvironment({ RENDER_GIT_COMMIT: "main" }),
    /full Git commit identity/
  );
  assert.throws(
    () => deploymentMarkerObjectKey({ migrationId: "../private" }, revision),
    /Unsafe public media migration id/
  );
});
