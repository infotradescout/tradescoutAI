import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Admin OS v2 platform workspaces", () => {
  it("marks Platform Settings and Platform Controls as native v2 surfaces", () => {
    const surface = read("client/src/admin/AdminToolSurface.tsx");

    expect(surface).toContain('"panel"');
    expect(surface).toContain('"controls"');
  });

  it("rebuilds Platform Settings around the five operating lanes", () => {
    const page = read("client/src/pages/admin-panel.tsx");

    expect(page).toContain("AdminWorkspace");
    expect(page).toContain("AdminSummaryStrip");
    expect(page).toContain("AdminWorkspaceSubnav");
    expect(page).toContain("AdminList");
    expect(page).toContain('data-testid="admin-platform-settings-v2"');
    expect(page).toContain("Site settings");
    expect(page).toContain("Business providers");
    expect(page).toContain("Notifications");
    expect(page).toContain("Advertisements");
    expect(page).toContain("Prizes");
    expect(page).not.toContain("<Card");
    expect(page).not.toContain("AI-powered pricing analysis");
    expect(page).not.toContain("UIMonitoringDashboard");
    expect(page).not.toContain("AICodeFixingDashboard");
    expect(page).not.toContain("FinanceLedgerPanel");
  });

  it("preserves Platform Settings CRUD and notification authority", () => {
    const page = read("client/src/pages/admin-panel.tsx");

    for (const endpoint of [
      "/api/admin/site-settings",
      "/api/admin/business-provider-settings",
      "/api/admin/advertisements",
      "/api/admin/prizes",
    ]) {
      expect(page).toContain(endpoint);
    }
    expect(page).toContain('apiRequest("POST", `/api/admin/${type}`, data)');
    expect(page).toContain('apiRequest("PUT", `/api/admin/${type}/${id}`, data)');
    expect(page).toContain('apiRequest("DELETE", `/api/admin/${type}/${id}`)');
    expect(page).toContain('apiRequest("POST", "/api/admin/test-push-notification", {})');
    expect(page).toContain('apiRequest("POST", "/api/admin/notifications/broadcast"');
    expect(page).toContain('const deliveryMethods = ["in_app"]');
    expect(page).toContain('deliveryMethods.push("email")');
    expect(page).toContain('deliveryMethods.push("push")');
    expect(page).toContain("respect existing preferences and subscriptions");
    expect(page).toContain("This action is permanent");
  });

  it("redirects displaced legacy panel tabs to canonical workspaces", () => {
    const page = read("client/src/pages/admin-panel.tsx");

    expect(page).toContain('heatmap: "/admin/geo/counties"');
    expect(page).toContain('monitoring: "/admin/live-stream"');
    expect(page).toContain('"error-reports": "/admin/errors"');
    expect(page).toContain('"ai-fixes": "/admin/live-stream"');
    expect(page).toContain('pricing: "/admin/pricing"');
    expect(page).toContain('finance: "/admin/finance"');
    expect(page).toContain('authority: "/admin/control"');
    expect(page).toContain('"testing-controls": "/admin/control"');
    expect(page).toContain("navigate(redirect)");
  });

  it("rebuilds Platform Controls around truthful state and rollout readiness", () => {
    const page = read("client/src/pages/admin-control.tsx");

    expect(page).toContain("AdminWorkspace");
    expect(page).toContain("AdminSummaryStrip");
    expect(page).toContain("AdminWorkspaceSubnav");
    expect(page).toContain("AdminList");
    expect(page).toContain('data-testid="admin-platform-controls-v2"');
    expect(page).toContain("Platform control state");
    expect(page).toContain("Rollout readiness");
    expect(page).toContain("Authority governance");
    expect(page).toContain("Testing controls");
    expect(page).toContain("Feature flags");
    expect(page).toContain("Unavailable sources remain unavailable");
    expect(page).not.toContain("<Card");
    expect(page).not.toContain("Feature Exposure Telemetry");
  });

  it("preserves Platform Controls read sources and existing mutation owners", () => {
    const page = read("client/src/pages/admin-control.tsx");

    for (const endpoint of [
      "/api/admin/authority/decision-card-metrics",
      "/api/admin/testing-settings",
      "/api/admin/feature-flags",
      "/api/admin/email/diagnostics",
      "/api/analytics/progressive-exposure/summary",
      "/api/analytics/progressive-exposure/timeline",
    ]) {
      expect(page).toContain(endpoint);
    }

    expect(page).toContain("<AuthorityOperations />");
    expect(page).toContain("<AdminTestingControls />");
    expect(page).toContain("<FeatureTogglePanel />");
    expect(page).not.toContain('apiRequest("POST", "/api/admin/feature-flags"');
    expect(page).not.toContain('apiRequest("PUT", "/api/admin/feature-flags"');
  });

  it("records the Selective Intelligence preservation boundary", () => {
    const evidence = read(
      ".selective-intelligence/builds/admin-os-v2-platform-workspaces/evidence.md"
    );

    expect(evidence).toContain("legacy tab warehouse");
    expect(evidence).toContain("Older tab deep links are preserved");
    expect(evidence).toContain("Unavailable sources remain visibly unavailable");
    expect(evidence).toContain("does not create a second mutation path");
    expect(evidence).toContain("does not");
    expect(evidence).toContain("Authenticated desktop and mobile screenshots");
  });
});
