import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

const readDirectConnectRouteSources = () =>
  [
    read("server/routes/direct-connect.ts"),
    read("server/routes/direct-connect/job-lifecycle.ts"),
    read("server/routes/direct-connect/completion.ts"),
  ].join("\n");

describe("assetid phase 1h direct connect jobflow -> homeid timeline contracts", () => {
  it("defines a HomeID timeline bridge helper with direct connect source metadata", () => {
    const source = readDirectConnectRouteSources();
    expect(source).toContain("async function appendHomeIdTimelineEventFromDirectConnect");
    expect(source).toContain('source: "direct_connect_jobflow"');
    expect(source).toContain("title: `homeid:timeline:${params.eventType}`");
  });

  it("emits timeline events for submit and major jobflow lifecycle transitions", () => {
    const source = readDirectConnectRouteSources();
    expect(source).toContain('eventType: "direct_connect_request_submitted"');
    expect(source).toContain('eventType: "direct_connect_estimate_sent"');
    expect(source).toContain('eventType: "direct_connect_estimate_accepted"');
    expect(source).toContain('eventType: "direct_connect_scheduled"');
    expect(source).toContain('eventType: "direct_connect_work_started"');
    expect(source).toContain('eventType: "direct_connect_change_order_created"');
    expect(source).toContain('eventType: "direct_connect_completed"');
    expect(source).toContain('eventType: "direct_connect_cancelled"');
  });

  it("preserves request and packet/detail linkage fields in timeline payload", () => {
    const source = readDirectConnectRouteSources();
    expect(source).toContain("directConnectRequestId: params.requestId");
    expect(source).toContain("homePacketId: context.homePacketId || null");
    expect(source).toContain("selectedDetailIds: context.selectedDetailIds");
    expect(source).toContain("componentType: context.componentType || null");
    expect(source).toContain("componentLabel: context.componentLabel || null");
  });
});
