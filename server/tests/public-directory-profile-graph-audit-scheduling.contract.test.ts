import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public directory profile graph audit scheduling", () => {
  it("runs once after production startup without depending on IndexNow", () => {
    const service = read("server/services/indexNowService.ts");

    expect(service).toContain("schedulePublicDirectoryProfileGraphAudit");
    expect(service).toContain("directoryGraphAuditScheduled");
    expect(service).toContain('process.env.NODE_ENV !== "production"');
    expect(service).toContain("PUBLIC_DIRECTORY_PROFILE_GRAPH_AUDIT_DISABLED");
    expect(service).toContain("PUBLIC_DIRECTORY_PROFILE_GRAPH_AUDIT_DELAY_MS");
    expect(service).toContain('import("./publicDirectoryProfileGraphAudit")');
    expect(service).toContain("runPublicDirectoryProfileGraphAudit");
    expect(service).toContain("timer.unref?.()");
    expect(service).toContain("schedulePublicDirectoryProfileGraphAudit();");
  });

  it("keeps evidence semantics separate from indexing and ranking", () => {
    const audit = read("server/services/publicDirectoryProfileGraphAudit.ts");

    expect(audit).toContain('"production_verified" | "production_failed" | "unavailable"');
    expect(audit).toContain("Directory graph verification proves deployed HTTP and initial HTML links only");
    expect(audit).toContain("It is not proof of indexing, ranking, traffic, requests");
    expect(audit).toContain("ts_seo_trade_county_pages");
    expect(audit).toContain("buildPublicDirectoryProfileDiscoveries");
    expect(audit).toContain("deriveTradeSlugFromProfileData");
  });
});
