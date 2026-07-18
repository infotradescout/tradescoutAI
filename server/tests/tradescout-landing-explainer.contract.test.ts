import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { explainerChapters } from "../../client/src/pages/tradescoutExplainerData";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("TradeScout plain-language landing explainer", () => {
  const landingSource = read("client/src/pages/TradeScoutLandingPage.tsx");
  const fallbackSource = read("server/publicLandingHtml.ts");

  it("keeps the eight canonical explainer chapters in order", () => {
    expect(explainerChapters.map((chapter) => chapter.navLabel)).toEqual([
      "Scout",
      "Requests & contact",
      "Business home",
      "Home & property",
      "Money",
      "Community",
      "CVS",
      "Every feature",
    ]);
  });

  it("keeps the full feature inventory and named TradeScout differentiators", () => {
    const features = explainerChapters.flatMap((chapter) =>
      chapter.topics.flatMap((topic) => topic.features || [])
    );

    expect(features).toHaveLength(69);
    expect(features.map((feature) => feature.name)).toEqual(
      expect.arrayContaining([
        "Direct Connect",
        "Community Verification Score (CVS)",
        "Emergency directory",
        "Custom domain",
        "Selective Inheritance",
      ])
    );
  });

  it("uses native expandable feature cards without depending on the prototype site", () => {
    expect(landingSource).toContain('<details className="ts-feature-card"');
    expect(landingSource).not.toContain("iframe");
    expect(landingSource).not.toContain("mrplatypus4777.chatgpt.site");
  });

  it("keeps pricing in the approved reveal order", () => {
    const madeYouLook = landingSource.indexOf("Made you look.");
    const freeForever = landingSource.indexOf("TradeScout is free forever.");
    const revenueLink = landingSource.indexOf("See how we earn revenue here");

    expect(madeYouLook).toBeGreaterThan(-1);
    expect(freeForever).toBeGreaterThan(madeYouLook);
    expect(revenueLink).toBeGreaterThan(freeForever);
  });

  it("gives crawlers the same eight-part story and Selective Inheritance definition", () => {
    for (const hash of [
      "#scout",
      "#connect",
      "#businesses",
      "#property",
      "#money",
      "#impact",
      "#trust",
      "#system",
    ]) {
      expect(fallbackSource).toContain(`/landing${hash}`);
    }
    expect(fallbackSource).toContain("Selective Inheritance");
    expect(fallbackSource).toContain("useful, provable information from an outside source");
  });
});
