import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), "utf8");

test("uses the four production evidence layers and stays read-only", () => {
  const source = read("scripts/report-discovery-performance.mjs");

  assert.ok(source.includes("bot_observation_events"));
  assert.ok(source.includes("profile_view_events"));
  assert.ok(source.includes("event_type = 'discovery_landing'"));
  assert.ok(source.includes("work_request_events"));
  assert.ok(source.includes("entryRequestId"));
  assert.ok(source.includes("source_attributed_landings"));
  assert.ok(source.includes("Search-engine impression data is not available"));
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE)\s+(?:INTO\s+)?[a-z_]+/i);
});

test("keeps conversion attribution tied to the issued identity", () => {
  const source = read("scripts/report-discovery-performance.mjs");

  assert.ok(source.includes("wre.metadata->>'entryRequestId'"));
  assert.ok(source.includes("r.entry_request_id = l.entry_request_id"));
  assert.ok(source.includes("wre.type = 'created'"));
  assert.ok(source.includes("verified server-issued entryRequestId"));
});

test("exposes a repeatable package command", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert.equal(
    packageJson.scripts["report:discovery-performance"],
    "node scripts/report-discovery-performance.mjs"
  );
});
