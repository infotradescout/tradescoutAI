import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("trade county page SEO contract", () => {
  const appRoutes = read("client/src/AppRoutes.tsx");
  const tradeCountyPage = read("client/src/pages/trade/TradeCountyPage.tsx");

  it("keeps the central trade county route wired to the TradeCountyPage lazy import", () => {
    expect(appRoutes).toContain(
      'const TradeCountyPage = React.lazy(() => import("./pages/trade/TradeCountyPage"));'
    );
    expect(appRoutes).toContain('<Route path="/trade/:tradeSlug/:stateCode/:countySlug">');
    expect(appRoutes).toContain("<LazyPage Component={TradeCountyPage} />");
  });

  it("keeps SEO metadata and structured crawl context on TradeCountyPage", () => {
    expect(tradeCountyPage).toContain("SEOHelmet");
    expect(tradeCountyPage).toContain("canonical={`https://www.thetradescout.com/trade/");
    expect(tradeCountyPage).toContain("keywords={`${trade.name}, ${county.name}, ${state.name}");
    expect(tradeCountyPage).toContain("createBreadcrumbStructuredData");
    expect(tradeCountyPage).toContain(
      "structuredData={createBreadcrumbStructuredData(breadcrumbs)}"
    );
  });

  it("preserves local market discovery framing, business listing framing, and request path CTA", () => {
    expect(tradeCountyPage).toContain("County market");
    expect(tradeCountyPage).toContain(
      "Start with the local market, then narrow by city or neighborhood."
    );
    expect(tradeCountyPage).toContain('"/api/businesses"');
    expect(tradeCountyPage).toContain("href={`/business/${encodeURIComponent(biz.slug)}`}");
    expect(tradeCountyPage).toContain("Claimed");
    expect(tradeCountyPage).toContain("Unclaimed");
    expect(tradeCountyPage).toContain("const scoutEstimateHref = `/scout?intent=estimate");
    expect(tradeCountyPage).toContain("Start a Request");
  });

  it("keeps contractor wording as a trade/search subset without turning TradeScout into a contractors-only platform", () => {
    expect(tradeCountyPage).toContain(
      "const description = `Find ${trade.name} contractors serving ${marketLabel}."
    );
    expect(tradeCountyPage).toContain("directory, contractors, TradeScout");
    expect(tradeCountyPage.toLowerCase()).not.toContain("tradescout is only for contractors");
    expect(tradeCountyPage.toLowerCase()).not.toContain("contractors only");
    expect(tradeCountyPage.toLowerCase()).not.toContain("platform for contractors only");
  });

  it("noindexes only authoritative empty data and preserves SSR robots on transient states", () => {
    expect(tradeCountyPage).toContain("getDiscoveryScopeRobotsDecision");
    expect(tradeCountyPage).toContain("noIndex={robotsDecision.noIndex}");
    expect(tradeCountyPage).toContain("preserveRobots={robotsDecision.preserveRobots}");
  });

  it("blocks chatbot, lead-selling, pay-to-play, and internal architecture framing on TradeCountyPage", () => {
    const normalized = tradeCountyPage.toLowerCase();

    expect(normalized).not.toContain("scout chatbot");
    expect(normalized).not.toContain("ai chatbot");
    expect(normalized).not.toContain("lead marketplace");
    expect(normalized).not.toContain("lead selling");
    expect(normalized).not.toContain("lead-selling");
    expect(normalized).not.toContain("pay-to-play");
    expect(normalized).not.toContain("routing algorithm");
    expect(normalized).not.toContain("authority layer");
    expect(normalized).not.toContain("backend routing system");
    expect(normalized).not.toContain("handoff doctrine");
    expect(normalized).not.toContain("operating system architecture");
  });
});
