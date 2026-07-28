import { describe, expect, it } from "vitest";
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
    expect(blocks.filter((block) => block.type === "profilePresentation")).toHaveLength(1);
    expect(blocks.filter((block) => block.type === "publicDiscovery")).toEqual([
      JW_STONE_PUBLIC_DISCOVERY_BLOCK,
    ]);
    expect(blocks.filter((block) => block.type === "inventoryCatalog")).toHaveLength(1);
  });

  it("preserves an owner-authored presentation block instead of appending the default", () => {
    const ownerPresentation = {
      type: "profilePresentation",
      data: { inventory: { initialView: "featured" } },
    };
    const blocks = applyProfileSiteContentAdapter({
      profileSlug: "jw-stone",
      contentBlocks: [ownerPresentation],
    });

    expect(blocks.filter((block) => block.type === "profilePresentation")).toEqual([
      ownerPresentation,
    ]);
  });
});
