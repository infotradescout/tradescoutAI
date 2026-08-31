/**
 * Contract Tests: Backlog Fixes (Session 3)
 *
 * Covers:
 * 1. Respond endpoint — requester notification on provider accept/decline
 * 2. Objectives Layer Phase 2 — promote endpoint accepts communityPost / marketplaceListing / none(buy)
 * 3. D3 messaging authority test guard normalised (no RUN_INTEGRATION_TESTS dependency)
 * 4. DC redaction test guard normalised (no RUN_INTEGRATION_TESTS dependency)
 * 5. Source-level breakdown analytics — /api/pro/analytics/sources returns real data shape
 * 6. DeviceAuthService — registerDevice returns sessionToken; stub removed from routes.ts
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SERVER_DIR = path.resolve(__dirname, "..");
const ROUTES_FILE = path.join(SERVER_DIR, "routes.ts");
const DC_FILE = path.join(SERVER_DIR, "routes/direct-connect.ts");
const OBJECTIVES_FILE = path.join(SERVER_DIR, "routes/objectives.ts");
const DEVICE_AUTH_FILE = path.join(SERVER_DIR, "deviceAuth.ts");
const D3_TEST_FILE = path.join(SERVER_DIR, "tests/d3-messaging-authority.test.ts");
const REDACTION_TEST_FILE = path.join(SERVER_DIR, "tests/direct-connect-redaction.test.ts");

// ============================================================================
// 1. Respond endpoint — requester notification
// ============================================================================
describe("Respond endpoint: requester notification on accept/decline", () => {
  const dcContent = fs.readFileSync(DC_FILE, "utf-8");
  const respondIdx = dcContent.indexOf("/assignments/:id/respond");
  const expressInterestIdx = dcContent.indexOf(
    "/api/direct-connect/requests/:id/express-interest",
    respondIdx
  );
  const respondWindow = dcContent.slice(respondIdx, expressInterestIdx);

  it("fires createNotification to requester after provider accepts", () => {
    expect(respondWindow).toContain("dc_provider_accepted");
    expect(respondWindow).toContain("createNotification");
  });

  it("fires createNotification to requester after provider declines", () => {
    expect(respondWindow).toContain("dc_provider_declined");
  });

  it("notification targets the request creator (createdByUserId)", () => {
    expect(respondWindow).toContain("createdByUserId");
  });
});

// ============================================================================
// 2. Objectives Layer Phase 2 — promote endpoint
// ============================================================================
describe("Objectives Layer Phase 2: promote endpoint supports all intent types", () => {
  const objContent = fs.readFileSync(OBJECTIVES_FILE, "utf-8");

  it("schema accepts communityPost as targetObjectType", () => {
    expect(objContent).toContain('"communityPost"');
  });

  it("schema accepts marketplaceListing as targetObjectType", () => {
    expect(objContent).toContain('"marketplaceListing"');
  });

  it("promoteToCommunityPost function exists and inserts a draft post", () => {
    expect(objContent).toContain("promoteToCommunityPost");
    expect(objContent).toContain("isPublished: false");
  });

  it("promoteToMarketplaceListing function exists and inserts a draft listing", () => {
    expect(objContent).toContain("promoteToMarketplaceListing");
    expect(objContent).toContain('status: "draft"');
  });

  it("marketplace_buy intent returns browseUrl without creating an object", () => {
    expect(objContent).toContain("browseUrl");
    expect(objContent).toContain("/marketplace?");
    expect(objContent).toContain('status: "completed"');
  });

  it("promote handler routes to all three Phase 2 paths", () => {
    // Anchor on the Phase 1 routing block which precedes Phase 2 routing
    const promoteIdx = objContent.indexOf("promoteToWorkRequest(objective");
    const promoteWindow = objContent.slice(promoteIdx, promoteIdx + 4000);
    expect(promoteWindow).toContain("promoteToCommunityPost");
    expect(promoteWindow).toContain("promoteToMarketplaceListing");
    expect(promoteWindow).toContain("marketplace_buy");
  });
});

// ============================================================================
// 3 & 4. Integration test guards normalised
// ============================================================================
describe("Integration test guards: RUN_INTEGRATION_TESTS dependency removed", () => {
  it("D3 messaging authority test uses hasTestDb guard (not RUN_INTEGRATION_TESTS)", () => {
    const content = fs.readFileSync(D3_TEST_FILE, "utf-8");
    expect(content).not.toContain('RUN_INTEGRATION_TESTS === "true"');
    expect(content).toContain("const hasTestDb = Boolean(process.env.TEST_DATABASE_URL)");
    expect(content).toContain("const describeIntegration = hasTestDb ? describe : describe.skip");
  });

  it("DC redaction test uses hasTestDb guard (not RUN_INTEGRATION_TESTS)", () => {
    const content = fs.readFileSync(REDACTION_TEST_FILE, "utf-8");
    expect(content).not.toContain('RUN_INTEGRATION_TESTS === "true"');
    expect(content).toContain("const hasTestDb = Boolean(process.env.TEST_DATABASE_URL)");
  });
});

// ============================================================================
// 5. Source-level breakdown analytics
// ============================================================================
describe("Source-level breakdown analytics: /api/pro/analytics/sources", () => {
  const routesContent = fs.readFileSync(ROUTES_FILE, "utf-8");
  const sourcesIdx = routesContent.indexOf('"/api/pro/analytics/sources"');
  const sourcesWindow = routesContent.slice(sourcesIdx, sourcesIdx + 2000);

  it("endpoint is no longer a stub (does not return empty array unconditionally)", () => {
    // The old stub was: res.json({ sources: [] }) with a comment "not yet tracked"
    expect(sourcesWindow).not.toContain("not yet tracked");
  });

  it("queries workRequestAssignments joined to workRequests", () => {
    expect(sourcesWindow).toContain("workRequestAssignments");
    expect(sourcesWindow).toContain("workRequests");
  });

  it("groups by workRequests.source", () => {
    expect(sourcesWindow).toContain("groupBy");
    expect(sourcesWindow).toContain("workRequests.source");
  });

  it("returns sources array with count and percentage fields", () => {
    expect(sourcesWindow).toContain("count:");
    expect(sourcesWindow).toContain("percentage:");
  });
});

// ============================================================================
// 6. DeviceAuthService stub resolution
// ============================================================================
describe("DeviceAuthService: stub removed, real implementation wired", () => {
  const routesContent = fs.readFileSync(ROUTES_FILE, "utf-8");
  const deviceAuthContent = fs.readFileSync(DEVICE_AUTH_FILE, "utf-8");

  it("routes.ts no longer contains the local DeviceAuthService stub", () => {
    expect(routesContent).not.toContain("registerTrustedDevice: async () =>");
  });

  it("routes.ts imports DeviceAuthService from ./deviceAuth", () => {
    expect(routesContent).toContain(
      'import { checkTrustedDevice, DeviceAuthService } from "./deviceAuth"'
    );
  });

  it("master admin setup calls registerDevice with userId and req", () => {
    const setupIdx = routesContent.indexOf("createMasterAdmin");
    const setupWindow = routesContent.slice(setupIdx, setupIdx + 1000);
    expect(setupWindow).toContain("registerDevice");
    expect(setupWindow).toContain("masterAdmin.id");
  });

  it("DeviceAuthService.registerDevice returns sessionToken in its result type", () => {
    expect(deviceAuthContent).toContain("sessionToken: string | null");
    expect(deviceAuthContent).toContain("sessionToken: existingDevice.sessionToken");
    expect(deviceAuthContent).toContain("sessionToken: autoApprove ? sessionToken : null");
  });
});
