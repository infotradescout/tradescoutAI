import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("crawler telemetry contracts", () => {
  it("persists crawler request events through a dedicated service", () => {
    const source = read("server/services/crawlerTelemetryService.ts");
    const requestActorSource = read("server/utils/requestActor.ts");

    expect(source).toContain("CREATE TABLE IF NOT EXISTS crawler_request_events");
    expect(source).toContain("source_surface");
    expect(source).toContain("state_code");
    expect(source).toContain("county_slug");
    expect(source).toContain("county_fips");
    expect(source).toContain("category_slug");
    expect(source).toContain("crawler_request_hourly_rollups");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS bot_observation_events");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS bot_observation_daily_agg");
    expect(source).toContain("recordCrawlerRequestEvent");
    expect(source).toContain("detectActorFromUserAgent");
    expect(source).toContain("hashIp");
    expect(source).toContain("classifyRequestType");
    expect(source).toContain("pruneCrawlerRequestEventsIfNeeded");
    expect(source).toContain("resolveCountyFips");
    expect(source).toContain("refreshBotObservationDailyAggregate");
    expect(source).toContain("crawlerTelemetryWriteQueue");
    expect(source).toContain("maxConcurrent");
    expect(source).toContain("countyFipsInFlight");
    expect(source).toContain("runCrawlerTelemetryMaintenance");
    expect(source).toContain("markCrawlerTelemetryRetrySafe");
    expect(source).toContain("commitAttempted");
    expect(source).toContain("botDailyAggPendingDropped");
    expect(source).not.toContain("void pruneCrawlerRequestEventsIfNeeded()");
    expect(source).not.toContain("void backfillCountyFipsIfNeeded()");
    expect(source).toContain("getBotCrawlAggregateSignals");
    expect(requestActorSource).toContain("OAI-SearchBot");
    expect(requestActorSource).toContain("DuckAssistBot");
    expect(requestActorSource).toContain("Applebot-Extended");
    expect(requestActorSource).toContain("PerplexityBot");
  });

  it("wires crawler request persistence into live request handling", () => {
    const appSource = read("server/app.ts");
    const indexSource = read("server/index.ts");

    expect(appSource).toContain("recordCrawlerRequestEvent(req, res.statusCode, {");
    expect(indexSource).toContain("recordCrawlerRequestEvent(req, res.statusCode, {");
  });

  it("lets LISA read the persisted crawler telemetry layer", () => {
    const source = read("server/services/lisaRuntime.ts");

    expect(source).toContain("ensureCrawlerRequestEventsTable");
    expect(source).toContain("from crawler_request_events");
    expect(source).toContain("from crawler_request_hourly_rollups");
    expect(source).toContain('scopeType: "county"');
    expect(source).toContain("top_crawler=");
  });

  it("exposes crawler telemetry in admin observability", () => {
    const routeSource = read("server/routes/observability.ts");
    const uiSource = read("client/src/pages/admin-observability.tsx");

    expect(routeSource).toContain('observabilityRouter.get("/crawler-telemetry"');
    expect(routeSource).toContain("getCrawlerTelemetrySummary");
    expect(uiSource).toContain('fetch("/api/admin/observability/crawler-telemetry")');
    expect(uiSource).toContain("Crawler Telemetry");
    expect(uiSource).toContain("crawlerTelemetry.topBots.map");
    expect(uiSource).toContain("crawlerTelemetry.topRoutes.map");
    expect(uiSource).toContain("crawlerTelemetry.topSurfaces.map");
    expect(uiSource).toContain("crawlerTelemetry.topCounties.map");
    expect(uiSource).toContain("crawlerTelemetry.hourlyBuckets.map");
  });
});
