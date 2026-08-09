import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarkdown,
  buildReport,
  DISCOVERY_PERFORMANCE_RELEASE,
  parseDateArgument,
  parsePositiveDays,
} from "./report-discovery-performance.mjs";

const activationAt = new Date(DISCOVERY_PERFORMANCE_RELEASE.productionActivatedAt);

function buildHistoricalReport() {
  return buildReport({
    catalogRows: [
      { business_slug: "example-business", display_name: "Example Business", canonical_route: "/u/example-business", is_publicly_exposable: true },
      { business_slug: "uncrawled-business", display_name: "Uncrawled Business", canonical_route: "/u/uncrawled-business", is_publicly_exposable: true },
      {
        business_slug: "private-business",
        display_name: "Private Business",
        canonical_route: "/u/private-business",
        is_publicly_exposable: false,
        exclusion_reason: "visibility_not_public",
      },
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
  assert.equal(report.summary.publishedProfiles, 3);
  assert.equal(report.summary.catalogProfiles, 2);
  assert.equal(report.summary.excludedPublishedProfiles, 1);
  assert.deepEqual(report.coverage.excludedPublishedProfiles, [
    {
      slug: "private-business",
      displayName: "Private Business",
      reason: "visibility_not_public",
    },
  ]);
  assert.equal(report.profiles.some((profile) => profile.slug === "private-business"), false);
});

test("post-release windows measure source attribution and conversion", () => {
  const report = buildReport({
    catalogRows: [
      { business_slug: "example-business", display_name: "Example Business", canonical_route: "/u/example-business", is_publicly_exposable: true },
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
      { business_slug: "example-business", display_name: "Example Business", canonical_route: "/u/example-business", is_publicly_exposable: true },
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

test("explicit bounds determine the reported duration", () => {
  const report = buildReport({
    catalogRows: [],
    crawlRows: [],
    crawlFamilyRows: [],
    landingRows: [],
    sourceRows: [],
    profileViewRows: [],
    conversionRows: [],
    generatedAt: "2026-08-08T18:00:00.000Z",
    from: new Date("2026-08-08T18:00:00.000Z"),
    to: new Date("2026-08-09T00:00:00.000Z"),
    windowDays: 30,
    productionActivationAt: activationAt,
  });

  assert.equal(report.windowDays, 0.25);
  assert.match(buildMarkdown(report), /\(0\.25 day\(s\)\)/);
});

test("custom activation timestamps control both phase and displayed boundary", () => {
  const customActivationAt = new Date("2026-08-09T12:00:00.000Z");
  const report = buildReport({
    catalogRows: [],
    crawlRows: [],
    crawlFamilyRows: [],
    landingRows: [],
    sourceRows: [],
    profileViewRows: [],
    conversionRows: [],
    generatedAt: "2026-08-09T13:00:00.000Z",
    from: new Date("2026-08-09T12:00:00.000Z"),
    to: new Date("2026-08-09T13:00:00.000Z"),
    productionActivationAt: customActivationAt,
  });

  assert.equal(report.measurement.phase, "post_release");
  assert.equal(report.measurement.productionActivatedAt, customActivationAt.toISOString());
});

test("explicit invalid CLI dates and day counts fail closed", () => {
  assert.equal(parseDateArgument([], "--from="), null);
  assert.throws(() => parseDateArgument(["--from=not-a-date"], "--from="), /Invalid --from date/);
  assert.throws(() => parseDateArgument(["--to="], "--to="), /Invalid --to date/);
  assert.equal(parsePositiveDays([]), 30);
  assert.throws(() => parsePositiveDays(["--days=0.5"]), /Invalid --days value/);
  assert.throws(() => parsePositiveDays(["--days=garbage"]), /Invalid --days value/);
});

test("indeterminate public exposure fails closed", () => {
  const report = buildReport({
    catalogRows: [
      {
        business_slug: "unknown-exposure",
        display_name: "Unknown Exposure",
        canonical_route: "/u/unknown-exposure",
        is_publicly_exposable: null,
      },
    ],
    crawlRows: [{ business_slug: "unknown-exposure", crawl_hits: 5 }],
    crawlFamilyRows: [],
    landingRows: [],
    sourceRows: [],
    profileViewRows: [],
    conversionRows: [],
    generatedAt: "2026-08-09T13:00:00.000Z",
    from: new Date("2026-08-09T12:00:00.000Z"),
    to: new Date("2026-08-09T13:00:00.000Z"),
    productionActivationAt: activationAt,
  });

  assert.equal(report.summary.publishedProfiles, 1);
  assert.equal(report.summary.catalogProfiles, 0);
  assert.equal(report.summary.excludedPublishedProfiles, 1);
  assert.equal(report.summary.crawlHits, 0);
  assert.deepEqual(report.coverage.excludedPublishedProfiles, [
    {
      slug: "unknown-exposure",
      displayName: "Unknown Exposure",
      reason: "public_exposure_not_authorized",
    },
  ]);
});
