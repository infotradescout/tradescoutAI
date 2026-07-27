import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("production incident scheduler contracts", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "server/services/crawlerScheduler.ts"),
    "utf8"
  );

  it("stages telemetry maintenance outside the request path and inventories every incident job", () => {
    expect(source).toContain("runCrawlerTelemetryMaintenance");
    expect(source).toContain('CRAWLER_TELEMETRY_MAINTENANCE_SCHEDULE || "7 * * * *"');
    expect(source).toContain("intentAutomation:");
    expect(source).toContain("directConnectFunnelStall:");
    expect(source).toContain("crawlerTelemetryMaintenance:");
    expect(source).toContain("dbConcurrency: getSchedulerDbConcurrencySnapshot()");
  });

  it("does not launch all nightly jobs at the same minute", () => {
    const defaults = [
      '"1 2 * * *"',
      '"9 2 * * *"',
      '"13 2 * * *"',
      '"17 2 * * *"',
      '"21 2 * * *"',
      '"23 2 * * *"',
      '"27 2 * * *"',
      '"31 2 * * *"',
    ];
    for (const schedule of defaults) expect(source).toContain(schedule);
    expect(source.match(/"0 2 \* \* \*"/g) || []).toHaveLength(0);
  });

  it("marks configured HomeScout source errors as job failure", () => {
    expect(source).toContain("HomeScout ingestion failed for configured source(s)");
    expect(source).toContain("(result as any).errors?.length > 0");
  });
});
