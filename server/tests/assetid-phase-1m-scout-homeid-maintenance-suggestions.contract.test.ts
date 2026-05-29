import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1m scout homeid maintenance suggestions contracts", () => {
  it("adds rule-based HomeID maintenance evaluator to Scout", () => {
    const source = read("client/src/scout/ScoutOS.tsx");
    expect(source).toContain("function evaluateHomeIdMaintenanceSuggestions");
    expect(source).toContain('"missing_info"');
    expect(source).toContain('"maintenance_check"');
    expect(source).toContain('"evidence_prompt"');
    expect(source).toContain('"request_packet_prompt"');
    expect(source).toContain('"seasonal_basic"');
    expect(source).toContain("Maintenance suggestions");
  });

  it("keeps maintenance suggestions tied to real HomeID persistence/dashboard context", () => {
    const source = read("client/src/scout/ScoutOS.tsx");
    expect(source).toContain('"/api/homeid/persistence"');
    expect(source).toContain('"/api/homes/homeid-dashboard"');
    expect(source).toContain("homeIdContextRail.propertyDetails");
    expect(source).toContain("homeIdContextRail.components");
    expect(source).toContain("homeIdContextRail.evidence");
    expect(source).toContain("homeIdContextRail.requestPackets");
    expect(source).toContain("homeIdContextRail.recentActivity");
  });
});
