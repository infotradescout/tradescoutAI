import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), "utf8");

test("uses the four production evidence layers and stays read-only", () => {
  const source = read("scripts/report-discovery-performance.mjs");

  assert.match(source, /bot_observation_events/);
  assert.match(source, /profile_view_events/);
  assert.match(source, /event_type = 'discovery_landing'/);
  assert.match(source, /work_request_events/);
  assert.match(source, /entryRequestId/);
  assert.match(source, /source_attributed_landings/);
  assert.match(source, /Search-engine impression data is not available/);
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE)\s+(?:INTO\s+)?[a-z_]+/i);
});

test("keeps conversion attribution tied to the issued identity", () => {
  const source = read("scripts/report-discovery-performance.mjs");

  assert.match(source, /wre\.metadata->>'entryRequestId'/);
  assert.match(source, /r\.entry_request_id = l\.entry_request_id/);
  assert.match(source, /wre\.type = 'created'/);
  assert.match(source, /verified server-issued entryRequestId/);
});

test("exposes a repeatable package command", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert.equal(
    packageJson.scripts["report:discovery-performance"],
    "node scripts/report-discovery-performance.mjs"
  );
});
