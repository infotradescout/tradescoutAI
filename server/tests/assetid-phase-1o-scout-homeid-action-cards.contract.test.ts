import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1o scout homeid action cards contracts", () => {
  it("adds a HomeID action card builder with scoped action types", () => {
    const source = read("client/src/scout/ScoutOS.tsx");
    expect(source).toContain("type HomeIdActionCardType");
    expect(source).toContain("function buildHomeIdActionCards");
    expect(source).toContain('"add_missing_fact"');
    expect(source).toContain('"review_component"');
    expect(source).toContain('"attach_evidence"');
    expect(source).toContain('"create_request_packet"');
    expect(source).toContain('"resume_request_packet"');
    expect(source).toContain('"view_homeid"');
    expect(source).toContain('"view_component"');
  });

  it("derives action cards from real HomeID context, maintenance suggestions, and local signals", () => {
    const source = read("client/src/scout/ScoutOS.tsx");
    expect(source).toContain("homeIdContextRail.components");
    expect(source).toContain("homeIdContextRail.requestPackets");
    expect(source).toContain("homeIdMaintenanceSuggestions");
    expect(source).toContain("homeIdSimilarLocalSignals");
    expect(source).toContain("HomeID action cards");
  });
});
