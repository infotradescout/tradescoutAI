import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("snapshot status contracts", () => {
  it("exposes the snapshot status route in admin observability", () => {
    const source = read("server/routes/observability.ts");
    const statusService = read("server/services/snapshotStatusService.ts");
    expect(source).toContain('observabilityRouter.get("/snapshot-status"');
    expect(source).toContain('observabilityRouter.post("/homescout-price-snapshots/refresh"');
    expect(source).toContain('observabilityRouter.post("/tradedeals-price-snapshots/refresh"');
    expect(source).toContain('observabilityRouter.post("/completed-job-price-snapshots/refresh"');
    expect(source).toContain("getSnapshotStatusSummary");
    expect(source).toContain("runHomeScoutMarketMetricsJob");
    expect(source).toContain("runTradeDealsAggregationJob");
    expect(source).toContain("runCompletedJobPriceSnapshotJob");
    expect(source).toContain("withAdvisoryLock");
    expect(source).toContain("Failed to refresh HomeScout price snapshots");
    expect(source).toContain("Failed to refresh TradeDeals price snapshots");
    expect(source).toContain("Failed to refresh completed job price snapshots");
    expect(source).toContain("Failed to fetch snapshot status");
    expect(statusService).toContain("COUNTY_PRICE_SIGNAL_FAMILIES");
    expect(statusService).toContain("queryCountyPriceSignalStatus");
    expect(statusService).toContain("from county_metrics");
    expect(statusService).toContain("MetricKey.HOMESCOUT_MEDIAN_PRICE");
    expect(statusService).toContain("MetricKey.TRADEDEALS_ACTIVE");
    expect(statusService).toContain("MetricKey.COMPLETED_JOBS_30D");
    expect(statusService).toContain("staleCountyCount");
  });

  it("renders snapshot status in admin observability", () => {
    const source = read("client/src/pages/admin-observability.tsx");
    expect(source).toContain('fetch("/api/admin/observability/snapshot-status")');
    expect(source).toContain("Snapshot Status");
    expect(source).toContain("snapshotStatus.schedulerEnabled");
    expect(source).toContain("snapshotStatus.statuses.map");
    expect(source).toContain("Stale after");
    expect(source).toContain("counties tracked");
    expect(source).toContain("item.metricKeys.map");
    expect(source).toContain("Refresh Snapshot");
    expect(source).toContain("Refresh via source job");
    expect(source).toContain("snapshotRefreshEndpoint");
    expect(source).toContain("/api/admin/cumulus-intelligence/refresh");
    expect(source).toContain("/api/admin/seo-directory-scope/refresh");
    expect(source).toContain("/api/admin/observability/live-stream/refresh");
    expect(source).toContain("/api/admin/observability/homescout-price-snapshots/refresh");
    expect(source).toContain("/api/admin/observability/tradedeals-price-snapshots/refresh");
    expect(source).toContain("/api/admin/observability/completed-job-price-snapshots/refresh");
    expect(source).toContain("county_price_homescout");
    expect(source).toContain("county_price_tradedeals");
    expect(source).toContain("county_price_completed_jobs");
    expect(source).toContain("Background scheduler is disabled");
  });
});
