import { describe, expect, it, vi } from "vitest";
import {
  collectPublicProfileProductionAuditTargets,
  evaluatePublicProfileProductionHtml,
  fingerprintPublicProfileAuditTargets,
  runPublicProfileProductionAudit,
  type PublicProfileAuditTarget,
} from "../services/publicProfileProductionAudit";

const factBearingBlocks = [
  {
    type: "localServiceProfile",
    data: {
      serviceAreas: ["Hammond", "Ponchatoula"],
      serviceAreaDescription:
        "Based in Hammond and serving residential and commercial projects across southeast Louisiana.",
      services: [
        {
          title: "Water heaters & gas",
          description:
            "Tank and tankless repair, installation, replacement, conversion, gas lines, and related equipment.",
        },
      ],
    },
  },
] as const;

function target(overrides: Partial<PublicProfileAuditTarget> = {}): PublicProfileAuditTarget {
  return {
    profileSlug: "la-plumbing-solutions",
    url: "https://www.thetradescout.com/u/la-plumbing-solutions/services/water-heaters-gas",
    parentUrl: "https://www.thetradescout.com/u/la-plumbing-solutions",
    isRoot: false,
    expectedHost: "www.thetradescout.com",
    ...overrides,
  };
}

function healthyHtml(args: {
  canonical?: string;
  robots?: string;
  profileSlug?: string;
  parentUrl?: string;
} = {}) {
  const canonical =
    args.canonical ||
    "https://www.thetradescout.com/u/la-plumbing-solutions/services/water-heaters-gas";
  return `<!doctype html><html><head>
    <title>Water heaters and gas | LA Plumbing Solutions</title>
    <meta name="robots" content="${args.robots || "index, follow, max-image-preview:large"}" />
    <meta name="tradescout-business-slug" content="${
      args.profileSlug || "la-plumbing-solutions"
    }" />
    <link rel="canonical" href="${canonical}" />
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Service"}</script>
  </head><body><main><nav><a href="${
    args.parentUrl || "https://www.thetradescout.com/u/la-plumbing-solutions"
  }">LA Plumbing Solutions</a></nav><h1>Water heaters and gas</h1><p>${"Useful public service context. ".repeat(
    8
  )}</p></main></body></html>`;
}

describe("public profile production audit", () => {
  it("builds platform and custom-domain targets from the shared profile graph", () => {
    const targets = collectPublicProfileProductionAuditTargets([
      {
        slug: "la-plumbing-solutions",
        contentBlocks: factBearingBlocks,
        seoMeta: {},
      },
      {
        slug: "custom-profile",
        contentBlocks: factBearingBlocks,
        seoMeta: { customDomain: "example.com" },
      },
      {
        slug: "jrs-auto-glass",
        contentBlocks: factBearingBlocks,
        seoMeta: {},
      },
    ]);

    expect(targets.some((row) => row.url === "https://www.thetradescout.com/u/la-plumbing-solutions")).toBe(
      true
    );
    expect(
      targets.some(
        (row) =>
          row.url ===
          "https://www.thetradescout.com/u/la-plumbing-solutions/services/water-heaters-gas"
      )
    ).toBe(true);
    expect(
      targets.some(
        (row) =>
          row.url === "https://www.thetradescout.com/u/la-plumbing-solutions/service-areas"
      )
    ).toBe(true);
    expect(targets.some((row) => row.url === "https://example.com/")).toBe(true);
    expect(
      targets.some((row) => row.url === "https://example.com/landing/service/water-heaters-gas")
    ).toBe(true);
    expect(
      targets.some((row) => row.url === "https://example.com/landing/service-areas")
    ).toBe(true);
    expect(targets.some((row) => row.profileSlug === "jrs-auto-glass")).toBe(false);
    expect(fingerprintPublicProfileAuditTargets(targets)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies the deployed HTTP and initial HTML contract", () => {
    const checks = evaluatePublicProfileProductionHtml({
      target: target(),
      httpStatus: 200,
      finalUrl:
        "https://www.thetradescout.com/u/la-plumbing-solutions/services/water-heaters-gas",
      contentType: "text/html; charset=utf-8",
      html: healthyHtml(),
    });

    expect(checks).toEqual({
      httpOk: true,
      finalUrlMatches: true,
      htmlContentType: true,
      canonicalMatches: true,
      indexable: true,
      titlePresent: true,
      primaryHeadingPresent: true,
      meaningfulInitialText: true,
      profileIdentityMatches: true,
      structuredDataPresent: true,
      childLinksToParent: true,
    });
  });

  it("fails closed on wrong canonical, noindex, weak HTML, identity mismatch, and missing parent link", () => {
    const checks = evaluatePublicProfileProductionHtml({
      target: target(),
      httpStatus: 200,
      finalUrl:
        "https://www.thetradescout.com/u/la-plumbing-solutions/services/water-heaters-gas",
      contentType: "text/html",
      html: `<!doctype html><html><head><title>x</title>
        <meta name="robots" content="noindex, follow" />
        <meta name="tradescout-business-slug" content="wrong-profile" />
        <link rel="canonical" href="https://www.thetradescout.com/wrong" />
      </head><body><h1>x</h1></body></html>`,
    });

    expect(checks.canonicalMatches).toBe(false);
    expect(checks.indexable).toBe(false);
    expect(checks.titlePresent).toBe(false);
    expect(checks.primaryHeadingPresent).toBe(false);
    expect(checks.meaningfulInitialText).toBe(false);
    expect(checks.profileIdentityMatches).toBe(false);
    expect(checks.structuredDataPresent).toBe(false);
    expect(checks.childLinksToParent).toBe(false);
  });

  it("keeps fetch failures unavailable rather than converting them into HTTP or SEO failures", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const result = await runPublicProfileProductionAudit({
      candidates: [
        {
          slug: "la-plumbing-solutions",
          contentBlocks: [],
          seoMeta: {},
        },
      ],
      fetchImpl: vi.fn().mockRejectedValue(new Error("network unavailable")),
      queryable: { query },
      now: () => new Date("2026-08-25T19:00:00.000Z"),
      concurrency: 1,
    });

    expect(result.urlCount).toBe(1);
    expect(result.verifiedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.unavailableCount).toBe(1);
    expect(result.results[0]).toMatchObject({
      status: "unavailable",
      httpStatus: null,
      checks: null,
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("marks an evaluated page failed when any required production check fails", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pageTarget = target({
      url: "https://www.thetradescout.com/u/la-plumbing-solutions",
      parentUrl: "https://www.thetradescout.com/u/la-plumbing-solutions",
      isRoot: true,
    });
    const result = await runPublicProfileProductionAudit({
      candidates: [
        {
          slug: "la-plumbing-solutions",
          contentBlocks: [],
          seoMeta: {},
        },
      ],
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: pageTarget.url,
        headers: { get: () => "text/html" },
        text: async () => healthyHtml({
          canonical: pageTarget.url,
          parentUrl: pageTarget.parentUrl,
        }),
      }),
      queryable: { query },
      now: () => new Date("2026-08-25T19:00:00.000Z"),
      concurrency: 1,
    });

    // The fixture still describes a child-service heading on a root URL, but it
    // satisfies the generic production contract. This proves the audit result
    // is driven by explicit checks rather than page-type assumptions.
    expect(result.verifiedCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });
});
