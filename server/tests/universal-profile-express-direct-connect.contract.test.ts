import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("universal public-profile Express Direct Connect contract", () => {
  const routeSource = read("server/routes/tradepartner-express.ts");
  const profileSource = read("client/src/pages/ProfileSiteView.tsx");
  const panelSource = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
  const jrSource = read("client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx");
  const resetSource = read("client/src/pages/reset-password.tsx");

  it("supports published active discoverable businesses and the narrow owner-confirmed profile", () => {
    expect(routeSource).not.toContain("profileData.tradePartner !== true");
    expect(routeSource).toContain('String(row.businessStatus) !== "active"');
    expect(routeSource).toContain("const directProfileCandidate = {");
    expect(routeSource).toContain("canExposePublishedProfilePublicly({");
    expect(routeSource).toContain("profileId: row.profileId");
    expect(routeSource).toContain("ownerVerifiedBadge: row.ownerVerifiedBadge");
    expect(routeSource).toContain("ownerVerificationStatus: row.ownerVerificationStatus");
    expect(routeSource).toContain("hasTradeScoutPendingOwnerCustody(directProfileCandidate)");
    expect(routeSource).toContain("businessClaimStatus: row?.businessClaimStatus");
    expect(routeSource).toContain("ownerProvider: row?.ownerProvider");
    expect(routeSource).toContain("ownerPreferences: row?.ownerPreferences");
  });

  it("tailors the form for materials, auto glass, and general services", () => {
    expect(panelSource).toContain(
      'export type ExpressDirectConnectMode = "materials" | "auto_glass" | "service"'
    );
    expect(panelSource).toContain("Direct Connect");
    expect(panelSource).toContain("Fill out the form");
    expect(panelSource).toContain("Make A Request");
    expect(routeSource).toContain('"request_service"');
    expect(routeSource).toContain('"request_quote"');
    expect(routeSource).toContain('"schedule_service"');
  });

  it("opens Express Direct Connect from JR and generic public profile CTAs", () => {
    const autoGlassStart = profileSource.indexOf(
      'if (siteTemplate === "auto-glass" || profile.slug === "jrs-auto-glass")'
    );
    const autoGlassEnd = profileSource.indexOf(
      "// Legacy specialty shell until a fabrication gallery template ships.",
      autoGlassStart
    );
    const autoGlassBranch = profileSource.slice(autoGlassStart, autoGlassEnd);
    const defaultStart = profileSource.indexOf("<DefaultProfileTheme");
    const defaultBranch = profileSource.slice(defaultStart);
    const generalDirectConnectStart = profileSource.indexOf(
      "const openGeneralDirectConnect = () => {"
    );
    const generalDirectConnectEnd = profileSource.indexOf("};", generalDirectConnectStart);
    const generalDirectConnect = profileSource.slice(
      generalDirectConnectStart,
      generalDirectConnectEnd
    );
    const serviceDirectConnectStart = profileSource.indexOf(
      "const openServiceDirectConnect = (serviceName?: string) => {"
    );
    const serviceDirectConnectEnd = profileSource.indexOf("};", serviceDirectConnectStart);
    const serviceDirectConnect = profileSource.slice(
      serviceDirectConnectStart,
      serviceDirectConnectEnd
    );

    expect(autoGlassStart).toBeGreaterThanOrEqual(0);
    expect(autoGlassEnd).toBeGreaterThan(autoGlassStart);
    expect(autoGlassBranch).toContain("onDirectConnect={openGeneralDirectConnect}");
    expect(autoGlassBranch).toContain(
      'requestMode={expressInventoryContext ? "materials" : "auto_glass"}'
    );
    expect(defaultStart).toBeGreaterThanOrEqual(0);
    expect(defaultBranch).toContain("onDirectConnect={openServiceDirectConnect}");
    expect(defaultBranch).toContain(
      'requestMode={expressInventoryContext ? "materials" : "service"}'
    );
    expect(generalDirectConnectStart).toBeGreaterThanOrEqual(0);
    expect(generalDirectConnect).toContain("setExpressInventoryContext(null)");
    expect(generalDirectConnect).toContain("setExpressPanelOpen(true)");
    expect(serviceDirectConnectStart).toBeGreaterThanOrEqual(0);
    expect(serviceDirectConnect).toContain("setExpressInventoryContext(null)");
    expect(serviceDirectConnect).toContain("setExpressServiceContext(selectedService || null)");
    expect(serviceDirectConnect).toContain("setExpressPanelOpen(true)");
    expect(jrSource).toContain("onClick={onDirectConnect}");
    expect(jrSource.match(/Direct Connect/g)?.length || 0).toBeGreaterThanOrEqual(3);
    expect(jrSource).not.toContain("preScoutCreateHref");
    expect(jrSource).not.toContain("requestHref");
  });

  it("always opens the call-request-or-form choice without direct-call copy", () => {
    expect(profileSource).toContain("const canExpressCall =");
    expect(profileSource).toContain("allowCall={canExpressCall}");
    expect(panelSource).toContain('setView("choice")');
    expect(panelSource).toContain('view === "choice"');
    expect(panelSource).toContain("disabled={busy || !allowCall}");
    expect(panelSource).toContain("Call requests unavailable");
    expect(panelSource).toContain("They receive your name and phone");
    expect(panelSource).not.toContain("Call now");
    expect(panelSource).toContain("Requests are saved until {businessName} connects.");
    expect(panelSource).not.toContain("TradeScout is receiving requests for");
  });

  it("commits the request before onboarding and does not depend on email delivery", () => {
    expect(routeSource).toContain("const requestWorkspacePath =");
    expect(routeSource).toContain("const onboardingPath = activation");
    expect(routeSource).toContain('let onboardingEmailStatus: "sent" | "skipped" | "failed"');
    expect(routeSource).toContain("const businessEmailResult = await emailService.sendEmail");
    expect(routeSource).toContain("const emailResult = await emailService.sendEmail");
    expect(routeSource).toContain('onboardingEmailStatus = "failed"');
    expect(routeSource).toContain("onboardingPath,");
    expect(routeSource).toContain("onboardingEmailStatus,");
    expect(panelSource).toContain('setView("success")');
    expect(panelSource).not.toContain("json?.onboardingEmailStatus ===");
  });

  it("returns signed-in members to My Requests without a guest account CTA", () => {
    expect(routeSource).toContain("const requestWorkspaceParams = new URLSearchParams");
    expect(routeSource).toContain('from: "public_profile"');
    expect(routeSource).toContain("profile: target.profileSlug");
    expect(panelSource).toContain("setRequestWorkspacePath");
    expect(panelSource).toContain("{hasViewerSession ? (");
    expect(panelSource).toContain("Manage this request");
    expect(panelSource).toContain("Back to {businessName}");
    expect(resetSource).toContain("const safeNext = useMemo");
    expect(resetSource).toContain("mode=signin&next=");
    expect(panelSource).not.toContain("add this project to your HomeID later");
  });
});

describe("beta Direct Connect super-admin oversight contract", () => {
  const oversightSource = read("server/services/directConnectBetaOversight.ts");
  const expressSource = read("server/routes/tradepartner-express.ts");
  const directConnectSource = read("server/routes/direct-connect.ts");

  it("creates admin-panel notifications without email, push, or assignment", () => {
    expect(oversightSource).toContain('deliveryMethods: ["in_app"]');
    expect(oversightSource).toContain("/admin/direct-connect-requests?requestId=");
    expect(oversightSource).toContain("NOT LIKE '%@tradescout.test'");
    expect(oversightSource).not.toContain("is_active");
    expect(oversightSource).toContain("ADMIN_NOTIFICATION_CONCURRENCY");
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
