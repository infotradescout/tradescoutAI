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
  assert.ok(source.includes("is_publicly_exposable"));
  assert.ok(source.includes("profileVisibility"));
  assert.ok(source.includes("publicProfileIds"));
  assert.ok(source.includes("verified_badge"));
  assert.ok(source.includes("internal_admin"));
  assert.ok(source.includes("trust_gate_not_satisfied"));
  assert.ok(source.includes("unambiguous_profile_domains"));
  assert.ok(source.includes("profile_domain.configured_domain"));
  assert.ok(source.includes("unambiguous_custom_domains"));
  assert.ok(source.includes("p.seo_meta->>'customDomain'"));
  assert.ok(source.includes("e.content_type"));
  assert.ok(source.includes("e.host"));
  assert.ok(source.includes("row.is_publicly_exposable === true"));
  assert.equal(
    source.match(
      /COALESCE\(\s*NULLIF\(lower\(trim\(e\.entity_slug\)\), ''\),\s*custom_profile\.business_slug,/g
    )?.length,
    2
  );
  assert.equal(
    source.match(/AND NULLIF\(trim\(e\.entity_slug\), ''\) IS NULL/g)?.length,
    2
  );
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
  assert.equal(
    packageJson.scripts["test:discovery-performance"],
    "node --test scripts/report-discovery-performance.contract.test.mjs scripts/report-discovery-performance.phase.test.mjs"
  );
  assert.ok(read("scripts/run-minimum-release-contract.mjs").includes("test:discovery-performance"));
});
