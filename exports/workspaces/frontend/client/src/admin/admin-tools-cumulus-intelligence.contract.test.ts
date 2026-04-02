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

  it("supports manual intelligence and SEO refresh from the admin Cumulus page", () => {
    const source = read("client/src/pages/admin-cumulus-intelligence.tsx");
    expect(source).toContain("/api/admin/cumulus-intelligence/refresh");
    expect(source).toContain("/api/admin/seo-directory-scope/refresh");
    expect(source).toContain("Refresh Intelligence");
    expect(source).toContain("Refresh SEO Scope");
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

  it("renders server-generated delta and state intelligence on the admin Cumulus intelligence page", () => {
    const source = read("client/src/pages/admin-cumulus-intelligence.tsx");
    expect(source).toContain("brief?.summary?.deltaSummary");
    expect(source).toContain("Top States");
    expect(source).toContain("brief.topStates.map");
    expect(source).toContain("No prior brief available yet for delta comparison.");
  });

  it("supports a query-driven presentation mode on the admin Cumulus intelligence page", () => {
    const source = read("client/src/pages/admin-cumulus-intelligence.tsx");
    expect(source).toContain("presentationMode");
    expect(source).toContain("Open Presentation Mode");
    expect(source).toContain("Exit Presentation Mode");
    expect(source).toContain("navigate(`/admin/cumulus-intelligence?${params.toString()}`)");
  });

  it("opens a dedicated partner briefing page from the admin Cumulus intelligence page", () => {
    const source = read("client/src/pages/admin-cumulus-intelligence.tsx");
    expect(source).toContain("/api/admin/cumulus-intelligence/briefing");
    expect(source).toContain("Open Partner Briefing");
    expect(source).toContain("handleOpenBriefingPage");
  });
});
