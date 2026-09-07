import { describe, expect, it } from "vitest";
import {
  collectProfileIndexNowUrls,
  combineIndexNowChangeUrls,
} from "../services/indexNowPublicationEvents";

const inventory = {
  type: "inventoryCatalog",
  data: {
    categories: [{
      category: "Onyx",
      categorySlug: "onyx",
      stones: [
        { name: "Honey Onyx", slug: "honey-onyx", images: ["/uploads/honey-onyx.webp"] },
        { name: "Multi Green Onyx", slug: "multi-green-onyx", images: ["/uploads/multi-green-onyx.webp"] },
      ],
    }],
  },
};
const profile = { slug: "issa-build", status: "published", contentBlocks: [inventory] };
const destinations = [
  "/issa-build",
  "/issa-build/onyx",
  "/issa-build/onyx/inventory/honey-onyx",
  "/issa-build/onyx/inventory/multi-green-onyx",
];

describe("Issa Build and Onyx publication destinations", () => {
  it("notifies the actual separate business, collection and stone destinations", () => {
    expect(collectProfileIndexNowUrls(profile, true)).toEqual(destinations);
  });

  it("uses the existing product destination for the legacy product profile root", () => {
    expect(collectProfileIndexNowUrls({ slug: "honey-onyx", status: "published" }, true))
      .toEqual(["/issa-build/onyx"]);
  });

  it.each(["draft", "archived", "", undefined])("does not publish a profile with status %s", (status) => {
    expect(collectProfileIndexNowUrls({ ...profile, status }, true)).toEqual([]);
  });

  it("does not turn a known business name into publication authority", () => {
    expect(collectProfileIndexNowUrls(profile, false)).toEqual([]);
    expect(collectProfileIndexNowUrls({ slug: "honey-onyx", status: "published" }, false)).toEqual([]);
  });

  it("does not use a platform key to claim another business's custom domain", () => {
    expect(collectProfileIndexNowUrls({ ...profile, seoMeta: { customDomain: "supplier.example" } }, true))
      .toEqual([]);
  });

  it("keeps the business destination while respecting category and inventory opt-outs", () => {
    const contentBlocks = [inventory, { type: "publicDiscovery", data: { sitemap: { categories: false, inventory: false } } }];
    expect(collectProfileIndexNowUrls({ ...profile, contentBlocks }, true)).toEqual(["/issa-build"]);
  });

  it("does not rewrite unknown inventory destinations into invented Onyx pages", () => {
    const contentBlocks = [{
      type: "inventoryCatalog",
      data: { categories: [{
        category: "Quartzite", categorySlug: "quartzite",
        stones: [{ name: "Other Material", slug: "other-material", images: ["/uploads/other.webp"] }],
      }] },
    }];
    expect(collectProfileIndexNowUrls({ ...profile, contentBlocks }, true)).toEqual([
      "/issa-build",
      "/u/issa-build/categories/quartzite",
      "/u/issa-build/inventory/other-material",
    ]);
  });

  it.each(["independent-supplier", "another-local-business"])("preserves the same catalog capabilities for %s", (slug) => {
    expect(collectProfileIndexNowUrls({ ...profile, slug }, true)).toEqual([
      `/u/${slug}`, `/u/${slug}/categories/onyx`,
      `/u/${slug}/inventory/honey-onyx`, `/u/${slug}/inventory/multi-green-onyx`,
    ]);
  });

  it("management does not change destinations or bypass publication checks", () => {
    const ownerManaged = { ...profile, managedByTradeScout: false };
    const assisted = { ...profile, managedByTradeScout: true };
    expect(collectProfileIndexNowUrls(ownerManaged, true)).toEqual(destinations);
    expect(collectProfileIndexNowUrls(assisted, true)).toEqual(destinations);
    expect(collectProfileIndexNowUrls(assisted, false)).toEqual([]);
  });

  it("includes the old and new eligible destinations for unpublishing and renaming", () => {
    const before = collectProfileIndexNowUrls(profile, true);
    expect(combineIndexNowChangeUrls(before, collectProfileIndexNowUrls(profile, false)))
      .toEqual(destinations);
    const after = collectProfileIndexNowUrls({ slug: "new-business-name", status: "published" }, true);
    expect(combineIndexNowChangeUrls(before, after)).toEqual([...destinations, "/u/new-business-name"]);
  });

  it("does not publish contact details, membership data, or prices", () => {
    const source = { ...profile, privatePhone: "TEST-PRIVATE-PHONE", memberPrice: "TEST-MEMBER-PRICE", membership: "TEST-PRIVATE-MEMBERSHIP" };
    const urls = collectProfileIndexNowUrls(source, true);
    expect(urls).toEqual(destinations);
    expect(urls.join("\n")).not.toContain("TEST-");
  });

  it("requires an actual profile slug and does not fabricate a managed business", () => {
    expect(collectProfileIndexNowUrls(null, true)).toEqual([]);
    expect(collectProfileIndexNowUrls(undefined, true)).toEqual([]);
    expect(collectProfileIndexNowUrls({ status: "published", contentBlocks: [inventory] }, true)).toEqual([]);
  });
});
