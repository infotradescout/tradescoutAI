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
  assert.equal(report.measurement.acquisitionFunnel.phase, "pending_production_activation");
  assert.equal(report.acquisitionFunnel.status, "not_applicable");
  assert.equal(report.summary.verifiedAttributions, null);
  assert.equal(report.summary.convertedRequests, null);
  assert.deepEqual(report.coverage.uncrawledProfiles, [
    {
      slug: "uncrawled-business",
      displayName: "Uncrawled Business",
      identityRoute: "/u/uncrawled-business",
    },
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
  assert.equal(report.acquisitionFunnel.status, "not_applicable");
});

test("activated acquisition funnel reports source stages, directory businesses, and authority coverage", () => {
  const funnelActivatedAt = new Date("2026-08-23T12:00:00.000Z");
  const report = buildReport({
    catalogRows: [
      {
        business_slug: "example-business",
        entity_type: "published_profile",
        display_name: "Example Business",
        canonical_route: "/u/example-business",
        identity_route: "/u/example-business",
        is_publicly_exposable: true,
      },
      {
        business_slug: "directory-only-business",
        entity_type: "governed_directory_business",
        display_name: "Directory Only Business",
        canonical_route: "/business/directory-only-business",
        identity_route: "/business/directory-only-business",
        is_publicly_exposable: true,
      },
    ],
    crawlRows: [],
    crawlFamilyRows: [],
    landingRows: [],
    sourceRows: [],
    profileViewRows: [],
    conversionRows: [],
    acquisitionFunnelRows: [
      {
        entity_slug: "example-business",
        entity_type: "business_profile",
        identity_route: "/u/example-business",
        source: "utm:chatgpt",
        profile_discoveries: 4,
        cta_entries: 2,
        registrations: 1,
        activations: 0,
      },
      {
        entity_slug: "directory-only-business",
        entity_type: "business_profile",
        identity_route: "/business/directory-only-business",
        source: "referrer:google",
        profile_discoveries: 1,
        cta_entries: 1,
        registrations: 1,
        activations: 1,
      },
    ],
    acquisitionCoverageRows: [
      {
        consumer_provider_account_creations: 3,
        excluded_system_provider_account_creations: 4,
        projected_registrations: 2,
        source_attributed_registration_projections: 1,
        registration_projections_without_source: 1,
        missing_registration_projections: 1,
        consumer_provider_activations: 1,
        projected_activations: 1,
        source_attributed_activation_projections: 1,
        activation_projections_without_source: 0,
        missing_activation_projections: 0,
      },
    ],
    generatedAt: "2026-08-24T12:00:00.000Z",
    from: new Date("2026-08-23T12:00:00.000Z"),
    to: new Date("2026-08-24T12:00:00.000Z"),
    productionActivationAt: activationAt,
    acquisitionFunnelActivatedAt: funnelActivatedAt,
  });

  assert.equal(report.acquisitionFunnel.status, "measured");
  assert.deepEqual(report.acquisitionFunnel.totals, {
    profileDiscoveries: 5,
    ctaEntries: 3,
    registrations: 2,
    activations: 1,
    discoveryToCtaRate: 60,
    ctaToRegistrationRate: 66.67,
    registrationToActivationRate: 50,
  });
  assert.equal(report.acquisitionFunnel.projectionCoverage.consumerProviderAccountCreations, 3);
  assert.equal(
    report.acquisitionFunnel.projectionCoverage.excludedSystemProviderAccountCreations,
    4
  );
  assert.equal(report.acquisitionFunnel.projectionCoverage.missingRegistrationProjections, 1);
  assert.equal(
    report.acquisitionFunnel.projectionCoverage.sourceAttributedRegistrationProjections,
    1
  );
  assert.equal(
    report.acquisitionFunnel.projectionCoverage.registrationProjectionsWithoutSource,
    1
  );
  assert.equal(
    report.acquisitionFunnel.sources.find(
      (row) => row.slug === "directory-only-business"
    )?.catalogClassification,
    "governed_directory_business"
  );
  assert.match(buildMarkdown(report), /directory-only-business/);
  assert.match(buildMarkdown(report), /Excluded system\/provisioned-provider account creations.*4/);
  assert.match(buildMarkdown(report), /not labeled organic or self-serve signups/);
});

test("activated acquisition funnel is zero-safe without inventing rates", () => {
  const funnelActivatedAt = new Date("2026-08-23T12:00:00.000Z");
  const report = buildReport({
    catalogRows: [],
    crawlRows: [],
    crawlFamilyRows: [],
    landingRows: [],
    sourceRows: [],
    profileViewRows: [],
    conversionRows: [],
    acquisitionFunnelRows: [],
    acquisitionCoverageRows: [{}],
    generatedAt: "2026-08-24T12:00:00.000Z",
    from: funnelActivatedAt,
    to: new Date("2026-08-24T12:00:00.000Z"),
    productionActivationAt: activationAt,
    acquisitionFunnelActivatedAt: funnelActivatedAt,
  });

  assert.equal(report.acquisitionFunnel.totals.discoveryToCtaRate, null);
  assert.equal(report.acquisitionFunnel.totals.ctaToRegistrationRate, null);
  assert.equal(report.acquisitionFunnel.totals.registrationToActivationRate, null);
  assert.match(buildMarkdown(report), /\| 0 \| 0 \| 0 \| 0 \| N\/A \| N\/A \| N\/A \|/);
});

test("same-slug profile and directory activity remain route-distinct", () => {
  const funnelActivatedAt = new Date("2026-08-23T12:00:00.000Z");
  const report = buildReport({
    catalogRows: [
      {
        business_slug: "same-slug",
        entity_type: "published_profile",
        display_name: "Published Profile",
        canonical_route: "/u/same-slug",
        identity_route: "/u/same-slug",
        is_publicly_exposable: true,
      },
      {
        business_slug: "same-slug",
        entity_type: "governed_directory_business",
        display_name: "Directory Business",
        canonical_route: "/business/same-slug",
        identity_route: "/business/same-slug",
        is_publicly_exposable: true,
      },
    ],
    crawlRows: [],
    crawlFamilyRows: [],
    landingRows: [],
    sourceRows: [],
    profileViewRows: [],
    conversionRows: [],
    acquisitionFunnelRows: [
      {
        entity_slug: "same-slug",
        entity_type: "business_profile",
        identity_route: "/u/same-slug",
        source: "chatgpt",
        profile_discoveries: 3,
        cta_entries: 1,
        registrations: 1,
        activations: 0,
      },
      {
        entity_slug: "same-slug",
        entity_type: "business_profile",
        identity_route: "/business/same-slug",
        source: "google",
        profile_discoveries: 7,
        cta_entries: 4,
        registrations: 2,
        activations: 1,
      },
    ],
    acquisitionCoverageRows: [{}],
    generatedAt: "2026-08-24T12:00:00.000Z",
    from: funnelActivatedAt,
    to: new Date("2026-08-24T12:00:00.000Z"),
    productionActivationAt: activationAt,
    acquisitionFunnelActivatedAt: funnelActivatedAt,
  });

  const published = report.profiles.find((row) => row.identityRoute === "/u/same-slug");
  const directory = report.profiles.find(
    (row) => row.identityRoute === "/business/same-slug"
  );
  assert.equal(published?.acquisitionFunnel.profileDiscoveries, 3);
  assert.equal(published?.acquisitionFunnel.registrations, 1);
  assert.equal(directory?.acquisitionFunnel.profileDiscoveries, 7);
  assert.equal(directory?.acquisitionFunnel.registrations, 2);
  assert.equal(report.acquisitionFunnel.sources.length, 2);
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
  assert.throws(
    () => parseDateArgument(["--from=2026-02-30T00:00:00.000Z"], "--from="),
    /Invalid --from date/
  );
  assert.throws(
    () => parseDateArgument(["--from=2025-02-29T00:00:00.000Z"], "--from="),
    /Invalid --from date/
  );
  assert.throws(
    () => parseDateArgument(["--from=2026-01-01T24:00:00.000Z"], "--from="),
    /Invalid --from date/
  );
  assert.throws(
    () => parseDateArgument(["--from=2026-01-01"], "--from="),
    /Invalid --from date/
  );
  assert.equal(
    parseDateArgument(["--from=2024-02-29T12:30:45.123456Z"], "--from=")?.toISOString(),
    "2024-02-29T12:30:45.123Z"
  );
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
