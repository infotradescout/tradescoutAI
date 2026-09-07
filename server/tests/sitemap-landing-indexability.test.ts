import { describe, expect, it } from "vitest";
import { buildPublicLandingHtml } from "../publicLandingHtml";
import { prepareSitemapUrlSetEntries } from "../sitemapUrlSet";

const origin = "https://www.thetradescout.com";
const entry = (pathname: string) => ({ loc: origin + pathname, lastmod: "2026-09-07" });

describe("sitemaps respect the existing public landing indexability contract", () => {
  it("excludes the homepage aliases already declared noindex by the actual page renderer", async () => {
    const html = await buildPublicLandingHtml({
      origin,
      requestPath: "/landing",
      templateHtml: '<html><head><title>TradeScout</title></head><body><div id="root"></div></body></html>',
    });
    expect(html).toContain('<meta name="robots" content="noindex,follow"');
    expect(html).toContain(`<link rel="canonical" href="${origin}/"`);
    expect(prepareSitemapUrlSetEntries([entry("/"), entry("/landing"), entry("/lp")])).toEqual([
      entry("/"),
    ]);
  });

  it("keeps reviewed canonical landing variants but not aliases or unreviewed campaigns", () => {
    const urls = prepareSitemapUrlSetEntries([
      entry("/landing/contractor"),
      entry("/lp/contractor"),
      entry("/landing/unreviewed-campaign-for-testing"),
      entry("/landing/contractor?campaign=test"),
      entry("/?campaign=test"),
    ]).map((item) => item.loc);
    expect(urls).toEqual([origin + "/landing/contractor"]);
  });

  it("does not apply TradeScout landing rules to business custom domains or unrelated pages", () => {
    const entries = [
      { loc: "https://example.com/landing" },
      { loc: "https://example.com/lp/contractor" },
      { loc: "https://example.com/?campaign=test" },
      entry("/pensacola"),
      entry("/about"),
      entry("/landing-page-design"),
    ];
    expect(prepareSitemapUrlSetEntries(entries).map((item) => item.loc).sort()).toEqual(
      entries.map((item) => item.loc).sort()
    );
  });

  it("preserves the business, collection and individual stone destinations", () => {
    const paths = [
      "/issa-build",
      "/issa-build/onyx",
      "/issa-build/onyx/inventory/honey-onyx",
      "/issa-build/onyx/inventory/multi-green-onyx",
    ];
    expect(prepareSitemapUrlSetEntries(paths.map(entry)).map((item) => item.loc).sort()).toEqual(
      paths.map((pathname) => origin + pathname).sort()
    );
  });

  it("retains deterministic deduplication without mutating source entries", () => {
    const entries = [
      { loc: origin + "/", lastmod: "2026-09-06" },
      { loc: origin + "/", lastmod: "2026-09-07" },
      entry("/landing"),
    ];
    const before = JSON.stringify(entries);
    expect(prepareSitemapUrlSetEntries(entries)).toEqual([
      { loc: origin + "/", lastmod: "2026-09-07" },
    ]);
    expect(JSON.stringify(entries)).toBe(before);
  });
});
