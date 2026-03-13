import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("admin tools cumulus intelligence wiring", () => {
  it("registers the admin-only Cumulus intelligence route", () => {
    const source = read("client/src/admin/adminTools.tsx");
    expect(source).toContain('id: "cumulus-intelligence"');
    expect(source).toContain('path: "/admin/cumulus-intelligence"');
    expect(source).toContain("AdminCumulusIntelligence");
  });

  it("keeps CSV export on the admin Cumulus intelligence page", () => {
    const source = read("client/src/pages/admin-cumulus-intelligence.tsx");
    expect(source).toContain("/api/admin/cumulus-intelligence/export.csv");
    expect(source).toContain("Export CSV");
    expect(source).toContain("handleExport");
  });

  it("renders the server-generated executive brief on the admin Cumulus intelligence page", () => {
    const source = read("client/src/pages/admin-cumulus-intelligence.tsx");
    expect(source).toContain("/api/admin/cumulus-intelligence/brief");
    expect(source).toContain("Executive Brief");
    expect(source).toContain("Truth Now");
  });

  it("keeps print and history support on the admin Cumulus intelligence page", () => {
    const source = read("client/src/pages/admin-cumulus-intelligence.tsx");
    expect(source).toContain("/api/admin/cumulus-intelligence/brief-history");
    expect(source).toContain("Print Brief");
    expect(source).toContain("Brief History");
    expect(source).toContain("window.print()");
  });

  it("shows a latest-vs-previous delta summary on the admin Cumulus intelligence page", () => {
    const source = read("client/src/pages/admin-cumulus-intelligence.tsx");
    expect(source).toContain("previousBrief");
    expect(source).toContain("deltaSummary");
    expect(source).toContain("surfaceDelta");
    expect(source).toContain("No prior brief available yet for delta comparison.");
  });

  it("supports a query-driven meeting mode on the admin Cumulus intelligence page", () => {
    const source = read("client/src/pages/admin-cumulus-intelligence.tsx");
    expect(source).toContain("meetingMode");
    expect(source).toContain("Open Meeting Mode");
    expect(source).toContain("Exit Meeting Mode");
    expect(source).toContain("navigate(`/admin/cumulus-intelligence?${params.toString()}`)");
  });
});
