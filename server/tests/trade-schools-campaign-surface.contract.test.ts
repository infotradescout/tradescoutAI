import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

const withoutDisclaimer = (page: string) =>
  page.replace(
    /Trade-Up For Trade Schools is a TradeScout-run campaign initiative\. No school[\s\S]*?Direct donation portal handled separately\./,
    ""
  );

describe("Trade-Up For Trade Schools campaign surface", () => {
  const app = read("client/src/App.tsx");
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

  it("renders as a public campaign route outside the app shell", () => {
    expect(app).toContain(
      'const isPublicCampaignRoute = pathOnly === "/trade-up-for-trade-schools";'
    );
    expect(app).toContain("isPublicCampaignRoute={isPublicCampaignRoute}");
    expect(appRoutes).toContain("isPublicCampaignRoute: boolean;");
    expect(appRoutes).toContain(") : isPublicCampaignRoute ? (");
  });

  it("frames the page as a TradeScout-run internal campaign", () => {
    const normalizedWhitespace = page.replace(/\s+/g, " ");

    expect(page).toContain("Trade-Up For Trade Schools");
    expect(page).toContain(
      "Buy campaign-branded items that help support future trade school scholarships."
    );
    expect(normalizedWhitespace).toContain(
      "A TradeScout-run campaign built around practical branded items, sponsor support, and a separate direct donation path."
    );
    expect(page).toContain("Campaign item list");
    expect(page).toContain("Campaign items dedicated to the initiative");
    expect(page).toContain("Campaign construction pencils");
    expect(page).toContain("Direct donation portal handled separately.");
    expect(page).toContain("Trade-Up For Trade Schools is a TradeScout-run campaign initiative.");
  });

  it("keeps campaign items immediately after the hero", () => {
    expect(page.indexOf('id="campaign-items"')).toBeGreaterThan(page.indexOf("<aside"));
    expect(page.indexOf('id="campaign-items"')).toBeLessThan(
      page.indexOf("How the campaign works")
    );
  });

  it("uses construction pencil language and avoids school-pencil framing", () => {
    expect(page.toLowerCase()).toMatch(/carpenter pencil|construction pencil/);
    expect(page).not.toContain("Carpenter pencil motif");
    expect(page).not.toContain("No. 2 pencil");
    expect(page).not.toContain("yellow school pencil");
    expect(page).not.toContain("Built for shops, crews, and classrooms");
  });

  it("stays informational without checkout, donation-page, or fake status claims", () => {
    const normalized = withoutDisclaimer(page).toLowerCase();

    expect(page).toContain("Request item list");
    expect(page).toContain("Ask about sponsoring");
    expect(page).toContain("Get campaign updates");
    expect(normalized).not.toContain("classrooms");
    expect(normalized).not.toContain("built for shops, crews, and classrooms");
    expect(normalized).not.toContain("carpenter pencil motif");
    expect(normalized).not.toContain("school partners");
    expect(normalized).not.toContain("partner schools");
    expect(normalized).not.toContain("school endorsement");
    expect(normalized).not.toContain("students pursuing careers");
    expect(normalized).not.toContain("recipients");
    expect(normalized).not.toContain("donate");
    expect(normalized).not.toContain("buy now");
    expect(normalized).not.toContain("checkout");
    expect(normalized).not.toContain("add to cart");
    expect(normalized).not.toContain("payment processing");
    expect(normalized).not.toContain("501(c)");
    expect(normalized).not.toContain("total raised");
    expect(normalized).not.toContain("totals raised");
  });

  it("includes SEO metadata and the exact required disclaimer boundary", () => {
    const normalizedWhitespace = page.replace(/\s+/g, " ");

    expect(page).toContain("SEOHelmet");
    expect(page).toContain("Trade-Up For Trade Schools | TradeScout");
    expect(page).toContain(
      "Buy campaign-branded items that help support future trade school scholarships."
    );
    expect(page).toContain('canonical="https://www.thetradescout.com/trade-up-for-trade-schools"');
    expect(normalizedWhitespace).toContain(
      "Trade-Up For Trade Schools is a TradeScout-run campaign initiative. No school partnership, school endorsement, nonprofit status, tax-deductibility, scholarship recipient, or distribution process is implied unless formally stated by TradeScout. Direct donation portal handled separately."
    );
  });
});
