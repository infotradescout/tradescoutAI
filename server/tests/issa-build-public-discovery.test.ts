import { describe, expect, it } from "vitest";
import {
  ISSA_BUILD_PROFILE_CONTENT_BLOCKS,
  ISSA_BUILD_PROFILE_SLUG,
  ISSA_BUILD_LOCAL_DISCOVERY,
} from "@shared/issaBuildProfile";
import { JSDOM } from "jsdom";
import { listFactBearingProfileServices } from "@shared/profileServiceShare";
import { resolveProfileServiceAreaHub } from "@shared/profileServiceAreaShare";
import { buildPublicProfileServiceHtml } from "../publicProfileServiceHtml";
import { buildPublicProfileServiceAreaHtml } from "../publicProfileServiceAreaHtml";
import { getTradeSeoMatch } from "@shared/tradeSeo";
import { readProfilePublicSitemapConfig } from "@shared/profilePublicItemRoute";
import { buildOptInProfileSitemapUrls } from "../profileSitemapDiscovery";

describe("ISSA Build public discovery", () => {
  it("uses the directory's recognized kitchen and bathroom categories", () => {
    expect(getTradeSeoMatch(ISSA_BUILD_LOCAL_DISCOVERY.primaryCategory)?.canonicalSlug).toBe(
      "kitchen-remodel"
    );
    expect(
      ISSA_BUILD_LOCAL_DISCOVERY.tradeServices.map((name) => getTradeSeoMatch(name)?.canonicalSlug)
    ).toEqual(["kitchen-remodel", "bathroom-remodel"]);
  });
  const templateHtml =
    '<html><head><title>TradeScout</title></head><body><div id="root"></div></body></html>';
  const profile = {
    slug: ISSA_BUILD_PROFILE_SLUG,
    displayName: "ISSA Build",
    headline: ISSA_BUILD_LOCAL_DISCOVERY.headline,
    contentBlocks: ISSA_BUILD_PROFILE_CONTENT_BLOCKS,
    seoMeta: ISSA_BUILD_LOCAL_DISCOVERY,
  };

  it.each(ISSA_BUILD_LOCAL_DISCOVERY.services)(
    "renders $slug as a real indexable service with an ISSA Build request destination",
    (expected) => {
      const service = listFactBearingProfileServices(ISSA_BUILD_PROFILE_CONTENT_BLOCKS).find(
        (entry) => entry.slug === expected.slug
      );
      expect(service).toBeTruthy();
      const document = new JSDOM(
        buildPublicProfileServiceHtml({
          templateHtml,
          origin: "https://www.thetradescout.com",
          profile,
          business: null,
          service: service!,
        })
      ).window.document;
      expect(document.querySelector("h1")?.textContent).toBe(expected.title);
      expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toMatch(
        /^index, follow/
      );
      expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
        `https://www.thetradescout.com/u/issa-build/services/${expected.slug}`
      );
      const requestLink = Array.from(document.querySelectorAll("a")).find(
        (link) => link.textContent === "Start a Request"
      );
      const request = new URL(requestLink!.href);
      expect(request.searchParams.get("profile")).toBe("issa-build");
      expect(request.searchParams.get("subject")).toBe("service");
      expect(request.searchParams.get("title")).toBe(expected.title);
      expect(document.body.textContent).toContain(expected.description);
    }
  );

  it("publishes the confirmed Pensacola area without assigning every surrounding job to Escambia", () => {
    const area = resolveProfileServiceAreaHub(ISSA_BUILD_PROFILE_CONTENT_BLOCKS);
    expect(area?.areas).toEqual(["Pensacola, FL"]);
    expect(area?.description).toContain("actual project city or ZIP");
    const html = buildPublicProfileServiceAreaHtml({
      templateHtml,
      origin: "https://www.thetradescout.com",
      profile,
      business: null,
    });
    expect(html).toContain("Pensacola and surrounding areas");
    expect(html).toContain("/u/issa-build/services/countertops-fabrication");
  });

  it("publishes local service pages and an area hub alongside both existing onyx materials", () => {
    expect(readProfilePublicSitemapConfig(ISSA_BUILD_PROFILE_CONTENT_BLOCKS)).toEqual({
      inventory: true,
      categories: true,
      gallery: false,
    });

    const urls = buildOptInProfileSitemapUrls({
      profileSlug: ISSA_BUILD_PROFILE_SLUG,
      profileUrl: "https://www.thetradescout.com/u/issa-build",
      contentBlocks: ISSA_BUILD_PROFILE_CONTENT_BLOCKS,
    });

    expect(urls).toEqual([
      "https://www.thetradescout.com/u/issa-build/categories/onyx",
      "https://www.thetradescout.com/u/issa-build/inventory/honey-onyx",
      "https://www.thetradescout.com/u/issa-build/inventory/multi-green-onyx",
      "https://www.thetradescout.com/u/issa-build/services/kitchen-projects",
      "https://www.thetradescout.com/u/issa-build/services/bathroom-projects",
      "https://www.thetradescout.com/u/issa-build/services/cabinets",
      "https://www.thetradescout.com/u/issa-build/services/countertops-fabrication",
      "https://www.thetradescout.com/u/issa-build/service-areas",
    ]);
    expect(urls.join("\n")).not.toContain("/u/honey-onyx");
    expect(urls.join("\n")).not.toMatch(/[?&](?:email|phone)=/i);
  });

  it("automatically enrolls valid child records for profiles created later", () => {
    expect(
      buildOptInProfileSitemapUrls({
        profileSlug: "sample-profile",
        profileUrl: "https://www.thetradescout.com/u/sample-profile",
        contentBlocks: [
          {
            type: "inventoryCatalog",
            data: {
              categories: [
                {
                  category: "Onyx",
                  categorySlug: "onyx",
                  stones: [
                    {
                      name: "Sample Onyx",
                      slug: "sample-onyx",
                      images: ["/images/sample-onyx.jpg"],
                    },
                  ],
                },
              ],
            },
          },
        ],
      })
    ).toEqual([
      "https://www.thetradescout.com/u/sample-profile/categories/onyx",
      "https://www.thetradescout.com/u/sample-profile/inventory/sample-onyx",
    ]);
  });

  it("honors an explicit child-discovery opt-out", () => {
    expect(
      buildOptInProfileSitemapUrls({
        profileSlug: "private-catalog-profile",
        profileUrl: "https://www.thetradescout.com/u/private-catalog-profile",
        contentBlocks: [
          {
            type: "inventoryCatalog",
            data: {
              categories: [
                {
                  category: "Onyx",
                  categorySlug: "onyx",
                  stones: [
                    {
                      name: "Private Onyx",
                      slug: "private-onyx",
                      images: ["/images/private-onyx.jpg"],
                    },
                  ],
                },
              ],
            },
          },
          {
            type: "publicDiscovery",
            data: {
              sitemap: {
                inventory: false,
                categories: false,
                gallery: false,
              },
            },
          },
        ],
      })
    ).toEqual([]);
  });
});
