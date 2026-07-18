import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("universal public-profile Express Direct Connect contract", () => {
  const routeSource = read("server/routes/tradepartner-express.ts");
  const profileSource = read("client/src/pages/ProfileSiteView.tsx");
  const panelSource = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
  const jrSource = read("client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx");
  const resetSource = read("client/src/pages/reset-password.tsx");

  it("supports published active discoverable businesses and the narrow owner-confirmed profile", () => {
    expect(routeSource).not.toContain("profileData.tradePartner !== true");
    expect(routeSource).toContain('String(row.profileStatus) !== "published"');
    expect(routeSource).toContain('String(row.businessStatus) !== "active"');
    expect(routeSource).toContain("!ownerDiscoverable");
    expect(routeSource).toContain("!ownerConfirmedDirectProfile");
    expect(routeSource).toContain("isOwnerConfirmedDirectProfile({");
  });

  it("tailors the form for materials, auto glass, and general services", () => {
    expect(panelSource).toContain(
      'export type ExpressDirectConnectMode = "materials" | "auto_glass" | "service"'
    );
    expect(panelSource).toContain("Direct Connect");
    expect(panelSource).toContain("Fill out the form");
    expect(panelSource).toContain("Send through Direct Connect");
    expect(routeSource).toContain('"request_service"');
    expect(routeSource).toContain('"request_quote"');
    expect(routeSource).toContain('"schedule_service"');
  });

  it("opens Express Direct Connect from JR and generic public profile CTAs", () => {
    expect(profileSource).toContain('requestMode="auto_glass"');
    expect(profileSource).toContain('requestMode="service"');
    expect(profileSource).toContain("onDirectConnect={() => setExpressPanelOpen(true)}");
    expect(jrSource).toContain("onClick={onDirectConnect}");
    expect(jrSource.match(/Direct Connect/g)?.length || 0).toBeGreaterThanOrEqual(3);
    expect(jrSource).not.toContain("preScoutCreateHref");
    expect(jrSource).not.toContain("requestHref");
  });

  it("always opens the call-or-form choice and marks unavailable calling as coming soon", () => {
    expect(profileSource).toContain("const canExpressCall =");
    expect(profileSource).toContain("allowCall={canExpressCall}");
    expect(panelSource).toContain('setView("choice")');
    expect(panelSource).toContain('view === "choice"');
    expect(panelSource).toContain("disabled={busy || !allowCall}");
    expect(panelSource).toContain("Calling is coming soon");
  });

  it("commits the request before onboarding and does not depend on email delivery", () => {
    expect(routeSource).toContain("const requestWorkspacePath =");
    expect(routeSource).toContain("const onboardingPath = activation");
    expect(routeSource).toContain('let onboardingEmailStatus: "sent" | "skipped" | "failed"');
    expect(routeSource).toContain("const emailResult = await emailService.sendEmail");
    expect(routeSource).toContain('onboardingEmailStatus = "failed"');
    expect(routeSource).toContain("onboardingPath,");
    expect(routeSource).toContain("onboardingEmailStatus,");
    expect(panelSource).toContain("No email is required to continue from this browser.");
  });

  it("returns signup to My Requests and offers HomeID only after signup", () => {
    expect(routeSource).toContain("/direct-connect/engagements?requestId=");
    expect(routeSource).toContain("&offerHomeId=1&source=profile_express");
    expect(resetSource).toContain("const safeNext = useMemo");
    expect(resetSource).toContain("mode=signin&next=");
    expect(panelSource).toContain("add this project to your HomeID later");
  });
});

describe("beta Direct Connect super-admin oversight contract", () => {
  const oversightSource = read("server/services/directConnectBetaOversight.ts");
  const expressSource = read("server/routes/tradepartner-express.ts");
  const directConnectSource = read("server/routes/direct-connect.ts");

  it("creates admin-panel notifications without email, push, or assignment", () => {
    expect(oversightSource).toContain('deliveryMethods: ["in_app"]');
    expect(oversightSource).toContain("/admin/direct-connect-requests?requestId=");
    expect(oversightSource).not.toContain("emailService");
    expect(oversightSource).not.toContain("workRequestAssignments");
    expect(oversightSource).not.toContain('"push"');
  });

  it("covers both profile Express and normal Direct Connect request creation", () => {
    expect(expressSource).toContain("await notifySuperAdminsOfDirectConnectRequest({");
    expect(directConnectSource).toContain("await notifySuperAdminsOfDirectConnectRequest({");
  });

  it("fails soft after the customer request is committed", () => {
    expect(expressSource.indexOf("await tx.insert(workRequestAssignments)")).toBeLessThan(
      expressSource.indexOf("await notifySuperAdminsOfDirectConnectRequest({")
    );
    expect(expressSource).toContain("beta admin notification failed");
    expect(directConnectSource).toContain("beta admin notification failed");
    expect(oversightSource).toContain("Promise.allSettled");
  });
});
