import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Opportunity Radar source contract", () => {
  it("keeps runtime Scout home moves limited to county_metrics until entity and note contracts are implemented", () => {
    const source = read("server/routes/scout-home-snapshot.ts");
    const moveBuilder = source.slice(
      source.indexOf("async function getCountyOpportunityMoves"),
      source.indexOf("// ── Main route")
    );

    expect(moveBuilder).toContain("countyMetrics");
    expect(moveBuilder).not.toContain("countyEntities");
    expect(moveBuilder).not.toContain("countyNotes");
  });

  it("documents the county_entities and county_notes expansion requirements", () => {
    const contract = read("docs/reference/scout/OPPORTUNITY_RADAR_CONTRACT.md");

    expect(contract).toContain("County Entities Expansion Contract");
    expect(contract).toContain("County Notes Expansion Contract");
    expect(contract).toContain("Trust/CVS exposure");
    expect(contract).toContain("Sanitized projection");
    expect(contract).toContain("county_entities` until the entity expansion contract");
    expect(contract).toContain("county_notes` until sanitized derived note projections");
  });
});
