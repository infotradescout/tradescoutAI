import { describe, expect, it } from "vitest";
import {
  listSelectableProfileSiteTemplates,
  readFeaturedStoneSlugs,
  resolveSiteTemplateId,
  seedBlocksForTemplate,
  upsertFeaturedStoneSlugs,
  upsertSiteTemplateBlock,
} from "@shared/profileSiteTemplates";

describe("profile site templates", () => {
  it("exposes the v1 selectable gallery only", () => {
    expect(listSelectableProfileSiteTemplates().map((entry) => entry.id)).toEqual([
      "wholesaler",
      "auto-glass",
      "plumbing-company",
      "electrician-solo",
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

  it("seeds known branded slugs when no block exists", () => {
    expect(resolveSiteTemplateId({ slug: "jw-stone" })).toBe("wholesaler");
    expect(resolveSiteTemplateId({ slug: "jrs-auto-glass" })).toBe("auto-glass");
    expect(resolveSiteTemplateId({ slug: "la-plumbing-solutions" })).toBe("plumbing-company");
    expect(resolveSiteTemplateId({ slug: "unknown-shop" })).toBe("default");
  });

  it("persists featured stone slugs on inventoryCatalog", () => {
    const next = upsertFeaturedStoneSlugs([], ["taj-mahal", "rhino-white"]);
    expect(readFeaturedStoneSlugs(next)).toEqual(["taj-mahal", "rhino-white"]);
  });

  it("seeds electrician-solo with a localServiceProfile presentation", () => {
    const seeded = seedBlocksForTemplate("electrician-solo", [], { displayName: "Amp Co" });
    expect(upsertSiteTemplateBlock(seeded, "electrician-solo")[0]).toMatchObject({
      type: "siteTemplate",
      data: { id: "electrician-solo" },
    });
    expect(seeded.some((block) => block.type === "localServiceProfile")).toBe(true);
  });
});
