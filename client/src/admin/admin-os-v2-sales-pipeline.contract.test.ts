import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("Admin OS v2 Sales Pipeline", () => {
  it("registers CRM as a native Admin OS surface", () => {
    const source = read("client/src/admin/AdminToolSurface.tsx");
    expect(source).toContain('"crm"');
  });

  it("uses one native workspace for contacts, deals, and activity", () => {
    const source = read("client/src/pages/CrmDashboard.tsx");

    expect(source).toContain('AdminWorkspace data-testid="admin-sales-pipeline-v2"');
    expect(source).toContain("Contact registry");
    expect(source).toContain("Opportunity pipeline");
    expect(source).toContain("Relationship activity");
    expect(source).not.toContain("CRM Dashboard");
    expect(source).not.toContain("<Card");
  });

  it("preserves the existing CRM read authority", () => {
    const source = read("client/src/pages/CrmDashboard.tsx");

    expect(source).toContain('apiRequest("GET", "/api/crm/contacts")');
    expect(source).toContain('apiRequest("GET", "/api/crm/deals")');
    expect(source).toContain('apiRequest("GET", "/api/crm/activities")');
  });

  it("preserves contact, deal, and activity creation", () => {
    const source = read("client/src/pages/CrmDashboard.tsx");

    expect(source).toContain('apiRequest("POST", "/api/crm/contacts"');
    expect(source).toContain('apiRequest("POST", "/api/crm/deals"');
    expect(source).toContain('apiRequest("POST", "/api/crm/activities"');
    expect(source).toContain("Create contact");
    expect(source).toContain("Create deal");
    expect(source).toContain("Log activity");
  });

  it("uses existing update routes for contact status and deal stage", () => {
    const source = read("client/src/pages/CrmDashboard.tsx");

    expect(source).toContain("/api/crm/contacts/${contactId}");
    expect(source).toContain("/api/crm/deals/${dealId}");
    expect(source).toContain("Save contact status");
    expect(source).toContain("Save deal stage");
    expect(source).toContain('apiRequest("PUT"');
  });

  it("keeps CRM server authority restricted to operations and Super Admin", () => {
    const routes = read("server/crm-routes.ts");
    expect(routes).toContain('requireRole(["ops_admin", "super_admin"])');
    expect(routes).toContain("every\n// route is restricted to ops/super admin");
  });

  it("does not add client-side contact or deal deletion", () => {
    const source = read("client/src/pages/CrmDashboard.tsx");
    expect(source).not.toContain('apiRequest("DELETE"');
  });
});
