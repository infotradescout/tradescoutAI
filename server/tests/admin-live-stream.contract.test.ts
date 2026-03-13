import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("admin live stream contracts", () => {
  it("registers the unified admin live stream endpoint", () => {
    const source = read("server/routes/observability.ts");
    expect(source).toContain('observabilityRouter.get("/live-stream"');
    expect(source).toContain('observabilityRouter.get("/live-stream/history"');
    expect(source).toContain('observabilityRouter.post("/live-stream/refresh"');
    expect(source).toContain('observabilityRouter.get("/live-stream/export.csv"');
    expect(source).toContain("getLiveStreamSnapshot");
    expect(source).toContain("getLiveStreamSnapshotHistory");
    expect(source).toContain("refreshLiveStreamSnapshot");
    expect(source).toContain('Content-Type", "text/csv; charset=utf-8"');
    expect(source).toContain('Content-Disposition", `attachment; filename="${suffix}.csv"`');
    expect(source).toContain('String((req.query as any)?.source || "")');
    expect(source).toContain('String((req.query as any)?.stateCode || "")');
    expect(source).toContain('String((req.query as any)?.county || "")');
    expect(source).toContain("limit");
    expect(source).toContain("Failed to fetch live stream");
    expect(source).toContain("Failed to refresh live stream");
    expect(source).toContain("Failed to export live stream");
  });
});
