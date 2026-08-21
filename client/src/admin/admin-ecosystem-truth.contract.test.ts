import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("Admin Ecosystem Truth workspace", () => {
  it("registers one native Super Admin workspace inside Admin OS", () => {
    const tools = read("client/src/admin/adminTools.tsx");
    const navigation = read("client/src/admin/adminNavWorkspaces.ts");
    const surface = read("client/src/admin/AdminToolSurface.tsx");

    expect(tools.match(/id: "ecosystem-truth"/g)).toHaveLength(1);
    expect(tools).toContain('path: "/admin/ecosystem-truth"');
    expect(tools).toContain('visibleIf: { superOnly: true }');
    expect(navigation).toContain('id: "ecosystem-truth"');
    expect(surface).toContain('"ecosystem-truth"');
  });

  it("shows the four read-only operating views and explicit unknown handling", () => {
    const page = read("client/src/pages/admin-ecosystem-truth.tsx");

    expect(page).toContain('apiRequest("GET", "/api/admin/ecosystem-truth")');
    expect(page).toContain("Current owners");
    expect(page).toContain("Decision history");
    expect(page).toContain("Commercial terms");
    expect(page).toContain("Outcome links");
    expect(page).toContain("Read-only operating view");
    expect(page).toContain("Unknown information stays unknown");
    expect(page).toContain("Missing evidence");
    expect(page).toContain("No historical event was manufactured");
    expect(page).not.toContain('apiRequest("POST"');
    expect(page).not.toContain('apiRequest("PUT"');
    expect(page).not.toContain('apiRequest("PATCH"');
    expect(page).not.toContain('apiRequest("DELETE"');
    expect(page).not.toContain("<Card");
  });
});
