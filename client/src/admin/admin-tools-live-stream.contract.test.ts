import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

function toolBlock(source: string, id: string): string {
  const marker = `id: "${id}"`;
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("\n      tool({", start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

describe("Admin OS v2 System Status", () => {
  it("keeps one canonical primary navigation owner", () => {
    const toolsSource = read("client/src/admin/adminTools.tsx");
    const taxonomy = read("client/src/admin/adminNavWorkspaces.ts");
    const liveTool = toolBlock(toolsSource, "live-stream");
    const missionTool = toolBlock(toolsSource, "mission-control");
    const observabilityTool = toolBlock(toolsSource, "observability");
    const aiMonitoringTool = toolBlock(toolsSource, "ai-monitoring");
    const aiFixesTool = toolBlock(toolsSource, "ai-fixes");
    const discoveryTool = toolBlock(toolsSource, "tool-discovery");
    const inspectionTool = toolBlock(toolsSource, "inspection-intelligence");
    const systemPromptTool = toolBlock(toolsSource, "system-prompt");
    const llmTool = toolBlock(toolsSource, "llm-admin");
    const knowledgeTool = toolBlock(toolsSource, "knowledge");

    expect(liveTool).toContain('path: "/admin/live-stream"');
    expect(liveTool).not.toContain("navHidden: true");
    expect(taxonomy).toContain('id: "live-stream"');
    expect(taxonomy).toContain('label: "System Status"');

    for (const block of [
      missionTool,
      observabilityTool,
      aiMonitoringTool,
      aiFixesTool,
      discoveryTool,
      inspectionTool,
      systemPromptTool,
      llmTool,
      knowledgeTool,
    ]) {
      expect(block).toContain("navHidden: true");
    }
  });

  it("uses the native v2 workspace grammar instead of a presentation dashboard", () => {
    const page = read("client/src/pages/admin-live-stream.tsx");
    const surface = read("client/src/admin/AdminToolSurface.tsx");

    expect(surface).toContain('"live-stream"');
    expect(page).toContain("AdminWorkspace");
    expect(page).toContain("AdminSummaryStrip");
    expect(page).toContain("AdminWorkspaceSubnav");
    expect(page).toContain("AdminToolbar");
    expect(page).toContain("AdminList");
    expect(page).toContain('data-testid="admin-system-status-v2"');
    expect(page).toContain("System status");
    expect(page).toContain("Signals");
    expect(page).toContain("Crawler");
    expect(page).toContain("Snapshots");
    expect(page).toContain("Bot Army");
    expect(page).toContain("History");
    expect(page).not.toContain("TradeScout Live Stream");
    expect(page).not.toContain("Presentation Mode");
    expect(page).not.toContain("Executive Briefing");
    expect(page).not.toContain("auto-advances every");
    expect(page).not.toContain("<Card");
  });

  it("preserves live stream read, refresh, export, history, and filters", () => {
    const page = read("client/src/pages/admin-live-stream.tsx");

    expect(page).toContain('/api/admin/observability/live-stream?${liveQueryString}');
    expect(page).toContain('apiRequest("POST", "/api/admin/observability/live-stream/refresh", {})');
    expect(page).toContain('/api/admin/observability/live-stream/export.csv?${liveQueryString}');
    expect(page).toContain('/api/admin/observability/live-stream/history?${historyQueryString}');
    expect(page).toContain("All sources");
    expect(page).toContain("All truth states");
    expect(page).toContain("All states");
    expect(page).toContain("All counties");
    expect(page).toContain("20 signals");
    expect(page).toContain("250 signals");
    expect(page).toContain("Server-produced entries only");
    expect(page).toContain("Degraded sources");
  });

  it("keeps crawler and snapshot sources explicit", () => {
    const page = read("client/src/pages/admin-live-stream.tsx");

    expect(page).toContain("/api/admin/observability/crawler-telemetry");
    expect(page).toContain("/api/admin/observability/snapshot-status");
    expect(page).toContain("Crawler activity");
    expect(page).toContain("Snapshot health");
    expect(page).toContain("Client errors");
    expect(page).toContain("Server errors");
    expect(page).toContain("Top routes");
    expect(page).toContain("Top surfaces");
    expect(page).toContain("Top bots");
    expect(page).toContain("Top counties");
    expect(page).toContain("Scheduler");
    expect(page).toContain("stale after");
    expect(page).toContain("Unavailable");
  });

  it("keeps Bot Army scoring and auto-promotion controls", () => {
    const page = read("client/src/pages/admin-live-stream.tsx");

    expect(page).toContain("/api/admin/mission-control/bot-army/sprint-queue?lookbackHours=6&limit=25");
    expect(page).toContain("/api/admin/mission-control/bot-army/auto-promote/status");
    expect(page).toContain("/api/admin/mission-control/bot-army/auto-promote/trigger");
    expect(page).toContain("Bot Army repair queue");
    expect(page).toContain("Auto-Promote Scheduler");
    expect(page).toContain("Run Auto-Promote Now");
    expect(page).toContain("Observed fact");
    expect(page).toContain("Recommended action");
    expect(page).toContain("Risk if ignored");
    expect(page).toContain("already resolved");
  });

  it("records the Selective Intelligence release boundary", () => {
    const evidence = read(
      ".selective-intelligence/builds/admin-os-v2-system-status/evidence.md"
    );

    expect(evidence).toContain("System observability cannot remain a massive live-stream presentation");
    expect(evidence).toContain("Unavailable feeds display an em dash");
    expect(evidence).toContain("Resolved work is not reopened");
    expect(evidence).toContain("Removed presentation clutter");
    expect(evidence).toContain("does not");
    expect(evidence).toContain("Authenticated desktop and mobile screenshots");
  });
});
