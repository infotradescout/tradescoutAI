import { describe, expect, it } from "vitest";
import {
  applyInventoryLeadImageOverrides,
  getProfileSiteTemplateMeta,
  listSelectableProfileSiteTemplates,
  readFeaturedStoneSlugs,
  resolveSiteTemplateId,
  seedBlocksForTemplate,
  upsertFeaturedStoneSlugs,
  upsertSiteTemplateBlock,
} from "@shared/profileSiteTemplates";
import { suggestTemplateFromBusinessType } from "@shared/profileSelectiveInheritance";

describe("profile site templates", () => {
  it("exposes the v1 selectable gallery only", () => {
    expect(listSelectableProfileSiteTemplates().map((entry) => entry.id)).toEqual([
      "wholesaler",
      "auto-glass",
      "plumbing-company",
      "electrician-solo",
      "videographer",
    ]);
  });

  it("resolves explicit siteTemplate over slug seeds", () => {
    expect(
      resolveSiteTemplateId({
        slug: "jw-stone",
        contentBlocks: [{ type: "siteTemplate", data: { id: "electrician-solo" } }],
        tradePartner: true,
      })
    ).toBe("electrician-solo");
  });

  it("treats default as the canonical launch profile without selling it as an upgrade", () => {
    expect(
      resolveSiteTemplateId({
        slug: "new-business",
        contentBlocks: [{ type: "siteTemplate", data: { id: "default" } }],
      })
    ).toBe("default");
    expect(listSelectableProfileSiteTemplates().some((entry) => entry.id === "default")).toBe(
      false
    );
    expect(getProfileSiteTemplateMeta("default")).toMatchObject({
      label: "Default profile",
      selectable: false,
    });
  });

  it("seeds known branded slugs when no block exists", () => {
    expect(resolveSiteTemplateId({ slug: "jw-stone" })).toBe("wholesaler");
    expect(resolveSiteTemplateId({ slug: "jrs-auto-glass" })).toBe("auto-glass");
    expect(resolveSiteTemplateId({ slug: "la-plumbing-solutions" })).toBe("plumbing-company");
    expect(resolveSiteTemplateId({ slug: "dean-damaskos" })).toBe("financial-professional");
    expect(resolveSiteTemplateId({ slug: "unknown-shop" })).toBe("default");
  });

  it("keeps the reconciled financial-professional theme profile-specific", () => {
    expect(getProfileSiteTemplateMeta("financial-professional")).toMatchObject({
      label: "Financial professional",
      family: "professional-services",
      selectable: false,
    });
    expect(
      listSelectableProfileSiteTemplates().some(
        (entry) => (entry.id as string) === "financial-professional"
      )
    ).toBe(false);
  });

  it("persists featured stone slugs on inventoryCatalog", () => {
    const next = upsertFeaturedStoneSlugs([], ["taj-mahal", "rhino-white"]);
    expect(readFeaturedStoneSlugs(next)).toEqual(["taj-mahal", "rhino-white"]);
  });

  it("keeps share ordinals attached to their exact images when the lead changes", () => {
    const [stone] = applyInventoryLeadImageOverrides(
      [
        {
          slug: "sample-stone",
          images: ["detail.webp", "yard.webp", "full-slab.webp"],
          shareImageOrder: [0, 1, 2],
          imageFinishes: [["Leathered"], undefined, ["Polished"]],
        },
      ],
      { "sample-stone": "full-slab.webp" }
    );

    expect(stone.images).toEqual(["full-slab.webp", "detail.webp", "yard.webp"]);
    expect(stone.shareImageOrder).toEqual([1, 2, 0]);
    expect(stone.imageFinishes).toEqual([["Polished"], ["Leathered"], undefined]);
  });

  it("creates a stable share map before changing a lead when identity maps were omitted", () => {
    const [stone] = applyInventoryLeadImageOverrides(
      [
        {
          slug: "sample-stone",
          images: ["detail.webp", "yard.webp", "full-slab.webp"],
        },
      ],
      { "sample-stone": "full-slab.webp" }
    );

    expect(stone.images).toEqual(["full-slab.webp", "detail.webp", "yard.webp"]);
    expect(stone.shareImageOrder).toEqual([1, 2, 0]);
  });

  it("seeds electrician-solo with a localServiceProfile presentation", () => {
    const seeded = seedBlocksForTemplate("electrician-solo", [], { displayName: "Amp Co" });
    expect(upsertSiteTemplateBlock(seeded, "electrician-solo")[0]).toMatchObject({
      type: "siteTemplate",
      data: { id: "electrician-solo" },
    });
    expect(seeded.some((block) => block.type === "localServiceProfile")).toBe(true);
  });

  it("seeds videographer with an editable service block", () => {
    const seeded = seedBlocksForTemplate("videographer", [], {
      displayName: "Camera Co",
    });

    expect(seeded).toContainEqual({
      type: "siteTemplate",
      data: { id: "videographer" },
    });
    expect(seeded).toContainEqual({
      type: "services",
      data: { items: ["Photo and video"] },
    });
  });

  it("detects videographer lanes without matching unrelated word fragments", () => {
    expect(suggestTemplateFromBusinessType("Drone videographer")).toBe("videographer");
    expect(suggestTemplateFromBusinessType("Aerial photography")).toBe("videographer");
    expect(suggestTemplateFromBusinessType("Media production")).toBe("videographer");
    expect(suggestTemplateFromBusinessType("Photovoltaic installer")).not.toBe("videographer");
    expect(suggestTemplateFromBusinessType("Filmstrip supplier")).not.toBe("videographer");
  });
});
