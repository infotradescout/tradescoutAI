import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("assetid phase 1l scout homeid context rail contracts", () => {
  it("adds HomeID context rail to Scout using authenticated HomeID data routes", () => {
    const source = read("client/src/scout/ScoutOS.tsx");
    expect(source).toContain("HomeID context");
    expect(source).toContain('"/api/homes"');
    expect(source).toContain('"/api/homeid/persistence"');
    expect(source).toContain('"/api/homes/homeid-dashboard"');
    expect(source).toContain("knownPropertyDetailCount");
    expect(source).toContain("componentCount");
    expect(source).toContain("evidenceCount");
    expect(source).toContain("openRequestPacketCount");
    expect(source).toContain("missingCriticalInfoCount");
    expect(source).toContain("recentActivity");
  });

  it("keeps a non-blocking no-HomeID state with start path", () => {
    const source = read("client/src/scout/ScoutOS.tsx");
    expect(source).toContain("Start HomeID");
    expect(source).toContain('onClick={() => navigate("/homes")}');
    expect(source).toContain("homeIdContextRail.hasHomeId ? (");
  });
});
