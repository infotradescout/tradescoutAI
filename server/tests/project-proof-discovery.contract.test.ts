import { describe, expect, it } from "vitest";
import {
  LA_PLUMBING_PROFILE_CONTENT_BLOCKS,
  LA_PLUMBING_PROFILE_SLUG,
} from "@shared/localServiceProfile";
import { listProfileGalleryItems } from "@shared/profileGalleryShare";
import { buildOptInProfileSitemapUrls } from "../profileSitemapDiscovery";

describe("project proof discovery", () => {
  it("publishes LA Plumbing completed-work pages through the governed profile sitemap", () => {
    const galleryItems = listProfileGalleryItems(LA_PLUMBING_PROFILE_CONTENT_BLOCKS);
    const urls = buildOptInProfileSitemapUrls({
      profileSlug: LA_PLUMBING_PROFILE_SLUG,
      profileUrl: `https://www.thetradescout.com/u/${LA_PLUMBING_PROFILE_SLUG}`,
      contentBlocks: LA_PLUMBING_PROFILE_CONTENT_BLOCKS,
    });
    const projectUrls = urls.filter((url) => url.includes("/projects/"));

    expect(galleryItems.length).toBeGreaterThanOrEqual(8);
    expect(projectUrls).toHaveLength(galleryItems.length);
    expect(projectUrls).toEqual(
      expect.arrayContaining([
        expect.stringContaining("new-construction-plumbing-rough-in"),
        expect.stringContaining("tankless-water-heater-system"),
        expect.stringContaining("mechanical-room-piping"),
      ])
    );
  });
});
