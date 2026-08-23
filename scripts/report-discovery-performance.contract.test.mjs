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
  assert.ok(source.includes("event_type = 'public_profile_discovered'"));
  assert.ok(source.includes("'public_profile_cta'"));
  assert.ok(source.includes("data->>'serverVerified' = 'true'"));
  assert.ok(source.includes("data->>'ctaKind' IN"));
  assert.ok(source.includes("'direct_connect', 'account_create', 'business_claim', 'booking_request'"));
  assert.ok(source.includes("'acquisition.registration_completed'"));
  assert.ok(source.includes("'acquisition.activation_completed'"));
  assert.ok(source.includes("users.created_at"));
  assert.ok(source.includes("onboardingOutcome"));
  assert.ok(source.includes("missing_registration_projections"));
  assert.ok(source.includes("missing_activation_projections"));
  assert.ok(source.includes("consumer-provider candidate cohort"));
  assert.ok(source.includes("excluded_system_provider_account_creations"));
  assert.ok(source.includes("provider does not prove channel"));
  assert.ok(source.includes("without a durable origin field"));
  assert.ok(source.includes("referrerClass"));
  assert.ok(source.includes("ELSE 'referral'"));
  assert.ok(source.includes("pg_input_is_valid"));
  assert.ok(source.includes("const windowSqlParams = [from.toISOString(), to.toISOString()]"));
  assert.ok(!source.includes("pool.query(acquisitionFunnelSql, [from, to])"));
  assert.ok(source.includes("pending_production_activation"));
  assert.ok(source.includes("governed_directory_business"));
  assert.ok(source.includes("entryRequestId"));
  assert.ok(source.includes("source_attributed_landings"));
  assert.ok(source.includes("Search-engine impression data is not available"));
  assert.ok(source.includes("recognized user-agent bots are excluded"));
  assert.ok(source.includes("does not prove a human or unique visitor"));
  assert.ok(source.includes("Neither signal proves a human or unique visitor"));
  assert.ok(!source.includes("measured human entry"));
  assert.ok(source.includes("is_publicly_exposable"));
  assert.ok(source.includes("publicProfileIds"));
  assert.ok(!source.includes("preferences->>'profileVisibility'"));
  assert.ok(source.includes("p.role_context"));
  assert.ok(source.includes("public_discovery_enabled"));
  assert.ok(source.includes("has_meaningful_content"));
  assert.ok(source.includes("ts_seo_directory_business_pages"));
  assert.ok(source.includes("completed_directory_snapshot"));
  assert.ok(source.includes("status.completed_at >= now() - interval '24 hours'"));
  assert.ok(source.includes("status.completed_at <= now() + interval '5 minutes'"));
  assert.ok(source.includes("verified_badge"));
  assert.ok(source.includes("internal_admin"));
  assert.ok(source.includes("trust_gate_not_satisfied"));
  assert.ok(source.includes("unambiguous_profile_domains"));
  assert.ok(source.includes("profile_domain.configured_domain"));
  assert.ok(source.includes("unambiguous_custom_domains"));
  assert.ok(source.includes("p.seo_meta->>'customDomain'"));
  assert.ok(source.includes("e.content_type"));
  assert.ok(source.includes("e.host"));
  assert.ok(source.includes("e.entity_type"));
  assert.ok(source.includes("row.is_publicly_exposable === true"));
  assert.equal(
    source.match(
      /COALESCE\(\s*CASE\s+WHEN lower\(trim\(COALESCE\(e\.entity_type, ''\)\)\) IN \('profile', 'business'\)\s+THEN NULLIF\(lower\(trim\(e\.entity_slug\)\), ''\)\s+ELSE NULL\s+END,\s*custom_profile\.business_slug,/g
    )?.length,
    2
  );
  assert.equal(
    source.match(
      /AND NOT \(\s*lower\(trim\(COALESCE\(e\.entity_type, ''\)\)\) IN \('profile', 'business'\)\s*AND NULLIF\(trim\(e\.entity_slug\), ''\) IS NOT NULL\s*\)/g
    )?.length,
    2
  );
  assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE)\s+(?:INTO\s+)?[a-z_]+/i);
});

test("treats lifecycle events as projections and keeps source linkage signed", () => {
  const source = read("scripts/report-discovery-performance.mjs");

  assert.ok(source.includes("Lifecycle events are attribution projections"));
  assert.ok(source.includes("completed-snapshot /business entity"));
  assert.ok(source.includes("Direct-only profiles are excluded"));
  assert.ok(source.includes("Durable transactional attribution/outbox delivery is not active"));
  assert.ok(source.includes("D4 hardening debt"));
  assert.ok(!source.includes("authoritative acquisition funnel release"));
  assert.ok(source.includes("landing.data->>'entryRequestId'"));
  assert.ok(source.includes("source.entry_request_id = milestone.entry_request_id"));
  assert.ok(source.includes("Zeroes before activation are not interpreted as funnel failure"));
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
    "node --test scripts/report-discovery-performance.contract.test.mjs scripts/report-discovery-performance.phase.test.mjs scripts/search-console-performance.contract.test.mjs"
  );
  assert.ok(read("scripts/run-minimum-release-contract.mjs").includes("test:discovery-performance"));
});
