import { describe, expect, it } from "vitest";
import { applyProfileSiteContentAdapter } from "./profileSiteContentAdapters";
import {
  JW_STONE_AUDIENCE_BLOCK,
  JW_STONE_PROFILE_PRESENTATION_BLOCK,
  JW_STONE_PUBLIC_DISCOVERY_BLOCK,
} from "./jwStoneProfilePresentation";

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
    expect(blocks.filter((block) => block.type === "audience")).toEqual([
      JW_STONE_AUDIENCE_BLOCK,
    ]);
    expect(blocks.filter((block) => block.type === "inventoryCatalog")).toHaveLength(1);
  });

  it("hydrates the four JW Stone buying paths over stale stored audience copy", () => {
    const blocks = applyProfileSiteContentAdapter({
      profileSlug: "jw-stone",
      contentBlocks: [
        {
          type: "audience",
          data: { items: [{ title: "Fabricators" }, { title: "Builders & Developers" }] },
        },
      ],
    });
    const audience = blocks.find((block) => block.type === "audience");

    expect(audience).toEqual(JW_STONE_AUDIENCE_BLOCK);
    expect(JW_STONE_AUDIENCE_BLOCK.data.items.map((item) => item.title)).toEqual([
      "Builders & Fabricators",
      "Architects & Designers",
      "Homeowners",
      "Distributors",
    ]);
    expect(JW_STONE_AUDIENCE_BLOCK.data.items.map((item) => item.priority)).toEqual([
      "bundles",
      "trending_popular_rare",
      "color",
      "containers",
    ]);
    expect(
      JW_STONE_AUDIENCE_BLOCK.data.items.every((item) => Boolean(item.contactContext.trim()))
    ).toBe(true);
    expect(JW_STONE_AUDIENCE_BLOCK.data.sourcingPrompt).toMatchObject({
      title: "Don't see what you're looking for?",
      requestType: "request_material",
    });
  });

  it("preserves owner-authored presentation choices while hydrating JW footer defaults", () => {
    const ownerPresentation = {
      type: "profilePresentation",
      data: { inventory: { initialView: "featured" } },
    };
    const blocks = applyProfileSiteContentAdapter({
      profileSlug: "jw-stone",
      contentBlocks: [ownerPresentation],
    });

    expect(blocks.filter((block) => block.type === "profilePresentation")).toEqual([
      {
        ...ownerPresentation,
        data: {
          ...ownerPresentation.data,
          footer: JW_STONE_PROFILE_PRESENTATION_BLOCK.data.footer,
        },
      },
    ]);
  });
});
