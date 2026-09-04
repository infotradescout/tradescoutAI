import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("JW Stone discovery and request conversion", () => {
  it("keeps the corrected hero and First Cut proportions", () => {
    const hero = read("client/src/features/jw-stone/MarketplaceIntroduction.tsx");
    const firstCut = read("client/src/features/jw-stone/FirstCutSection.tsx");

    expect(hero).toContain("h-[42svh]");
    expect(hero).toContain("sm:h-[44svh]");
    expect(hero).toContain("lg:h-[46svh]");
    expect(firstCut).toContain("aspect-[12/5]");
    expect(firstCut).toContain("aspect-[3/2]");
  });

  it("aligns visible and hydrated metadata with Pensacola buyer intent", () => {
    const hero = read("client/src/features/jw-stone/MarketplaceIntroduction.tsx");
    const marketplace = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
    const normalizedHero = hero.replace(/\s+/g, " ");

    expect(normalizedHero).toContain(
      "Natural stone slabs for fabricators, builders, designers, architects, and homeowners"
    );
    expect(normalizedHero).toContain("in Pensacola and across the Gulf Coast.");
    expect(marketplace).toContain(
      "Natural Stone Slabs in Pensacola, FL | JW Stone Logistics"
    );
    expect(marketplace).toContain('"@type": "Store"');
    expect(marketplace).toContain('areaServed: { "@type": "AdministrativeArea", name: "Gulf Coast" }');
    expect(marketplace).toContain("JW_STONE_KNOWS_ABOUT");
  });

  it("opens the full request form first while preserving the call option behind Back", () => {
    const marketplace = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");

    expect(marketplace).toContain('initialView="request"');
    expect(marketplace).toContain("allowCall");
    expect(panel).toContain('aria-label="Back to contact options"');
    expect(panel).toContain('setView("choice")');
  });

  it("keeps hydrated deep metadata local while keeping schema descriptions factual", () => {
    const seo = read("client/src/features/jw-stone/JwStoneProfileSeo.tsx");

    expect(seo).toContain("resolveMarketplaceSeo");
    expect(seo).toContain("marketplaceSeo.structuredDescription");
    expect(seo).toContain("JW_STONE_STRUCTURED_DESCRIPTION");
  });

  it("gives crawlers direct paths to the strongest applicable inventory without exposing economics", () => {
    const crawlerHtml = read("server/publicJwStoneMarketplaceHtml.ts");

    expect(crawlerHtml).toContain("Popular stone selections");
    expect(crawlerHtml).toContain("Priority named stone pages:");
    for (const slug of [
      "black-dunes",
      "avalanche",
      "cristalita-blue",
      "rhino-white",
      "blue-bahia",
      "calacatta-vaguili",
      "matarazzo",
      "calacatta-cremo",
      "casa-blanca",
      "white-santorini",
    ]) {
      expect(crawlerHtml).toContain(`"${slug}"`);
    }
    expect(crawlerHtml).not.toMatch(/landed cost|competitor price|gross spread|markup multiple/i);
  });
});
