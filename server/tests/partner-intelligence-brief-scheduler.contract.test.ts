import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("partner intelligence brief scheduler wiring", () => {
  it("starts the partner intelligence brief snapshot job from the crawler scheduler", () => {
    const source = read("server/services/crawlerScheduler.ts");
    expect(source).toContain("runPartnerIntelligenceBriefSnapshotJob");
    expect(source).toContain("startPartnerIntelligenceBriefSnapshotsScheduler()");
    expect(source).toContain("partnerIntelligenceBriefSnapshotsTask");
    expect(source).toContain("PARTNER_INTELLIGENCE_BRIEF_SNAPSHOTS_SCHEDULE");
  });

  it("persists brief history alongside the current brief snapshot", () => {
    const source = read("server/services/partnerIntelligenceBriefSnapshotService.ts");
    expect(source).toContain("tradepartner_intelligence_brief_history");
    expect(source).toContain("getPartnerIntelligenceBriefHistory");
    expect(source).toContain("insert into tradepartner_intelligence_brief_history");
  });

  it("prunes old brief history using a retention policy", () => {
    const source = read("server/services/partnerIntelligenceBriefSnapshotService.ts");
    expect(source).toContain("PARTNER_INTELLIGENCE_BRIEF_HISTORY_RETENTION_DAYS");
    expect(source).toContain("prunePartnerIntelligenceBriefHistoryIfNeeded");
    expect(source).toContain("delete from tradepartner_intelligence_brief_history");
  });
});
