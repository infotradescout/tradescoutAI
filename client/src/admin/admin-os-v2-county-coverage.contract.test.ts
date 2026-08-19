import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("Admin OS v2 county coverage", () => {
  it("registers County Coverage as a native Admin OS surface", () => {
    const source = read("client/src/admin/AdminToolSurface.tsx");
    expect(source).toContain('"geo-map"');
  });

  it("uses the native workspace instead of the legacy card and table shell", () => {
    const source = read("client/src/pages/admin-geo-coverage.tsx");

    expect(source).toContain('AdminWorkspace data-testid="admin-county-coverage-v2"');
    expect(source).toContain("AdminSummaryStrip");
    expect(source).toContain("AdminWorkspaceSubnav");
    expect(source).toContain("AdminToolbar");
    expect(source).toContain("Coverage List");
    expect(source).toContain("County Map & Folder");
    expect(source).toContain('data-testid="county-operating-folder"');
    expect(source).not.toContain("<Card");
    expect(source).not.toContain("<table");
  });

  it("preserves county read and seed authority", () => {
    const source = read("client/src/pages/admin-geo-coverage.tsx");

    expect(source).toContain('"GET", "/api/admin/geo/coverage"');
    expect(source).toContain("/api/admin/geo/counties/${selectedCountyFips}/folder");
    expect(source).toContain('"POST", "/api/admin/geo/seed-counties"');
    expect(source).toContain('"GET", "/api/admin/users"');
  });

  it("preserves audited geographic assignment paths and entity types", () => {
    const source = read("client/src/pages/admin-geo-coverage.tsx");

    expect(source).toContain("/api/admin/geo/counties/${countyFips}/entities");
    expect(source).toContain('entityType: "territory_manager"');
    expect(source).toContain('type AffiliateEntityType = "affiliate" | "partner"');
    expect(source).toContain('status: "active"');
    expect(source).toContain("Assign territory manager");
    expect(source).toContain("Assign affiliate / partner");
  });

  it("keeps the map optional and the county folder complete", () => {
    const source = read("client/src/pages/admin-geo-coverage.tsx");

    expect(source).toContain("/api/public-config");
    expect(source).toContain("maps.googleapis.com/maps/api/js");
    expect(source).toContain("Coverage entities");
    expect(source).toContain("County notes");
    expect(source).toContain("On-site dates");
    expect(source).toContain("RSVP tracker");
    expect(source).toContain("Interest submissions");
    expect(source).toContain("Google Maps coverage view");
  });

  it("keeps full coverage tied to both required coverage sides", () => {
    const source = read("client/src/pages/admin-geo-coverage.tsx");

    expect(source).toContain(
      "Full coverage requires an active territory manager and an active affiliate or partner"
    );
    expect(source).toContain("Only one required coverage side is present");
    expect(source).toContain("No active territory manager or affiliate");
  });
});
