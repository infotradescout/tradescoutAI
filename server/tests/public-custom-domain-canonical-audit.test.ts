import { describe, expect, it } from "vitest";
import {
  collectPublicCustomDomainCanonicalAuditTargets,
  evaluatePublicCustomDomainCanonicalRedirect,
  fingerprintPublicCustomDomainCanonicalTargets,
  runPublicCustomDomainCanonicalAudit,
  type PublicCustomDomainCanonicalAuditTarget,
} from "../services/publicCustomDomainCanonicalAudit";

const serviceProfileBlocks = [
  {
    type: "localServiceProfile",
    data: {
      serviceAreas: ["Hammond"],
      serviceAreaDescription:
        "Published service coverage for residential and commercial projects in the local area.",
      services: [
        {
          title: "Water heater installation",
          description:
            "Install and replace tank or tankless water heaters after reviewing the property and project requirements.",
        },
      ],
    },
  },
] as const;

const jwBlocks = [
  {
    type: "inventoryCatalog",
    data: {
      categories: [
        {
          category: "Quartzite",
          categorySlug: "quartzite",
          stones: [
            {
              name: "Taj Mahal",
              slug: "taj-mahal",
              images: ["/images/jw/taj-mahal.jpg"],
            },
          ],
        },
      ],
    },
  },
  {
    type: "publicDiscovery",
    data: {
      routes: {
        inventory: "stones",
        categories: "materials",
      },
    },
  },
] as const;

function response(args: { status: number; url: string; location?: string | null }) {
  return {
    status: args.status,
    url: args.url,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "location" ? args.location || null : null,
    },
    text: async () => "",
  };
}

describe("public custom-domain canonical audit", () => {
  it("pairs platform service routes with custom-domain landing routes without guessing", () => {
    const targets = collectPublicCustomDomainCanonicalAuditTargets({
      rows: [
        {
          profile_slug: "custom-provider",
          business_slug: "custom-provider",
          custom_domain: "provider.example.com",
          content_blocks: serviceProfileBlocks,
        },
      ],
      eligibleProfileSlugs: ["custom-provider"],
    });

    expect(targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: "profile_root",
          sourceUrl: "https://www.thetradescout.com/u/custom-provider",
          expectedCanonicalUrl: "https://provider.example.com/",
        }),
        expect.objectContaining({
          sourceKind: "profile_child",
          sourceUrl:
            "https://www.thetradescout.com/u/custom-provider/services/water-heater-installation",
          expectedCanonicalUrl:
            "https://provider.example.com/landing/service/water-heater-installation",
        }),
        expect.objectContaining({
          sourceKind: "profile_child",
          sourceUrl: "https://www.thetradescout.com/u/custom-provider/service-areas",
          expectedCanonicalUrl: "https://provider.example.com/landing/service-areas",
        }),
      ])
    );
    expect(targets.some((target) => target.sourceUrl.includes("/u/custom-provider/landing/"))).toBe(
      false
    );
  });

  it("includes JW root, profile, marketplace, and vanity aliases for governed stone pages", () => {
    const targets = collectPublicCustomDomainCanonicalAuditTargets({
      rows: [
        {
          profile_slug: "jw-stone",
          business_slug: "jw-stone",
          custom_domain: "jwstonelogistics.com",
          content_blocks: jwBlocks,
        },
      ],
      eligibleProfileSlugs: ["jw-stone"],
    });

    expect(targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: "profile_root",
          sourceUrl: "https://www.thetradescout.com/u/jw-stone",
          expectedCanonicalUrl: "https://jwstonelogistics.com/",
        }),
        expect.objectContaining({
          sourceKind: "legacy_profile_root",
          sourceUrl: "https://www.thetradescout.com/p/jw-stone",
          expectedCanonicalUrl: "https://jwstonelogistics.com/",
        }),
        expect.objectContaining({
          sourceKind: "business_root",
          sourceUrl: "https://www.thetradescout.com/business/jw-stone",
          expectedCanonicalUrl: "https://jwstonelogistics.com/",
        }),
        expect.objectContaining({
          sourceKind: "vanity_root",
          sourceUrl: "https://www.thetradescout.com/jw-stone",
          expectedCanonicalUrl: "https://jwstonelogistics.com/",
        }),
        expect.objectContaining({
          sourceKind: "profile_child",
          sourceUrl: "https://www.thetradescout.com/u/jw-stone/stones/taj-mahal",
          expectedCanonicalUrl: "https://jwstonelogistics.com/stones/taj-mahal",
        }),
        expect.objectContaining({
          sourceKind: "marketplace_child",
          sourceUrl: "https://www.thetradescout.com/stones/taj-mahal",
          expectedCanonicalUrl: "https://jwstonelogistics.com/stones/taj-mahal",
        }),
        expect.objectContaining({
          sourceKind: "vanity_child",
          sourceUrl: "https://www.thetradescout.com/jw-stone/stones/taj-mahal",
          expectedCanonicalUrl: "https://jwstonelogistics.com/stones/taj-mahal",
        }),
      ])
    );
    expect(fingerprintPublicCustomDomainCanonicalTargets(targets)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires one direct permanent redirect to the exact HTTPS canonical", () => {
    const target: PublicCustomDomainCanonicalAuditTarget = {
      profileSlug: "jw-stone",
      businessSlug: "jw-stone",
      sourceKind: "profile_root",
      sourceUrl: "https://www.thetradescout.com/u/jw-stone",
      expectedCanonicalUrl: "https://jwstonelogistics.com/",
    };
    const valid = evaluatePublicCustomDomainCanonicalRedirect({
      target,
      response: response({
        status: 301,
        url: target.sourceUrl,
        location: "https://jwstonelogistics.com/",
      }),
    });

    expect(valid.failedChecks).toEqual([]);
    expect(valid.checks).toEqual({
      permanentRedirect: true,
      redirectIsDirect: true,
      locationMatchesCanonical: true,
      locationUsesHttps: true,
      locationHostMatchesCanonical: true,
      sourceAndCanonicalDiffer: true,
    });

    const chain = evaluatePublicCustomDomainCanonicalRedirect({
      target,
      response: response({
        status: 301,
        url: target.sourceUrl,
        location: "https://www.thetradescout.com/jw-stone",
      }),
    });
    expect(chain.checks.permanentRedirect).toBe(true);
    expect(chain.checks.locationMatchesCanonical).toBe(false);
    expect(chain.checks.locationHostMatchesCanonical).toBe(false);
  });

  it("reports a successful duplicate page as failed canonical evidence", () => {
    const target: PublicCustomDomainCanonicalAuditTarget = {
      profileSlug: "jw-stone",
      businessSlug: "jw-stone",
      sourceKind: "vanity_root",
      sourceUrl: "https://www.thetradescout.com/jw-stone",
      expectedCanonicalUrl: "https://jwstonelogistics.com/",
    };
    const evaluated = evaluatePublicCustomDomainCanonicalRedirect({
      target,
      response: response({ status: 200, url: target.sourceUrl }),
    });

    expect(evaluated.checks.permanentRedirect).toBe(false);
    expect(evaluated.checks.redirectIsDirect).toBe(false);
    expect(evaluated.checks.locationMatchesCanonical).toBe(false);
  });

  it("keeps network failures unavailable instead of converting them into redirect failures", async () => {
    const target: PublicCustomDomainCanonicalAuditTarget = {
      profileSlug: "jw-stone",
      businessSlug: "jw-stone",
      sourceKind: "profile_root",
      sourceUrl: "https://www.thetradescout.com/u/jw-stone",
      expectedCanonicalUrl: "https://jwstonelogistics.com/",
    };
    const result = await runPublicCustomDomainCanonicalAudit({
      targets: [target],
      fetchImpl: async () => {
        throw new Error("network unavailable");
      },
      persist: false,
      now: () => new Date("2026-08-25T21:45:00.000Z"),
    });

    expect(result.status).toBe("completed");
    expect(result.verifiedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.unavailableCount).toBe(1);
    expect(result.results[0].status).toBe("unavailable");
  });
});
