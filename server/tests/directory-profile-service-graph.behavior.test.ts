import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPublicDirectoryProfileDiscoveries,
  enrichPublicDirectoryProfileHtml,
  type PublicDirectoryProfileDiscovery,
} from "../publicDirectoryProfileServiceLinks";

const publicProfileRow = (overrides: Record<string, unknown> = {}) => ({
  business_slug: "la-plumbing-solutions",
  business_name: "LA Plumbing Solutions",
  business_id: "business-1",
  business_status: "active",
  business_owner_user_id: "owner-1",
  public_discovery_enabled: true,
  business_sources: [],
  business_claim_status: "claimed",
  profile_id: "profile-1",
  profile_publicly_released: true,
  profile_slug: "la-plumbing-solutions",
  profile_display_name: "LA Plumbing Solutions",
  profile_role_context: "specialty_tradesperson",
  profile_headline: "Residential and commercial plumbing",
  profile_content_blocks: [
    {
      type: "localServiceProfile",
      data: {
        serviceAreas: ["Hammond", "Ponchatoula"],
        serviceAreaDescription:
          "Based in Hammond and serving residential and commercial projects across southeast Louisiana.",
        services: [
          {
            title: "Repairs, leaks & replacements",
            description:
              "Leaks, damaged piping, fixtures, and full system replacements with the problem and options explained first.",
          },
          {
            title: "Water heaters & gas",
            description:
              "Tank and tankless repair, installation, replacement, conversion, gas lines, and related equipment.",
          },
        ],
      },
    },
  ],
  profile_owner_user_id: "owner-1",
  profile_seo_meta: {},
  owner_role: "specialty_tradesperson",
  owner_roles: ["specialty_tradesperson"],
  owner_verified_badge: true,
  owner_verification_status: "approved",
  owner_provider: "email",
  owner_preferences: { publicProfileIds: ["profile-1"] },
  professional_role_approved: true,
  ...overrides,
});

describe("directory-to-profile service graph", () => {
  it("builds canonical service and service-area links from the governed public graph", () => {
    const discoveries = buildPublicDirectoryProfileDiscoveries(
      [publicProfileRow()],
      "https://www.thetradescout.com"
    );

    expect(discoveries).toHaveLength(1);
    expect(discoveries[0]).toMatchObject({
      businessSlug: "la-plumbing-solutions",
      profileSlug: "la-plumbing-solutions",
      profileUrl: "https://www.thetradescout.com/u/la-plumbing-solutions",
      serviceAreaUrl:
        "https://www.thetradescout.com/u/la-plumbing-solutions/service-areas",
    });
    expect(discoveries[0].services.map((service) => service.url)).toEqual([
      "https://www.thetradescout.com/u/la-plumbing-solutions/services/repairs-leaks-replacements",
      "https://www.thetradescout.com/u/la-plumbing-solutions/services/water-heaters-gas",
    ]);
  });

  it("preserves verified custom-domain authority", () => {
    const discoveries = buildPublicDirectoryProfileDiscoveries(
      [
        publicProfileRow({
          business_slug: "custom-provider",
          business_name: "Custom Provider",
          profile_id: "custom-profile-id",
          profile_slug: "custom-provider",
          profile_display_name: "Custom Provider",
          profile_seo_meta: { customDomain: "provider.example.com" },
          owner_preferences: { publicProfileIds: ["custom-profile-id"] },
        }),
      ],
      "https://www.thetradescout.com"
    );

    expect(discoveries[0].profileUrl).toBe("https://provider.example.com/");
    expect(discoveries[0].services[0].url).toBe(
      "https://provider.example.com/landing/service/repairs-leaks-replacements"
    );
    expect(discoveries[0].serviceAreaUrl).toBe(
      "https://provider.example.com/landing/service-areas"
    );
  });

  it("excludes direct-only profiles and honors child-page opt-outs", () => {
    const directOnly = publicProfileRow({ public_discovery_enabled: false });
    const optedOut = publicProfileRow({
      business_slug: "opted-out-provider",
      profile_id: "profile-2",
      profile_slug: "opted-out-provider",
      owner_preferences: { publicProfileIds: ["profile-2"] },
      profile_content_blocks: [
        ...(publicProfileRow().profile_content_blocks as unknown[]),
        {
          type: "publicDiscovery",
          data: { sitemap: { services: false, serviceAreas: false } },
        },
      ],
    });

    const discoveries = buildPublicDirectoryProfileDiscoveries(
      [directOnly, optedOut],
      "https://www.thetradescout.com"
    );

    expect(discoveries).toHaveLength(1);
    expect(discoveries[0].businessSlug).toBe("opted-out-provider");
    expect(discoveries[0].services).toEqual([]);
    expect(discoveries[0].serviceAreaUrl).toBeNull();
  });

  it("replaces generic business aliases and adds exact services to directory listings", () => {
    const discovery: PublicDirectoryProfileDiscovery = {
      businessSlug: "la-plumbing-solutions",
      profileSlug: "la-plumbing-solutions",
      profileName: "LA Plumbing Solutions",
      profileUrl: "https://www.thetradescout.com/u/la-plumbing-solutions",
      services: [
        {
          title: "Repairs, leaks & replacements",
          description: "Source-backed plumbing repair service information.",
          url: "https://www.thetradescout.com/u/la-plumbing-solutions/services/repairs-leaks-replacements",
        },
      ],
      serviceAreaUrl:
        "https://www.thetradescout.com/u/la-plumbing-solutions/service-areas",
    };
    const source = `<!doctype html><html><head></head><body><main data-seo-trade="county"><article><ul><li><a href="/business/la-plumbing-solutions">LA Plumbing Solutions</a> <small>(Claimed)</small></li><li><a href="/business/direct-only-provider">Direct Only</a></li></ul></article></main></body></html>`;
    const enriched = enrichPublicDirectoryProfileHtml({
      html: source,
      origin: "https://www.thetradescout.com",
      discoveries: [discovery],
    });

    expect(enriched).toContain('data-seo-directory-profile-service-graph="true"');
    expect(enriched).toContain(
      'href="https://www.thetradescout.com/u/la-plumbing-solutions"'
    );
    expect(enriched).toContain('data-seo-directory-provider-services="la-plumbing-solutions"');
    expect(enriched).toContain(
      "https://www.thetradescout.com/u/la-plumbing-solutions/services/repairs-leaks-replacements"
    );
    expect(enriched).toContain(
      "https://www.thetradescout.com/u/la-plumbing-solutions/service-areas"
    );
    expect(enriched).toContain('data-ts-directory-profile-services="true"');
    expect(enriched).toContain('href="/business/direct-only-provider"');
    expect(
      enrichPublicDirectoryProfileHtml({
        html: enriched,
        origin: "https://www.thetradescout.com",
        discoveries: [discovery],
      })
    ).toBe(enriched);
  });

  it("is installed at the shared public landing boundary", () => {
    const middleware = fs.readFileSync(
      path.resolve(process.cwd(), "server/middleware/landingContractHeaders.ts"),
      "utf8"
    );

    expect(middleware).toContain("attachPublicDirectoryProfileServiceLinks");
    expect(middleware).toContain("await attachPublicDirectoryProfileServiceLinks(req, res)");
  });
});
