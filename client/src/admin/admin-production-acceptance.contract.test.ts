import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("Admin production acceptance workspace", () => {
  it("registers one canonical, discoverable tool and keeps the old route as a hidden redirect", () => {
    const tools = read("client/src/admin/adminTools.tsx");
    const navigation = read("client/src/admin/adminNavWorkspaces.ts");
    const layout = read("client/src/admin/SuperAdminOSLayout.tsx");

    expect(tools.match(/id: "production-acceptance"/g)).toHaveLength(1);
    expect(tools).toContain('path: "/admin/production-acceptance"');
    expect(tools).toContain("visibleIf: { superOnly: true }");
    expect(tools).toContain('id: "legacy-production-acceptance"');
    expect(tools).toContain('<RedirectTool to="/admin/production-acceptance" />');
    expect(navigation).toContain('id: "production-acceptance"');
    expect(layout).not.toContain("PRODUCTION_ACCEPTANCE_TOOL");
  });

  it("routes production acceptance through the canonical Admin tool registry", () => {
    const shell = read("client/src/pages/admin.tsx");
    expect(shell).toContain("resolveAdminToolByLocation(pathname, role, isSuperAdmin)");
    expect(shell).not.toContain('pathname === "/admin/production-acceptance"');
  });

  it("reads the authenticated production report and renders all classifications", () => {
    const source = read("client/src/pages/admin-production-acceptance.tsx");
    expect(source).toContain('apiRequest("GET", "/api/admin/production-acceptance")');
    expect(source).toMatch(
      /apiRequest\(\s*"POST",\s*"\/api\/admin\/production-acceptance\/write-canary",\s*\{\}\s*\)/
    );
    expect(source).toContain("Refresh read-only report");
    expect(source).toContain("Run write canary");
    expect(source).toContain("window.confirm");
    expect(source).toContain("Working");
    expect(source).toContain("Genuinely empty");
    expect(source).toContain("Unavailable");
    expect(source).toContain("Blocked");
    expect(source).toContain("Controlled write canary");
    expect(source).toContain("Open workspace");
    expect(source).toMatch(
      /value:\s*reportReady\s*\?\s*\(?report\?\.summary\.working\s*\?\?\s*0\)?\s*:\s*"—"/
    );
    expect(source).toMatch(
      /detail:\s*reportReady\s*\?\s*"Sources and operating rules passed"\s*:\s*"Checking sources"/
    );
  });

  it("forces overall attention only after a write canary fails", () => {
    const source = read("client/src/pages/admin-production-acceptance.tsx");
    expect(source).toContain("const writeCanaryNeedsAttention =");
    expect(source).toContain('report?.controlledWriteCanary.status === "failed"');
    expect(source).toContain("writeCanaryMutation.isError");
    expect(source).toContain("!writeCanaryNeedsAttention");
    expect(source).toContain("Controlled write canary failed");
    expect(source).not.toContain('controlledWriteCanary.status === "not_run" ||');
  });
});
