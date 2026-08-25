import { describe, expect, it } from "vitest";
import {
  ISSA_BUILD_PROFILE_CONTENT_BLOCKS,
  ISSA_BUILD_PROFILE_SLUG,
} from "@shared/issaBuildProfile";
import { readProfilePublicSitemapConfig } from "@shared/profilePublicItemRoute";
import { buildOptInProfileSitemapUrls } from "../profileSitemapDiscovery";

describe("ISSA Build public discovery", () => {
  it("publishes the canonical Onyx collection and both materials", () => {
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
