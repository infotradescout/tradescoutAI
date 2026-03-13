import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("admin tools live stream wiring", () => {
  it("registers the admin live stream route", () => {
    const source = read("client/src/admin/adminTools.tsx");
    expect(source).toContain('id: "live-stream"');
    expect(source).toContain('path: "/admin/live-stream"');
    expect(source).toContain("AdminLiveStream");
  });

  it("renders the unified admin live stream page from the server route", () => {
    const source = read("client/src/pages/admin-live-stream.tsx");
    expect(source).toContain("/api/admin/observability/live-stream");
    expect(source).toContain("/api/admin/observability/live-stream/refresh");
    expect(source).toContain("/api/admin/observability/live-stream/export.csv");
    expect(source).toContain("TradeScout Live Stream");
    expect(source).toContain("Server-produced entries only");
    expect(source).toContain("/api/admin/observability/live-stream/history");
    expect(source).toContain("Stream History");
    expect(source).toContain("All sources");
    expect(source).toContain("all or FL");
    expect(source).toContain("all or mobile");
    expect(source).toContain("presentationMode");
    expect(source).toContain("Open Presentation Mode");
    expect(source).toContain("Refresh Live Stream");
    expect(source).toContain("Export CSV");
    expect(source).toContain("Active Alerts");
  });
});
