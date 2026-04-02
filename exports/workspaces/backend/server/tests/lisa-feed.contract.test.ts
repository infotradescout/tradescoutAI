import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("LISA feed contracts", () => {
  it("keeps the live LISA feed route behind the runtime boundary", () => {
    const source = read("server/routes/observability.ts");

    expect(source).toContain('observabilityRouter.get("/lisa-feed"');
    expect(source).toContain("getLisaFeed");
    expect(source).not.toContain("mock");
    expect(source).not.toContain("stub");
  });

  it("backs the runtime with real telemetry sources", () => {
    const source = read("server/services/lisaRuntime.ts");

    expect(source).toContain("from scout_interactions");
    expect(source).toContain("from objectives");
    expect(source).toContain("from observations");
    expect(source).toContain("from bot_ui_findings");
    expect(source).toContain("from home_scout_listing_events e");
    expect(source).toContain("getHttpMetrics()");
    expect(source).toContain("getBotCrawlAggregateSignals");
    expect(source).toContain('sourceKind: "bot_crawl_signals"');
    expect(source).toContain('"tradescout_local"');
    expect(source).toContain('"json_file"');
    expect(source).toContain('"remote"');
    expect(source).not.toContain("mock");
    expect(source).not.toContain("stub");
  });

  it("persists and reconciles stored findings instead of leaving truth ephemeral", () => {
    const source = read("server/services/lisaFindingsService.ts");

    expect(source).toContain("CREATE TABLE IF NOT EXISTS lisa_findings");
    expect(source).toContain("truth_status = 'superseded'");
    expect(source).toContain("truth_status = 'stale'");
    expect(source).toContain("truth_status = 'current'");
    expect(source).toContain("reconcileLisaFindings");
  });

  it("renders the LISA feed in admin observability", () => {
    const source = read("client/src/pages/admin-observability.tsx");

    expect(source).toContain('fetch("/api/admin/observability/lisa-feed")');
    expect(source).toContain("LISA Live Feed");
    expect(source).toContain("lisaFeed.summary.truthNow");
    expect(source).toContain("lisaFeed.summary.dataProductionSummary");
    expect(source).toContain("lisaFeed.summary.llmOptimizationSummary");
    expect(source).toContain("filteredLisaFeed.map");
    expect(source).toContain("lisaFeed.runtime.mode");
    expect(source).toContain("item.truthStatus");
    expect(source).toContain("Bot crawl");
    expect(source).toContain('"bot_crawl_signals"');
  });
});
