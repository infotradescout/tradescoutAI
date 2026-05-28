import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("review queue audit filters and query controls contracts", () => {
  it("parses and validates review queue query params on tool-blueprints route", () => {
    const source = read("server/routes/admin-tool-discovery.ts");

    expect(source).toContain("function parseToolBlueprintQueueQuery");
    expect(source).toContain("statusParam");
    expect(source).toContain("minRiskScore");
    expect(source).toContain("sortParam");
    expect(source).toContain("limitParam");
    expect(source).toContain("offsetParam");
  });

  it("keeps decided_by as a non-operative client param", () => {
    const source = read("server/routes/admin-tool-discovery.ts");

    expect(source).toContain("decided_by");
    expect(source).toContain("decidedBy");
    expect(source).toContain("Client decided_by/decidedBy is intentionally ignored");
  });

  it("supports bounded filtering and stable sorting in tool discovery DB review queue", () => {
    const source = read("server/scout/toolDiscoveryDB.ts");

    expect(source).toContain("export type ToolBlueprintQueueQuery");
    expect(source).toContain("export async function getToolBlueprintQueue");
    expect(source).toContain("allowedStatuses");
    expect(source).toContain("Math.min(100, Math.max(1");
    expect(source).toContain("desc(toolProposals.riskScore)");
    expect(source).toContain("desc(toolProposals.impactScore)");
    expect(source).toContain("desc(toolProposals.updatedAt)");
    expect(source).toContain("desc(toolProposals.id)");
  });
});
