import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("Trade-Up For Trade Schools campaign surface", () => {
  const appRoutes = read("client/src/AppRoutes.tsx");
  const page = read("client/src/pages/trade-up-for-trade-schools.tsx");
  const sitemapGenerator = read("scripts/generate-sitemap.mjs");

  it("registers the flat public campaign route", () => {
    expect(appRoutes).toContain(
      'const TradeUpForTradeSchools = React.lazy(() => import("./pages/trade-up-for-trade-schools"));'
    );
    expect(appRoutes).toContain('<Route path="/trade-up-for-trade-schools">');
    expect(sitemapGenerator).toContain("'/trade-up-for-trade-schools'");
  });

  it("frames campaign support through branding item purchases, not direct donations", () => {
    expect(page).toContain("Trade-Up For Trade Schools");
    expect(page).toContain(
      "Purchase campaign branding items dedicated to funding trade school scholarships."
    );
    expect(page).toContain("supports trade school scholarships and skilled-trades");
    expect(page).toContain("cause-dedicated campaign branding items people can purchase");
    expect(page).toContain("Purchase through the campaign catalog");
    expect(page).toContain("Direct donation portal handled separately.");
  });

  it("uses construction pencil language and avoids school-pencil framing", () => {
    expect(page.toLowerCase()).toMatch(/carpenter pencil|construction pencil/);
    expect(page).not.toContain("No. 2 pencil");
    expect(page).not.toContain("yellow school pencil");
  });

  it("stays informational without checkout, fake claims, or live counters", () => {
    const normalized = page.toLowerCase();

    expect(page).toContain("Request item list");
    expect(page).toContain("Sponsor an item");
    expect(page).toContain("Get campaign updates");
    expect(normalized).not.toContain("add to cart");
    expect(normalized).not.toContain("checkout");
    expect(normalized).not.toContain("payment processing");
    expect(normalized).not.toContain("inventory");
    expect(normalized).not.toContain("sponsor name");
    expect(normalized).not.toContain("scholarship recipient");
    expect(normalized).not.toContain("total raised");
    expect(normalized).not.toContain("totals raised");
    expect(normalized).not.toContain("501(c)");
    expect(normalized).not.toContain("tax-deductible");
  });

  it("includes SEO metadata and the required disclaimer boundary", () => {
    expect(page).toContain("SEOHelmet");
    expect(page).toContain("Trade-Up For Trade Schools | TradeScout");
    expect(page).toContain(
      "A TradeScout initiative supporting trade school scholarships through cause-dedicated campaign branding items."
    );
    expect(page).toContain('canonical="https://www.thetradescout.com/trade-up-for-trade-schools"');
    expect(page).toContain(
      "Direct donation portal handled separately. No tax-deductibility or nonprofit status"
    );
  });
});
