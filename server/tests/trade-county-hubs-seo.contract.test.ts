import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("trade and county hub SEO contracts", () => {
  const appRoutes = read("client/src/AppRoutes.tsx");
  const tradeDirectory = read("client/src/pages/trade/TradeDirectoryPage.tsx");
  const countyPage = read("client/src/pages/county/CountyPage.tsx");
  const countyDirectory = read("client/src/pages/county-directory.tsx");

  it("keeps the central trade and county SEO routes wired in AppRoutes", () => {
    expect(appRoutes).toContain("const TradeDirectoryPage = React.lazy");
    expect(appRoutes).toContain("const CountyPage = React.lazy");
    expect(appRoutes).toContain("const CountyDirectory = React.lazy");
    expect(appRoutes).toContain('<Route path="/trade">');
    expect(appRoutes).toContain('<Route path="/trade/:tradeSlug/:stateCode/:countySlug">');
    expect(appRoutes).toContain('<Route path="/county/:stateCode/:countySlug">');
    expect(appRoutes).toContain('<Route path="/county-directory">');
    expect(appRoutes).toContain('<Route path="/county-hub">');
  });

  it("keeps SEO metadata on central trade and county discovery surfaces", () => {
    for (const [label, source] of [
      ["trade directory", tradeDirectory],
      ["county page", countyPage],
      ["county directory", countyDirectory],
    ] as const) {
      expect(source, `${label} should include SEOHelmet`).toContain("SEOHelmet");
      expect(source, `${label} should include canonical metadata`).toContain("canonical=");
    }

    expect(countyPage).toContain("createPlaceStructuredData");
    expect(countyPage).toContain("createAdministrativeAreaStructuredData");
    expect(countyPage).toContain("createFAQStructuredData");
    expect(countyDirectory).toContain("createBreadcrumbStructuredData");
  });

  it("keeps trade and county discovery framed around local markets, businesses, community, and Direct Connect", () => {
    expect(tradeDirectory).toContain("Trades Directory");
    expect(tradeDirectory).toContain("Browse by trade first");
    expect(tradeDirectory).toContain("Browse locally before any contact decision opens.");

    expect(countyDirectory).toContain("County Directory");
    expect(countyDirectory).toContain("community activity");
    expect(countyDirectory).toContain("verified business discovery");
    expect(countyDirectory).toContain("Browse counties by state");
    expect(countyDirectory).toContain("local market page");

    expect(countyPage).toContain("Find local help near");
    expect(countyPage).toContain("Open Direct Connect");
    expect(countyPage).toContain("Join neighbors, local businesses, and professionals.");
    expect(countyPage).toContain("Community around");
  });

  it("treats contractor wording as a search/trade subset without turning it into whole-platform identity", () => {
    expect(tradeDirectory).toContain(
      'keywords="trades, contractors, directory, local services, TradeScout"'
    );
    expect(countyPage).toContain("How do I find contractors near");
    expect(countyPage).toContain("Find verified contractors");
    expect(countyPage).toContain("verified local providers");
    expect(countyPage).not.toContain("TradeScout is only for contractors");
    expect(countyPage).not.toContain("contractors only");
    expect(countyDirectory).not.toContain("contractors only");
  });

  it("blocks chatbot, lead-selling, pay-to-play, and internal architecture framing on the central trade/county SEO surfaces", () => {
    const combined = [tradeDirectory, countyPage, countyDirectory].join("\n").toLowerCase();

    expect(combined).toContain("direct connect");
    expect(combined).not.toContain("scout chatbot");
    expect(combined).not.toContain("ai chatbot");
    expect(combined).not.toContain("lead marketplace");
    expect(combined).not.toContain("lead selling");
    expect(combined).not.toContain("lead-selling");
    expect(combined).not.toContain("pay-to-play");
    expect(combined).not.toContain("routing algorithm");
    expect(combined).not.toContain("authority layer");
    expect(combined).not.toContain("backend routing system");
    expect(combined).not.toContain("handoff doctrine");
    expect(combined).not.toContain("operating system architecture");
  });
});
