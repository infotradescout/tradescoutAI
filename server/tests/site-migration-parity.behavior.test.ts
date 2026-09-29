import { describe, expect, it } from "vitest";
import {
  buildMigrationManifest,
  MIGRATION_MAX_CHUNKS,
  MIGRATION_MAX_PAGES_PER_CHUNK,
  MigrationManifestInputError,
  normalizeMigrationUrl,
  type MigrationDocumentObservation,
  type MigrationManifestInput,
  type MigrationPageObservation,
  type MigrationPlanRef,
} from "../services/siteMigrationManifest";
import {
  assessSiteMigrationParity,
  MigrationParityInputError,
  type MigrationParityInput,
  type MigrationShadowInput,
  type ReviewedMigrationPlanSnapshot,
} from "../services/siteMigrationParity";

const sourceUrl = "https://business.example.com/services/stone?source=old&source=repeat";
const anotherUrl = "https://business.example.com/about";
const observedAt = "2026-09-29T18:00:00.000Z";
const plan: ReviewedMigrationPlanSnapshot = {
  id: "plan-123",
  businessId: "business-123",
  profileId: "profile-123",
  revision: 7,
  evidenceDigest: "a".repeat(64),
  planHash: "b".repeat(64),
  status: "site_path_selected",
  selectedSitePath: "preserve_migrate",
};
const planRef: MigrationPlanRef = {
  planId: plan.id,
  revision: plan.revision,
  evidenceDigest: plan.evidenceDigest,
  planHash: plan.planHash,
};

function document(
  overrides: Partial<MigrationDocumentObservation> = {}
): MigrationDocumentObservation {
  return {
    title: "Stone services",
    description: "Established stone service page",
    h1: ["Stone services"],
    canonical: "https://business.example.com/services/stone",
    metaRobots: ["index, follow"],
    xRobotsTag: [],
    robotsTxt: "allowed",
    inSitemap: true,
    schema: [
      {
        type: "Service",
        id: "https://business.example.com/services/stone#service",
        semanticSha256: "c".repeat(64),
      },
    ],
    ...overrides,
  };
}

function page(url = sourceUrl, overrides: Record<string, unknown> = {}): MigrationPageObservation {
  return {
    state: "observed",
    requestedUrl: url,
    observedAt,
    responseSha256: "d".repeat(64),
    finalUrl: url,
    status: 200,
    redirects: [],
    document: document({ canonical: url.split("?")[0] }),
    ...overrides,
  } as MigrationPageObservation;
}

function manifest(
  side: MigrationManifestInput["side"],
  pages: MigrationPageObservation[] = [page()],
  overrides: Partial<MigrationManifestInput> = {}
): MigrationManifestInput {
  return {
    planRef,
    side,
    origins: ["https://business.example.com"],
    expectedUrlUniverseSource: "sitemap_and_discovery",
    declaredUrlCount: pages.length,
    chunks: [{ sequence: 0, final: true, truncated: false, pages }],
    ...overrides,
  };
}

function shadow(
  urls: string[] = [sourceUrl],
  overrides: Partial<MigrationShadowInput> = {}
): MigrationShadowInput {
  return {
    planRef,
    previewOrigin: "https://preview.thetradescout.com",
    declaredPageCount: urls.length,
    truncated: false,
    pages: urls.map((source, index) => ({
      sourceUrl: source,
      previewUrl: `https://preview.thetradescout.com/page-${index}`,
      observedAt,
      access: "private" as const,
      metaRobots: ["noindex, nofollow"],
      xRobotsTag: [],
      inSitemap: false,
    })),
    ...overrides,
  };
}

function assessmentInput(overrides: Partial<MigrationParityInput> = {}): MigrationParityInput {
  return {
    plan,
    legacy: manifest("legacy_live"),
    predictedLive: manifest("predicted_live"),
    shadow: shadow(),
    ...overrides,
  };
}

describe("pure migration URL and metadata parity assessment", () => {
  it("reports an inert, plan-bound assessment even when supplied SEO observations match", () => {
    const result = assessSiteMigrationParity(assessmentInput());
    expect(result.planBinding).toEqual({
      planId: plan.id,
      businessId: plan.businessId,
      profileId: plan.profileId,
      revision: plan.revision,
      evidenceDigest: plan.evidenceDigest,
      planHash: plan.planHash,
      selectedSitePath: "preserve_migrate",
    });
    expect(result.coverage.legacy.complete).toBe(true);
    expect(result.parity).toMatchObject({
      status: "blocked",
      blockingCount: 0,
      findingsTruncated: false,
    });
    expect(result.parity.reasons).toContain("BODY_CONTENT_FIDELITY_UNASSESSED");
    expect(result.shadowSafety).toMatchObject({ status: "supplied_evidence_safe", reasons: [] });
    expect(result).toMatchObject({
      assessmentOnly: true,
      externalWriteAuthorized: false,
      cutoverEligible: false,
    });
    expect(result.manifestSha256.shadow).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result).toLowerCase()).not.toContain("membership");
    expect(JSON.stringify(result).toLowerCase()).not.toContain("paid");
  });

  it("blocks material URL, metadata, schema, and indexability drift", () => {
    const changed = page(sourceUrl, {
      status: 404,
      finalUrl: "https://business.example.com/removed",
      redirects: [
        { url: sourceUrl, status: 301, location: "https://business.example.com/removed" },
      ],
      document: document({
        title: "Replacement",
        description: "Different description",
        h1: ["Replacement"],
        canonical: "https://business.example.com/removed",
        metaRobots: ["noindex"],
        xRobotsTag: ["noindex"],
        robotsTxt: "disallowed",
        inSitemap: false,
        schema: [],
      }),
    });
    const result = assessSiteMigrationParity(
      assessmentInput({ predictedLive: manifest("predicted_live", [changed]) })
    );
    const codes = result.parity.findings.map((item) => item.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "STATUS_CHANGED",
        "FINAL_URL_CHANGED",
        "REDIRECT_CHAIN_CHANGED",
        "TITLE_CHANGED",
        "DESCRIPTION_CHANGED",
        "H1_CHANGED",
        "CANONICAL_CHANGED",
        "META_ROBOTS_CHANGED",
        "X_ROBOTS_CHANGED",
        "ROBOTS_TXT_CHANGED",
        "SITEMAP_MEMBERSHIP_CHANGED",
        "JSON_LD_CHANGED",
      ])
    );
    expect(result.parity.blockingCount).toBeGreaterThanOrEqual(12);
    expect(result.shadowSafety.status).toBe("supplied_evidence_safe");
  });

  it("blocks a historic path absent from the predicted live site", () => {
    const legacy = manifest("legacy_live", [page(sourceUrl), page(anotherUrl)]);
    const result = assessSiteMigrationParity(
      assessmentInput({ legacy, shadow: shadow([sourceUrl, anotherUrl]) })
    );
    expect(result.parity.findings).toContainEqual({
      code: "LEGACY_URL_MISSING",
      severity: "blocking",
      urlKeySha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("keeps shadow exposure safety separate from projected live indexability", () => {
    const leaked = shadow([sourceUrl], {
      pages: [
        {
          sourceUrl,
          previewUrl: "https://preview.thetradescout.com/page-0",
          observedAt,
          access: "public",
          metaRobots: ["index"],
          xRobotsTag: [],
          inSitemap: true,
        },
      ],
    });
    const result = assessSiteMigrationParity(assessmentInput({ shadow: leaked }));
    expect(result.parity.blockingCount).toBe(0);
    expect(result.shadowSafety.status).toBe("blocked");
    expect(result.shadowSafety.reasons).toEqual(
      expect.arrayContaining([
        "SHADOW_NOT_PRIVATE",
        "SHADOW_NOINDEX_UNPROVED",
        "SHADOW_SITEMAP_EXPOSURE_UNKNOWN",
      ])
    );
    expect(result.cutoverEligible).toBe(false);
  });

  it("does not treat an agent-scoped X-Robots-Tag as universal shadow noindex", () => {
    for (const scopedHeader of ["googlebot: noindex", "googlebot: nofollow, noindex"]) {
      const scoped = shadow([sourceUrl]);
      scoped.pages = [{ ...scoped.pages[0], metaRobots: [], xRobotsTag: [scopedHeader] }];
      const result = assessSiteMigrationParity(assessmentInput({ shadow: scoped }));
      expect(result.shadowSafety.status).toBe("blocked");
      expect(result.shadowSafety.reasons).toContain("SHADOW_NOINDEX_UNPROVED");
    }
  });

  it("blocks a shadow origin that matches an origin proposed for the live site", () => {
    const projectedUrl = "https://preview.thetradescout.com/services/stone";
    const projected = manifest("predicted_live", [page(projectedUrl)], {
      origins: ["https://preview.thetradescout.com"],
    });
    const result = assessSiteMigrationParity(assessmentInput({ predictedLive: projected }));
    expect(result.shadowSafety.status).toBe("blocked");
    expect(result.shadowSafety.reasons).toContain("SHADOW_ORIGIN_EQUALS_LIVE");
  });

  it("binds the assessment hash to exact supplied shadow observations", () => {
    const before = assessSiteMigrationParity(assessmentInput());
    const changed = shadow([sourceUrl]);
    changed.pages = [
      { ...changed.pages[0], previewUrl: "https://preview.thetradescout.com/alternate" },
    ];
    const after = assessSiteMigrationParity(assessmentInput({ shadow: changed }));
    expect(before.shadowSafety.status).toBe(after.shadowSafety.status);
    expect(before.manifestSha256.shadow).not.toBe(after.manifestSha256.shadow);
    expect(before.assessmentSha256).not.toBe(after.assessmentSha256);
  });

  it("refuses unreviewed, stale, and non-migration site paths", () => {
    for (const selectedSitePath of ["hosted_new", "keep_external", null]) {
      expect(() =>
        assessSiteMigrationParity(assessmentInput({ plan: { ...plan, selectedSitePath } }))
      ).toThrowError(MigrationParityInputError);
    }
    expect(() =>
      assessSiteMigrationParity(assessmentInput({ plan: { ...plan, status: "stale" } }))
    ).toThrowError(MigrationParityInputError);
    expect(() =>
      assessSiteMigrationParity(
        assessmentInput({
          legacy: manifest("legacy_live", [page()], { planRef: { ...planRef, revision: 6 } }),
        })
      )
    ).toThrowError(MigrationParityInputError);
    for (const invalid of [123, {}, " "]) {
      expect(() =>
        assessSiteMigrationParity(
          assessmentInput({ plan: { ...plan, businessId: invalid as string } })
        )
      ).toThrowError(MigrationParityInputError);
      expect(() =>
        assessSiteMigrationParity(
          assessmentInput({ plan: { ...plan, profileId: invalid as string } })
        )
      ).toThrowError(MigrationParityInputError);
    }
  });

  it("marks unknown observations and incomplete or truncated URL universes as blockers", () => {
    const unavailable: MigrationPageObservation = {
      state: "unavailable",
      requestedUrl: sourceUrl,
      observedAt,
      reason: "timed out",
    };
    const legacy = manifest("legacy_live", [unavailable], {
      expectedUrlUniverseSource: "unknown",
      declaredUrlCount: null,
      chunks: [{ sequence: 1, final: false, truncated: true, pages: [unavailable] }],
    });
    const result = assessSiteMigrationParity(assessmentInput({ legacy }));
    expect(result.coverage.legacy).toMatchObject({
      complete: false,
      truncated: true,
      unknownCount: 1,
      missingFinalChunk: true,
    });
    expect(result.parity.reasons).toEqual(
      expect.arrayContaining([
        "LEGACY_COVERAGE_INCOMPLETE",
        "OBSERVATIONS_UNAVAILABLE",
        "PAGE_EVIDENCE_UNAVAILABLE",
      ])
    );
    const onlyUnavailable = buildMigrationManifest(manifest("legacy_live", [unavailable]));
    expect(onlyUnavailable.coverage).toMatchObject({ complete: false, unknownCount: 1 });
  });

  it("normalizes without erasing significant historic URL differences", () => {
    expect(normalizeMigrationUrl("https://BUSINESS.example.com/AbC/?a=1&a=2#section")).toBe(
      "https://business.example.com/AbC/?a=1&a=2"
    );
    expect(normalizeMigrationUrl("https://business.example.com/AbC")).not.toBe(
      normalizeMigrationUrl("https://business.example.com/AbC/")
    );
    expect(normalizeMigrationUrl("https://business.example.com/?a=1&b=2")).not.toBe(
      normalizeMigrationUrl("https://business.example.com/?b=2&a=1")
    );
    for (const unsafe of [
      "http://127.0.0.1/private",
      "http://localhost/private",
      "https://user:pass@business.example.com/",
      "https://business.example.com:8443/",
      "file:///secret",
      "https://business.example.com/%2e%2e/admin",
      "https://business.example.com/a%2fb",
      "https://business.example.com\\evil.com/",
    ]) {
      expect(() => normalizeMigrationUrl(unsafe)).toThrowError(MigrationManifestInputError);
    }
  });

  it("hashes sorted observations deterministically and reports duplicate URLs", () => {
    const first = buildMigrationManifest(
      manifest("legacy_live", [page(sourceUrl), page(anotherUrl)])
    );
    const reversed = buildMigrationManifest(
      manifest("legacy_live", [page(anotherUrl), page(sourceUrl)])
    );
    expect(first.sha256).toBe(reversed.sha256);
    const duplicated = buildMigrationManifest(
      manifest("legacy_live", [page(sourceUrl), page(sourceUrl)])
    );
    expect(duplicated.coverage).toMatchObject({ complete: false, duplicateCount: 1 });
    const report = assessSiteMigrationParity(assessmentInput());
    expect(JSON.stringify(report)).not.toContain("source=old");
    expect(report.assessmentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("refuses redirect loops and disconnected chains before they can appear as parity", () => {
    const cyclic = page(sourceUrl, {
      redirects: [{ url: sourceUrl, status: 301, location: sourceUrl }],
    });
    expect(() => buildMigrationManifest(manifest("legacy_live", [cyclic]))).toThrowError(
      MigrationManifestInputError
    );
    const disconnected = page(sourceUrl, {
      redirects: [{ url: anotherUrl, status: 301, location: sourceUrl }],
    });
    expect(() => buildMigrationManifest(manifest("legacy_live", [disconnected]))).toThrowError(
      MigrationManifestInputError
    );
  });

  it("rejects over-limit chunks and assessments instead of silently trimming them", () => {
    expect(() =>
      buildMigrationManifest(
        manifest("legacy_live", [], {
          chunks: [
            {
              sequence: 0,
              final: true,
              truncated: false,
              pages: Array.from({ length: MIGRATION_MAX_PAGES_PER_CHUNK + 1 }, () => page()),
            },
          ],
        })
      )
    ).toThrowError(MigrationManifestInputError);
    expect(() =>
      buildMigrationManifest(
        manifest("legacy_live", [], {
          chunks: Array.from({ length: MIGRATION_MAX_CHUNKS + 1 }, (_, sequence) => ({
            sequence,
            final: sequence === MIGRATION_MAX_CHUNKS,
            truncated: false,
            pages: [],
          })),
        })
      )
    ).toThrowError(MigrationManifestInputError);
  });

  it("rejects accessor-bearing input without invoking the accessor", () => {
    let invoked = false;
    const unsafe = { ...page() } as Record<string, unknown>;
    Object.defineProperty(unsafe, "surprise", {
      enumerable: true,
      get() {
        invoked = true;
        return "side effect";
      },
    });
    expect(() =>
      buildMigrationManifest(manifest("legacy_live", [unsafe as MigrationPageObservation]))
    ).toThrowError(MigrationManifestInputError);
    expect(invoked).toBe(false);
  });

  it("refuses unexpected cyclic or oversized chunk fields before serializing them", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const source = manifest("legacy_live");
    const chunk = {
      ...source.chunks[0],
      unexpected: { cyclic, huge: "x".repeat(3 * 1024 * 1024) },
    };
    expect(() => buildMigrationManifest({ ...source, chunks: [chunk] })).toThrowError(
      MigrationManifestInputError
    );
  });
});
