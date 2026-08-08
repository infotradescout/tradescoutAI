import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReport,
  DISCOVERY_PERFORMANCE_RELEASE,
} from "./report-discovery-performance.mjs";

const activationAt = new Date(DISCOVERY_PERFORMANCE_RELEASE.productionActivatedAt);

function buildHistoricalReport() {
  return buildReport({
    catalogRows: [
      { business_slug: "example-business", display_name: "Example Business", canonical_route: "/u/example-business" },
      { business_slug: "uncrawled-business", display_name: "Uncrawled Business", canonical_route: "/u/uncrawled-business" },
    ],
    crawlRows: [
      {
        business_slug: "example-business",
        crawl_hits: 2,
        crawl_successes: 2,
        crawl_client_errors: 0,
        crawl_server_errors: 0,
        crawler_count: 1,
        unique_urls: 1,
        first_seen_urls: 1,
        recrawl_urls: 1,
      },
    ],
    crawlFamilyRows: [
      { business_slug: "example-business", crawler_family: "OAI-SearchBot", crawl_requests: 2 },
    ],
    landingRows: [
      {
        business_slug: "example-business",
        landing_events: 1,
        unique_visitors: 1,
        attributed_landings: 1,
        source_attributed_landings: 1,
      },
    ],
    sourceRows: [
      { business_slug: "example-business", source: "utm:chatgpt", attributed_landings: 1 },
    ],
    profileViewRows: [],
    conversionRows: [{ business_slug: "example-business", attributed_landings: 1, converted_requests: 1 }],
    generatedAt: "2026-08-08T17:36:32.672Z",
    from: new Date("2026-07-09T18:29:33.584Z"),
    to: activationAt,
    windowDays: 30,
    productionActivationAt: activationAt,
  });
}

test("historical windows mark signed attribution and conversion as not applicable", () => {
  const report = buildHistoricalReport();

  assert.equal(report.measurement.phase, "historical_pre_release");
  assert.equal(report.measurement.signedAttribution.status, "not_applicable");
  assert.equal(report.measurement.discoveryConversion.status, "not_applicable");
  assert.equal(report.summary.verifiedAttributions, null);
  assert.equal(report.summary.convertedRequests, null);
  assert.deepEqual(report.coverage.uncrawledProfiles, [
    { slug: "uncrawled-business", displayName: "Uncrawled Business" },
  ]);
  assert.deepEqual(report.crawlDistributionByCrawlerFamily, [
    { crawlerFamily: "OAI-SearchBot", crawlRequests: 2 },
  ]);
  assert.equal(report.requestDistributionByProfile.status, "not_applicable");
  assert.equal(report.profiles[0].converted.requests, null);
});

test("post-release windows measure source attribution and conversion", () => {
  const report = buildReport({
    catalogRows: [
      { business_slug: "example-business", display_name: "Example Business", canonical_route: "/u/example-business" },
    ],
    crawlRows: [],
    crawlFamilyRows: [],
    landingRows: [{
      business_slug: "example-business",
      landing_events: 2,
      unique_visitors: 2,
      attributed_landings: 2,
      source_attributed_landings: 2,
    }],
    sourceRows: [{ business_slug: "example-business", source: "utm:chatgpt", attributed_landings: 2 }],
    profileViewRows: [],
    conversionRows: [{ business_slug: "example-business", attributed_landings: 2, converted_requests: 1 }],
    generatedAt: "2026-08-08T18:00:00.000Z",
    from: new Date("2026-08-08T17:36:32.673Z"),
    to: new Date("2026-08-08T18:00:00.000Z"),
    windowDays: 1,
    productionActivationAt: activationAt,
  });

  assert.equal(report.measurement.phase, "post_release");
  assert.equal(report.summary.verifiedAttributions, 2);
  assert.equal(report.summary.convertedRequests, 1);
  assert.equal(report.requestDistributionByProfile.status, "measured");
  assert.equal(report.requestDistributionByProfile.items[0].requests, 1);
});

test("windows crossing activation do not measure signed attribution or conversion", () => {
  const report = buildReport({
    catalogRows: [
      { business_slug: "example-business", display_name: "Example Business", canonical_route: "/u/example-business" },
    ],
    crawlRows: [],
    crawlFamilyRows: [],
    landingRows: [{
      business_slug: "example-business",
      landing_events: 2,
      unique_visitors: 2,
      attributed_landings: 2,
      source_attributed_landings: 2,
    }],
    sourceRows: [{ business_slug: "example-business", source: "utm:chatgpt", attributed_landings: 2 }],
    profileViewRows: [],
    conversionRows: [{ business_slug: "example-business", attributed_landings: 2, converted_requests: 1 }],
    generatedAt: "2026-08-08T18:00:00.000Z",
    from: new Date("2026-08-08T17:00:00.000Z"),
    to: new Date("2026-08-08T18:00:00.000Z"),
    windowDays: 1,
    productionActivationAt: activationAt,
  });

  assert.equal(report.measurement.phase, "crosses_release_boundary");
  assert.equal(report.measurement.signedAttribution.status, "not_applicable");
  assert.equal(report.measurement.discoveryConversion.status, "not_applicable");
  assert.equal(report.summary.convertedRequests, null);
  assert.equal(report.requestDistributionByProfile.status, "not_applicable");
});
