import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

const withoutDisclaimer = (page: string) =>
  page.replace(
    /Trade-Up For Trade Schools is an independent initiative run by TradeScout\. Direct[\s\S]*?formally stated by TradeScout\./,
    ""
  );

describe("Trade-Up For Trade Schools campaign surface", () => {
  const app = read("client/src/App.tsx");
  const appRoutes = read("client/src/AppRoutes.tsx");
  const page = read("client/src/pages/trade-up-for-trade-schools.tsx");
  const sitemapGenerator = read("scripts/generate-sitemap-core.mjs");

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

  it("frames the page as the real TradeScout trade-up campaign series", () => {
    const normalizedWhitespace = page.replace(/\s+/g, " ");

    expect(page).toContain("Trade-Up For Trade Schools");
    expect(page).toContain("Trade-Up Project Goal Tracker");
    expect(normalizedWhitespace).toContain(
      "Following the journey from a single carpenter’s pencil to $250,000 in trade school scholarships."
    );
    expect(page).toContain("Offer a Trade");
    expect(page).toContain("Follow the Trade-Up Series");
    expect(page).toContain("Connect the Next Trade");
    expect(page).toContain("How the trade-up works");
    expect(page).toContain("Campaign status");
    expect(page).toContain("TradeScout Carpenter’s Pencil");
    expect(page).toContain("$250,000 in trade school scholarships");
    expect(page).toContain("Direct donation portal is separate.");
    expect(page).toContain(
      "Trade-Up For Trade Schools is an independent initiative run by TradeScout."
    );
  });

  it("renders the truthful project goal tracker without invented progress", () => {
    expect(page).toContain("Trade-Up Project Goal Tracker");
    expect(page).toContain("Starting item");
    expect(page).toContain("TradeScout Carpenter’s Pencil");
    expect(page).toContain("Goal");
    expect(page).toContain("$250,000 in trade school scholarships");
    expect(page).toContain("Current stage");
    expect(page).toContain("Starting point");
    expect(page).toContain("Current item");
    expect(page).toContain("Next milestone");
    expect(page).toContain("First accepted trade");
    expect(page).toContain("Verified updates");
    expect(page).toContain("Published as the series progresses");
    expect(page.replace(/\s+/g, " ")).toContain(
      "The tracker will update as verified trades are accepted and published through the series."
    );
    expect(page).toContain("Start");
    expect(page).toContain("Next");
    expect(page).toContain("$250,000 scholarships");
  });

  it("keeps the carpenter-pencil-to-scholarships mechanic explicit", () => {
    expect(page).toContain("TradeScout Campaign Series");
    expect(page).toContain("Start with a carpenter pencil");
    expect(page).toContain("Trade up one step at a time");
    expect(page).toContain("Build toward $250,000");
    expect(page).toContain("Current starting item: TradeScout Carpenter’s Pencil");
    expect(page).toContain("Next accepted trade: not yet published.");
    expect(page.replace(/\s+/g, " ")).toContain(
      "Turn one carpenter’s pencil into $250,000 worth of trade school scholarships through a public trade-up campaign."
    );
  });

  it("removes the invented product catalog framing", () => {
    expect(page).not.toContain("Campaign items dedicated to the initiative");
    expect(page).not.toContain("Campaign item list");
    expect(page).not.toContain("Campaign construction pencils");
    expect(page).not.toContain("Jobsite decals");
    expect(page).not.toContain("Sponsor cards");
    expect(page).not.toContain("Crew signage");
    expect(page).not.toContain("Branded apparel");
    expect(page).not.toContain("Request campaign item list");
    expect(page).not.toContain("Request item list");
    expect(page).not.toContain("Ask about sponsoring");
    expect(page).not.toContain("Get campaign updates");
    expect(page).not.toContain("shopping cart");
    expect(page).not.toContain("prices");
    expect(page.toLowerCase()).not.toContain("apparel");
    expect(page.toLowerCase()).not.toContain("decals");
    expect(page.toLowerCase()).not.toContain("signage");
    expect(page.toLowerCase()).not.toContain("sponsor cards");
  });

  it("stays informational without checkout, donation-page, or fake status claims", () => {
    const normalized = withoutDisclaimer(page).toLowerCase();

    expect(normalized).not.toContain("classrooms");
    expect(normalized).not.toContain("built for shops, crews, and classrooms");
    expect(normalized).not.toContain("carpenter pencil motif");
    expect(normalized).not.toContain("school partners");
    expect(normalized).not.toContain("partner schools");
    expect(normalized).not.toContain("school endorsement");
    expect(normalized).not.toContain("recipients");
    expect(normalized).not.toMatch(/\bbuy\b/);
    expect(normalized).not.toContain("buy now");
    expect(normalized).not.toContain("purchase");
    expect(normalized).not.toContain("checkout");
    expect(normalized).not.toContain("add to cart");
    expect(normalized).not.toContain("payment processing");
    expect(normalized).not.toContain("shopping cart");
    expect(normalized).not.toContain("prices");
    expect(normalized).not.toContain("tax write-off");
    expect(normalized).not.toContain("501(c)");
    expect(normalized).not.toContain("tax-deductible");
    expect(normalized).not.toContain("total raised");
    expect(normalized).not.toContain("totals raised");
    expect(normalized).not.toContain("% complete");
    expect(normalized).not.toContain("percent complete");
    expect(normalized).not.toContain("current estimated value");
    expect(normalized).not.toContain("amount raised");
    expect(normalized).not.toContain("trade count");
    expect(normalized).not.toContain("episode count");
  });

  it("includes SEO metadata and the exact required disclaimer boundary", () => {
    const normalizedWhitespace = page.replace(/\s+/g, " ");

    expect(page).toContain("SEOHelmet");
    expect(page).toContain("Trade-Up For Trade Schools | TradeScout");
    expect(page).toContain(
      "A TradeScout campaign series following the journey from one carpenter’s pencil to $250,000 in trade school scholarships."
    );
    expect(page).toContain('canonical="https://www.thetradescout.com/trade-up-for-trade-schools"');
    expect(normalizedWhitespace).toContain(
      "Trade-Up For Trade Schools is an independent initiative run by TradeScout. Direct donations are separate. No nonprofit, tax-deductible, formal institutional affiliation, school endorsement, scholarship recipient, or distribution process is implied unless formally stated by TradeScout."
    );
  });
});
