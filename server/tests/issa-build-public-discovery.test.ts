import { describe, expect, it } from "vitest";
import {
  ISSA_BUILD_PROFILE_CONTENT_BLOCKS,
  ISSA_BUILD_PROFILE_SLUG,
} from "@shared/issaBuildProfile";
import { readProfilePublicSitemapConfig } from "@shared/profilePublicItemRoute";
import { buildOptInProfileSitemapUrls } from "../profileSitemapDiscovery";

describe("ISSA Build public discovery", () => {
  it("opts the canonical Onyx collection and both materials into the profile sitemap", () => {
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

  it("does not enumerate child routes without an explicit profile-owned opt-in", () => {
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
    ).toEqual([]);
  });
});
