import { describe, expect, it } from "vitest";
import { prepareSitemapUrlSetEntries } from "../sitemapUrlSet";

const origin = "https://www.thetradescout.com";
const listing = "a93737e6-23fc-4a70-937b-827ef7f98daf";
const prepare = (paths: string[]) => prepareSitemapUrlSetEntries(paths.map(path => ({ loc: origin + path })));

describe("Canonical search sitemap destinations", () => {
  it("normalizes the observed unknown-category listing to its existing canonical destination", () => {
    expect(prepare([`/exchange/smokecategory-1773022418828/${listing}`])).toEqual([
      { loc: `${origin}/exchange/other/${listing}` },
    ]);
  });

  it.each([
    ["sell-your-business", "business"],
    ["real-estate", "real-estate"],
    ["construction-equipment", "construction"],
    ["building-materials-surfaces", "building-materials"],
    ["tools-hardware", "tools"],
    ["furniture-home-goods", "furniture"],
    ["farm-equipment", "farm"],
    ["electronics-technology", "electronics"],
    ["sports-recreation", "sports"],
    ["art-collectibles", "collectibles"],
    ["jewelry-luxury-items", "jewelry"],
    ["precious-metals-physical", "metals"],
    ["local-food-artisan-goods", "local-food"],
    ["other-high-value-items", "other"],
  ])("uses the listing category owner for %s → %s", (source, canonical) => {
    expect(prepare([`/exchange/${source}/${listing}`])[0].loc).toBe(`${origin}/exchange/${canonical}/${listing}`);
  });

  it.each(["business", "real-estate", "vehicles", "construction", "building-materials", "tools", "furniture", "farm", "business-equipment", "electronics", "sports", "collectibles", "jewelry", "metals", "local-food", "other"])("keeps an existing canonical %s listing unchanged", category => {
    const item = { loc: `${origin}/exchange/${category}/${listing}`, lastmod: "2026-09-11", priority: "0.6" };
    expect(prepareSitemapUrlSetEntries([item])).toEqual([item]);
  });

  it("collapses old and canonical locations before choosing the newer entry", () => {
    const older = { loc: `${origin}/exchange/other/${listing}`, lastmod: "2026-09-08", priority: "0.4", marker: "old" };
    const newer = { loc: `${origin}/exchange/smokecategory-1773022418828/${listing}`, lastmod: "2026-09-11", priority: "0.7", marker: "new" };
    expect(prepareSitemapUrlSetEntries([older, newer])).toEqual([{ ...newer, loc: older.loc }]);
    expect(newer.loc).toContain("smokecategory");
  });

  it("keeps the listing identity and URL suffix intact", () => {
    const paths = ["item%2Fone", "native-item", "item%3Fone"];
    for (const id of paths) {
      expect(prepare([`/exchange/unknown/${id}?source=existing#detail`])[0].loc)
        .toBe(`${origin}/exchange/other/${id}?source=existing#detail`);
    }
  });

  it("does not rewrite catalog-item routes, category browsing, or unrelated path shapes", () => {
    for (const path of ["/u/jw-stone-logistics/items/blue-dunes", "/exchange/building-materials", "/exchange?item=listing", "/exchange/unknown/nested/item"]) {
      expect(prepare([path])[0].loc).toBe(origin + path);
    }
  });

  it("does not apply TradeScout corrections to foreign hosts or relative strings", () => {
    for (const loc of ["https://example.test/exchange/unknown/item", "https://www.thetradescout.com.example.test/community", "/community", "not-an-absolute-url"]) {
      expect(prepareSitemapUrlSetEntries([{ loc }])).toEqual([{ loc }]);
    }
  });

  it("omits the observed redirect and signed-in entry paths without suppressing child or canonical pages", () => {
    expect(prepare(["/community", "/contact?source=sitemap", "/maps/", "/community-feed", "/about", "/pricing", "/community/example"])
      .map(entry => new URL(entry.loc).pathname))
      .toEqual(["/about", "/community-feed", "/community/example", "/pricing"]);
  });

  it("preserves metadata and leaves input records untouched", () => {
    const input = Object.freeze({ loc: `${origin}/exchange/unknown/${listing}`, lastmod: "2026-09-11", changefreq: "daily", priority: "0.5", source: "existing-row" });
    expect(prepareSitemapUrlSetEntries([input])).toEqual([{ ...input, loc: `${origin}/exchange/other/${listing}` }]);
    expect(input.loc).toContain("/unknown/");
  });
});
