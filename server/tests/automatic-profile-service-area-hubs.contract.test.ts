import { describe, expect, it } from "vitest";
import {
  buildProfileServiceAreaPath,
  buildProfileServiceAreaUrl,
  resolveProfileServiceAreaHub,
  resolveProfileServiceAreaRoute,
} from "@shared/profileServiceAreaShare";
import { buildProfileSitemapUrls } from "../profileSitemapDiscovery";
import { buildPublicProfileServiceAreaHtml } from "../publicProfileServiceAreaHtml";
import { attachPublicProfileServiceJourneyScript } from "../publicSeoHtml";

const contentBlocks = [
  {
    type: "localServiceProfile",
    data: {
      serviceAreaDescription:
        "Based in Hammond and serving residential and commercial projects across southeast Louisiana.",
      serviceAreas: ["Hammond", "Ponchatoula", "Hammond", "Baton Rouge"],
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
] as const;

const templateHtml = `<!doctype html><html><head>
<title>TradeScout</title>
<meta name="description" content="TradeScout" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="https://www.thetradescout.com/" />
</head><body><div id="root"></div></body></html>`;

describe("automatic public profile service-area hubs", () => {
  it("creates one deduplicated fact-bearing hub from published profile content", () => {
    expect(resolveProfileServiceAreaHub(contentBlocks)).toEqual({
      areas: ["Hammond", "Ponchatoula", "Baton Rouge"],
      description:
        "Based in Hammond and serving residential and commercial projects across southeast Louisiana.",
    });
  });

  it("uses one platform route and one custom-domain route", () => {
    expect(buildProfileServiceAreaPath("/u/la-plumbing-solutions")).toBe(
      "/u/la-plumbing-solutions/service-areas"
    );
    expect(buildProfileServiceAreaPath("/")).toBe("/landing/service-areas");
    expect(
      buildProfileServiceAreaUrl(
        "https://www.thetradescout.com/u/la-plumbing-solutions"
      )
    ).toBe("https://www.thetradescout.com/u/la-plumbing-solutions/service-areas");
    expect(buildProfileServiceAreaUrl("https://example.com/")).toBe(
      "https://example.com/landing/service-areas"
    );
    expect(resolveProfileServiceAreaRoute("/u/la-plumbing-solutions/service-areas")).toEqual({
      source: "platform",
      requestedProfileSlug: "la-plumbing-solutions",
    });
    expect(resolveProfileServiceAreaRoute("/landing/service-areas")).toEqual({
      source: "custom_domain",
      requestedProfileSlug: null,
    });
  });

  it("enrolls exactly one service-area hub alongside the real service pages", () => {
    const urls = buildProfileSitemapUrls({
      profileSlug: "la-plumbing-solutions",
      profileUrl: "https://www.thetradescout.com/u/la-plumbing-solutions",
      contentBlocks,
    });

    expect(urls).toContain(
      "https://www.thetradescout.com/u/la-plumbing-solutions/service-areas"
    );
    expect(urls.filter((url) => url.endsWith("/service-areas"))).toHaveLength(1);
    expect(urls).toContain(
      "https://www.thetradescout.com/u/la-plumbing-solutions/services/repairs-leaks-replacements"
    );
    expect(urls).toContain(
      "https://www.thetradescout.com/u/la-plumbing-solutions/services/water-heaters-gas"
    );
  });

  it("honors an explicit service-area discovery opt-out", () => {
    const optedOut = [
      ...contentBlocks,
      {
        type: "publicDiscovery",
        data: { sitemap: { serviceAreas: false } },
      },
    ];

    expect(resolveProfileServiceAreaHub(optedOut)).toBeNull();
    expect(
      buildProfileSitemapUrls({
        profileSlug: "private-coverage-profile",
        profileUrl: "https://www.thetradescout.com/u/private-coverage-profile",
        contentBlocks: optedOut,
      }).some((url) => url.endsWith("/service-areas"))
    ).toBe(false);
  });

  it("renders a useful page with services, areas, structured data, and request context", () => {
    const html = buildPublicProfileServiceAreaHtml({
      templateHtml,
      origin: "https://www.thetradescout.com",
      profile: {
        slug: "la-plumbing-solutions",
        displayName: "LA Plumbing Solutions",
        contentBlocks,
        seoMeta: {},
      },
      business: {
        name: "LA Plumbing Solutions",
        city: "Hammond",
        stateCode: "LA",
        brandColors: { accent: "#1ba9dc" },
      },
    });

    expect(html).toContain('data-public-profile-service-area-page="true"');
    expect(html).toContain("LA Plumbing Solutions Service Areas");
    expect(html).toContain("Hammond");
    expect(html).toContain("Ponchatoula");
    expect(html).toContain("Repairs, leaks &amp; replacements");
    expect(html).toContain('"areaServed":["Hammond","Ponchatoula","Baton Rouge"]');
    expect(html).toContain("source=profile_service_area_page");
    expect(html).toContain(
      "https://www.thetradescout.com/u/la-plumbing-solutions/services/water-heaters-gas"
    );
  });

  it("uses the same parseable signed journey bridge as service pages", () => {
    const page = buildPublicProfileServiceAreaHtml({
      templateHtml,
      origin: "https://www.thetradescout.com",
      profile: {
        slug: "la-plumbing-solutions",
        displayName: "LA Plumbing Solutions",
        contentBlocks,
        seoMeta: {},
      },
      business: { name: "LA Plumbing Solutions" },
    });
    const enriched = attachPublicProfileServiceJourneyScript(page || "");
    const script = enriched.match(
      /<script data-ts-profile-service-journey="true">([\s\S]*?)<\/script>/i
    )?.[1];

    expect(script).toBeTruthy();
    expect(enriched).toContain('source !== "profile_service_area_page"');
    expect(enriched).toContain('"profile_service_area_page_cta"');
    expect(() => new Function(script || "")).not.toThrow();
  });

  it("does not manufacture a hub without both coverage and fact-bearing services", () => {
    expect(
      buildProfileSitemapUrls({
        profileSlug: "area-only-profile",
        profileUrl: "https://www.thetradescout.com/u/area-only-profile",
        contentBlocks: [
          {
            type: "localServiceProfile",
            data: { serviceAreas: ["Hammond"], services: [] },
          },
        ],
      })
    ).toEqual([]);
  });
});
