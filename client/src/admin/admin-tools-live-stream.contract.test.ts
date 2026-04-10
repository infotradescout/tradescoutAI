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

  it("keeps observability as a legacy redirect into telemetry center", () => {
    const source = read("client/src/admin/adminTools.tsx");
    expect(source).toContain('id: "observability"');
    expect(source).toContain('path: "/admin/observability"');
    expect(source).toContain("navHidden: true");
    expect(source).toContain('render: () => <RedirectTool to="/admin/live-stream" />');
  });

  it("keeps AI and telemetry-adjacent legacy tabs redirected into telemetry center", () => {
    const source = read("client/src/admin/adminTools.tsx");
    const legacyRedirects = [
      'id: "ai-monitoring"',
      'path: "/admin/ai-monitoring"',
      'id: "ai-fixes"',
      'path: "/admin/ai-fixes"',
      'id: "scout-resilience"',
      'path: "/admin/scout-resilience"',
      'id: "tool-discovery"',
      'path: "/admin/tool-discovery"',
      'id: "inspection-intelligence"',
      'path: "/admin/inspection-intelligence"',
      'id: "system-prompt"',
      'path: "/admin/system-prompt"',
      'id: "llm-admin"',
      'path: "/admin/llm"',
      'id: "knowledge"',
      'path: "/admin/knowledge"',
    ];

    for (const marker of legacyRedirects) {
      expect(source).toContain(marker);
    }
    expect(source).toContain('render: () => <RedirectTool to="/admin/live-stream" />');
  });

  it("keeps AI Camera Lab active as a dedicated admin tab", () => {
    const source = read("client/src/admin/adminTools.tsx");
    expect(source).toContain('id: "ai-camera-lab"');
    expect(source).toContain('label: "AI Camera Lab"');
    expect(source).toContain('path: "/admin/ai-camera-lab"');
    expect(source).toContain('render: () => <RedirectTool to="/zero-base-fee/camera" />');
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
    expect(source).toContain("all sources");
    expect(source).toContain("all or FL");
    expect(source).toContain("all or mobile");
    expect(source).toContain("presentationMode");
    expect(source).toContain("Open Presentation Mode");
    expect(source).toContain("Refresh Live Stream");
    expect(source).toContain("Export CSV");
    expect(source).toContain("Active Alerts");
    expect(source).toContain("Bot Crawl Signals");
    expect(source).toContain("bot_crawl_signals");
    expect(source).toContain("sourceCounts");
    expect(source).toContain("live entries");
  });
});
