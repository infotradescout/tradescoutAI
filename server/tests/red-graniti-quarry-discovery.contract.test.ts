import { describe, expect, it } from "vitest";
import {
  RED_GRANITI_PROFILE_CONTENT_BLOCKS,
  RED_GRANITI_PROFILE_SLUG,
} from "@shared/redGranitiProfile";
import { listProfileGalleryItems } from "@shared/profileGalleryShare";
import { buildOptInProfileSitemapUrls } from "../profileSitemapDiscovery";

describe("R.E.D. Graniti quarry discovery", () => {
  it("publishes only the three official-source quarry pages", () => {
    const galleryItems = listProfileGalleryItems(RED_GRANITI_PROFILE_CONTENT_BLOCKS);
    const urls = buildOptInProfileSitemapUrls({
      profileSlug: RED_GRANITI_PROFILE_SLUG,
      profileUrl: `https://www.thetradescout.com/u/${RED_GRANITI_PROFILE_SLUG}`,
      contentBlocks: RED_GRANITI_PROFILE_CONTENT_BLOCKS,
    });

    expect(galleryItems).toHaveLength(3);
    expect(urls).toHaveLength(3);
    expect(urls.every((url) => url.includes("/quarries/"))).toBe(true);
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringContaining("labradorite-source-region"),
        expect.stringContaining("black-granite-source-region"),
        expect.stringContaining("danby-marble-source-region"),
      ])
    );
  });
});
