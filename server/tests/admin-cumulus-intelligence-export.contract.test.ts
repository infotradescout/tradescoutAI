import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("admin cumulus intelligence export wiring", () => {
  it("registers an admin-only executive brief route backed by stored snapshots and LISA", () => {
    const source = read("server/routes/admin.ts");
    expect(source).toContain('"/api/admin/cumulus-intelligence/brief"');
    expect(source).toContain("getPartnerIntelligenceBriefSnapshot");
    expect(source).toContain("Failed to build Cumulus intelligence brief");
  });

  it("registers an admin-only brief history route", () => {
    const source = read("server/routes/admin.ts");
    expect(source).toContain('"/api/admin/cumulus-intelligence/brief-history"');
    expect(source).toContain("getPartnerIntelligenceBriefHistory");
    expect(source).toContain("Failed to load Cumulus intelligence brief history");
  });

  it("registers an admin-only CSV export route backed by stored partner snapshots", () => {
    const source = read("server/routes/admin.ts");
    expect(source).toContain('"/api/admin/cumulus-intelligence/export.csv"');
    expect(source).toContain("getPartnerCountyObservationSnapshots");
    expect(source).toContain('partnerSlug: "cumulus-media"');
    expect(source).toContain('Content-Type", "text/csv; charset=utf-8"');
    expect(source).toContain("Failed to export Cumulus intelligence");
  });
});
