import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("Admin OS v2 insight workspaces", () => {
  it("registers onboarding, discovery, and resilience as native surfaces", () => {
    const source = read("client/src/admin/AdminToolSurface.tsx");

    for (const id of [
      '"business-onboarding-telemetry"',
      '"discovery-observatory"',
      '"scout-resilience"',
    ]) {
      expect(source).toContain(id);
    }
  });

  it("keeps business onboarding telemetry on the existing read authority", () => {
    const source = read("client/src/pages/admin-business-onboarding-telemetry.tsx");

    expect(source).toContain('AdminWorkspace data-testid="admin-business-onboarding-v2"');
    expect(source).toContain("/api/admin/business-onboarding/telemetry?days=");
    expect(source).toContain("Module completion");
    expect(source).toContain("Transition velocity");
    expect(source).toContain("Recent transitions");
    expect(source).not.toContain("<Card");
  });

  it("keeps Discovery Observatory evidence boundaries and capture authority", () => {
    const source = read("client/src/pages/admin-discovery-observatory.tsx");

    expect(source).toContain('AdminWorkspace data-testid="admin-discovery-observatory-v2"');
    expect(source).toContain("/api/admin/discovery-observatory?windowDays=");
    expect(source).toContain('"POST", "/api/admin/discovery-observatory/observations"');
    expect(source).toContain("Unknown evidence stays visible");
    expect(source).toContain("without assigning causal credit");
    expect(source).toContain("Evidence Chain");
    expect(source).toContain("Operating Gaps");
    expect(source).toContain("Queries & Surfaces");
    expect(source).toContain("Proposed controlled tests only");
    expect(source).not.toContain("<Card");
  });

  it("keeps Scout resilience super-admin-only and on the existing diagnostics", () => {
    const source = read("client/src/pages/admin-scout-resilience.tsx");

    expect(source).toContain('AdminWorkspace data-testid="admin-scout-resilience-v2"');
    expect(source).toContain('"/api/scout/admin/system-status"');
    expect(source).toContain('"/api/scout/admin/analytics"');
    expect(source).toContain("enabled: isSuperAdmin");
    expect(source).toContain("refetchInterval: 15_000");
    expect(source).toContain("Super Admin access required");
    expect(source).toContain("Fallback reasons");
    expect(source).toContain("Service components");
    expect(source).not.toContain("<Card");
  });

  it("does not add new write paths to read-only onboarding or resilience surfaces", () => {
    const onboarding = read("client/src/pages/admin-business-onboarding-telemetry.tsx");
    const resilience = read("client/src/pages/admin-scout-resilience.tsx");

    expect(onboarding).not.toContain('apiRequest("POST"');
    expect(onboarding).not.toContain('apiRequest("PUT"');
    expect(onboarding).not.toContain('apiRequest("DELETE"');
    expect(resilience).not.toContain('method: "POST"');
    expect(resilience).not.toContain('method: "PUT"');
    expect(resilience).not.toContain('method: "DELETE"');
  });
});
