import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

describe("Admin OS v2 foundation", () => {
  it("uses one full workbench shell instead of nested dashboard cards", () => {
    const layout = read("client/src/admin/SuperAdminOSLayout.tsx");
    const workspace = read("client/src/admin/AdminWorkspace.tsx");

    expect(layout).toContain("getAdminNavWorkspacesForRole");
    expect(layout).toContain("getAdminToolPresentation");
    expect(layout).toContain('lg:grid-cols-[16.5rem_minmax(0,1fr)]');
    expect(layout).toContain('lg:grid-cols-[4.75rem_minmax(0,1fr)]');
    expect(layout).toContain("<AdminHeader");
    expect(layout).toContain("<SuperAdminLeftNav");
    expect(layout).toContain('window.addEventListener("keydown", handleShortcut)');
    expect(layout).toContain('new Event("admin:focus-tool-search")');
    expect(layout).toContain("setRailCollapsed(false)");
    expect(layout).not.toContain("ts-admin-mobile-nav");
    expect(layout).not.toContain("admin:ui:density");
    expect(layout).not.toContain("max-w-[1560px]");
    expect(layout).not.toContain("onToggleDensity");

    expect(workspace).toContain("export function AdminWorkspace");
    expect(workspace).toContain("export function AdminWorkspaceSubnav");
    expect(workspace).toContain("export function AdminSection");
    expect(workspace).toContain("export function AdminSummaryStrip");
    expect(workspace).toContain("export function AdminToolbar");
    expect(workspace).toContain("export function AdminList");
    expect(workspace).toContain("export function AdminEmptyState");
    expect(workspace).toContain("HTMLAttributes<HTMLDivElement>");
  });

  it("uses an integrated toolbar with one title and one global tool search", () => {
    const header = read("client/src/admin/AdminHeader.tsx");

    expect(header).toContain("currentSection");
    expect(header).toContain("Find tool");
    expect(header).toContain("System status");
    expect(header).toContain("onFindTool");
    expect(header).not.toContain("Telemetry Center");
    expect(header).not.toContain("Compact");
    expect(header).not.toContain("Comfort");
    expect(header).not.toContain("Admin OS");
    expect(header).not.toContain("ts-admin-pill");
  });

  it("reduces the left side to a searchable workspace rail", () => {
    const nav = read("client/src/admin/SuperAdminLeftNav.tsx");

    expect(nav).toContain("TradeScout Admin");
    expect(nav).toContain("Find an admin tool");
    expect(nav).toContain("admin:focus-tool-search");
    expect(nav).toContain("Collapse navigation");
    expect(nav).toContain("bg-orange-500/12");
    expect(nav).not.toContain("Admin navigation");
    expect(nav).not.toContain("Expand all");
    expect(nav).not.toContain("Collapse all");
    expect(nav).not.toContain("tools available");
    expect(nav).not.toContain("sections.length");
  });

  it("organizes every primary tool by operator outcome rather than implementation name", () => {
    const taxonomy = read("client/src/admin/adminNavWorkspaces.ts");

    for (const workspace of [
      "Inbox & Requests",
      "People & Trust",
      "Partners & Market",
      "Coverage & Intelligence",
      "Platform",
      "Finance",
    ]) {
      expect(taxonomy).toContain(`section: "${workspace}"`);
    }

    for (const toolId of [
      "overview",
      "direct-connect-requests",
      "commercial-directory",
      "procurement",
      "users",
      "verification",
      "business-verifications",
      "moderation",
      "business-directory-ops",
      "tradepartner-ops",
      "listings",
      "crm",
      "geo-map",
      "business-onboarding-telemetry",
      "discovery-observatory",
      "live-stream",
      "scout-resilience",
      "errors",
      "panel",
      "controls",
      "finance",
    ]) {
      expect(taxonomy).toContain(`id: "${toolId}"`);
    }

    expect(taxonomy).toContain('label: "Partner Operations"');
    expect(taxonomy).toContain('label: "Requests"');
    expect(taxonomy).toContain('label: "Address & Identity"');
    expect(taxonomy).toContain('label: "Marketplace Listings"');
    expect(taxonomy).toContain('label: "System Status"');
    expect(taxonomy).toContain('label: "Platform Settings"');
    expect(taxonomy).toContain('section: "More"');
  });

  it("makes Admin Home an action inbox rather than another tool catalog", () => {
    const home = read("client/src/admin/AdminHome.tsx");

    expect(home).toContain("getAdminNavWorkspacesForRole");
    expect(home).toContain("Operator inbox");
    expect(home).toContain("Needs action");
    expect(home).toContain("Platform state");
    expect(home).toContain("Common workspaces");
    expect(home).toContain("No synthetic urgency is added here");
    expect(home).toContain("No unread admin queues");
    expect(home).toContain("Unavailable");
    expect(home).not.toContain("Admin command center");
    expect(home).not.toContain("Tool index");
    expect(home).not.toContain("Law guardrails");
    expect(home).not.toContain("No urgent issue right now");
  });

  it("routes every tool through one v2 surface and never silently substitutes Admin Home", () => {
    const router = read("client/src/pages/admin.tsx");
    const surface = read("client/src/admin/AdminToolSurface.tsx");
    const styles = read("client/src/admin/admin-os-v2.css");

    expect(router).toContain("<AdminToolSurface tool={resolved.tool}>");
    expect(router).toContain("silentlyFellBackToHome");
    expect(router).toContain("This admin route is not registered");
    expect(router).toContain("will not silently replace an unknown workspace with Admin Home");
    expect(router).not.toContain("Unknown admin tool");

    expect(surface).toContain("NATIVE_ADMIN_V2_TOOLS");
    expect(surface).toContain('"overview"');
    expect(surface).toContain('"tradepartner-ops"');
    expect(surface).toContain('"direct-connect-requests"');
    expect(surface).toContain('data-admin-surface={native ? "native-v2" : "adapted-v1"}');
    expect(surface).toContain('import "./admin-os-v2.css"');

    expect(styles).toContain("ts-admin-tool-surface--adapted");
    expect(styles).toContain("max-width: none !important");
    expect(styles).toContain("box-shadow: none !important");
    expect(styles).toContain("This adapter changes presentation only");
  });

  it("flattens partner operations and replaces card grids with workflow lists", () => {
    const portal = read("client/src/pages/admin-tradepartner-ops.tsx");
    const profiles = read("client/src/pages/admin-managed-partner-profiles.tsx");
    const intake = read("client/src/pages/admin-managed-partner-intakes.tsx");

    expect(portal).toContain("AdminWorkspace");
    expect(portal).toContain("AdminWorkspaceSubnav");
    expect(portal).toContain('data-testid="admin-tradepartner-workspace"');
    expect(portal).not.toContain("TradePartners and TradeDeals Portal");
    expect(portal).not.toContain("<Card");

    expect(profiles).toContain("AdminSummaryStrip");
    expect(profiles).toContain("AdminToolbar");
    expect(profiles).toContain("AdminList");
    expect(profiles).toContain("<details");
    expect(profiles).toContain("Live profile health");
    expect(profiles).not.toContain("<Card");
    expect(profiles).not.toContain("Managed Partner Profiles");

    expect(intake).toContain("AdminSummaryStrip");
    expect(intake).toContain("AdminToolbar");
    expect(intake).toContain("AdminList");
    expect(intake).toContain('data-testid="managed-partner-intake-editor"');
    expect(intake).toContain("<details");
    expect(intake).not.toContain("<Card");
    expect(intake).not.toContain("Partner Intake Queue");
  });

  it("migrates request operations without changing the existing request composer", () => {
    const requests = read("client/src/pages/admin-direct-connect-requests.tsx");
    const composer = read("client/src/components/admin/AdminDirectConnectRequestCard.tsx");

    expect(requests).toContain("AdminWorkspace");
    expect(requests).toContain("AdminSection");
    expect(requests).toContain('data-testid="admin-request-operations-v2"');
    expect(requests).toContain("Create a request");
    expect(requests).toContain("Request detail");
    expect(requests).toContain("[&>div>div:first-child]:hidden");
    expect(composer).toContain('"POST", "/api/admin/direct-connect/requests"');
    expect(composer).toContain("Create request (manual routing)");
    expect(composer).toContain("Skip manual routing and auto-route");
  });

  it("records the Selective Intelligence scope and release boundary", () => {
    const evidence = read(
      ".selective-intelligence/builds/admin-os-v2-foundation/evidence.md"
    );
    const architecture = read("docs/architecture/ADMIN_OS_V2.md");

    expect(evidence).toContain("dashboards inside dashboards");
    expect(evidence).toContain("Native v2");
    expect(evidence).toContain("Adapted v1");
    expect(evidence).toContain("not a claim that all 21 individual workflows are fully redesigned");
    expect(evidence).toContain("Unknown `/admin/...` paths no longer silently resolve to Admin Home");

    expect(architecture).toContain("one operating system for platform work");
    expect(architecture).toContain("All 21 primary tools are represented");
    expect(architecture).toContain("Individual tools migrate concurrently");
    expect(architecture).toContain("Unknown admin routes must never silently render Admin Home");
  });
});
