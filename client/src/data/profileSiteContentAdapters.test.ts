import { describe, expect, it } from "vitest";
import { JW_STONE_YOUTUBE_URL } from "@shared/jwStonePresentation";
import { applyProfileSiteContentAdapter } from "./profileSiteContentAdapters";
import { JW_STONE_PUBLIC_DISCOVERY_BLOCK } from "./jwStoneProfilePresentation";

describe("profile site content adapters", () => {
  it("passes unknown profiles through without adding profile-specific content", () => {
    const blocks = [{ type: "about", data: { text: "Existing profile content" } }];
    expect(
      applyProfileSiteContentAdapter({
        profileSlug: "sample-stone-supplier",
        contentBlocks: blocks,
      })
    ).toEqual(blocks);
  });

  it("hydrates JW Stone through the data registry without replacing existing blocks", () => {
    const about = { type: "about", data: { text: "Existing JW Stone content" } };
    const blocks = applyProfileSiteContentAdapter({
      profileSlug: "jw-stone",
      contentBlocks: [about],
    });

    expect(blocks).toContainEqual(about);
    const presentations = blocks.filter((block) => block.type === "profilePresentation");
    expect(presentations).toHaveLength(1);
    expect(presentations[0]?.data?.social).toMatchObject({
      youtubeUrl: JW_STONE_YOUTUBE_URL,
    });
    expect(blocks.filter((block) => block.type === "publicDiscovery")).toEqual([
      JW_STONE_PUBLIC_DISCOVERY_BLOCK,
    ]);
    expect(blocks.filter((block) => block.type === "inventoryCatalog")).toHaveLength(1);
  });

  it("preserves owner-authored presentation choices while adding canonical identity defaults", () => {
    const ownerPresentation = {
      type: "profilePresentation",
      data: {
        inventory: { initialView: "featured" },
        social: { accentColor: "#123456" },
      },
    };
    const blocks = applyProfileSiteContentAdapter({
      profileSlug: "jw-stone",
      contentBlocks: [ownerPresentation],
    });

    const presentations = blocks.filter((block) => block.type === "profilePresentation");
    expect(presentations).toHaveLength(1);
    expect(presentations[0]?.data).toMatchObject({
      inventory: { initialView: "featured" },
      social: {
        accentColor: "#123456",
        youtubeUrl: JW_STONE_YOUTUBE_URL,
      },
    });
  });
});
