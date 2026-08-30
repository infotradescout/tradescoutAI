import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1i completed work enrichment contracts", () => {
  it("defines a completed-work enrichment helper for HomeID-linked direct connect requests", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("async function appendHomeIdCompletedWorkEnrichmentFromDirectConnect");
    expect(source).toContain('title: "homeid:completed_work_enrichment"');
    expect(source).toContain('source: "direct_connect_completed_work"');
  });

  it("preserves HomeID and request linkage in completed-work enrichment payload", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("directConnectRequestId: params.requestId");
    expect(source).toContain("homePacketId: context.homePacketId || null");
    expect(source).toContain("selectedDetailIds: context.selectedDetailIds");
    expect(source).toContain("componentType: context.componentType || null");
    expect(source).toContain("componentLabel: context.componentLabel || null");
    expect(source).toContain("completedAt");
    expect(source).toContain("workSummary");
  });

  it("writes completed-work enrichment on direct connect completion paths", () => {
    const source = read("server/routes/direct-connect/completion.ts");
    expect(source).toContain(
      "await callbacks.appendHomeIdCompletedWorkEnrichmentFromDirectConnect({"
    );
    expect(source).toContain('eventType: "direct_connect_completed"');
  });
});
