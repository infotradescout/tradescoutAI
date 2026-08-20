import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("Admin production acceptance workspace", () => {
  it("registers both production acceptance routes before unknown-route handling", () => {
    const source = read("client/src/pages/admin.tsx");
    expect(source).toContain('pathname === "/admin/acceptance"');
    expect(source).toContain('pathname === "/admin/production-acceptance"');
    expect(source.indexOf('/admin/acceptance')).toBeLessThan(
      source.indexOf("resolveAdminToolByLocation")
    );
    expect(source).toContain("<AdminProductionAcceptance />");
  });

  it("gives the route a real Admin OS page identity", () => {
    const source = read("client/src/admin/SuperAdminOSLayout.tsx");
    expect(source).toContain('id: "production-acceptance"');
    expect(source).toContain('label: "Production Acceptance"');
    expect(source).toContain('activeItem?.id === "production-acceptance"');
  });

  it("reads the authenticated production report and renders all classifications", () => {
    const source = read("client/src/pages/admin-production-acceptance.tsx");
    expect(source).toContain('apiRequest("GET", "/api/admin/production-acceptance")');
    expect(source).toContain("Working");
    expect(source).toContain("Genuinely empty");
    expect(source).toContain("Unavailable");
    expect(source).toContain("Blocked");
    expect(source).toContain("Controlled write canary");
    expect(source).toContain("Open workspace");
  });
});
