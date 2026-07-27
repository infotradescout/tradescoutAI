/**
 * Contract tests: DC direct-pick universal provider routing.
 *
 * Verifies that the direct-target path (targetContractorIds) in both the request
 * creation endpoint and the route endpoint correctly resolves business IDs in
 * addition to contractor IDs. Also verifies that /api/providers/search returns
 * companyName for business results and that the DirectoryCandidate type includes
 * providerType.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const DC_ROUTES = fs.readFileSync(path.resolve(__dirname, "../routes/direct-connect.ts"), "utf8");
const ROUTES_TS = fs.readFileSync(path.resolve(__dirname, "../routes.ts"), "utf8");
const DC_SHELL = fs.readFileSync(
  path.resolve(__dirname, "../../client/src/pages/direct-connect/DirectConnectShell.tsx"),
  "utf8"
);

// ─── /api/providers/search — business result shape ───────────────────────────
describe("/api/providers/search — business result shape", () => {
  it("maps business name to companyName field", () => {
    expect(ROUTES_TS).toContain("companyName: b.name || null");
  });

  it("includes name field as well for backward compat", () => {
    expect(ROUTES_TS).toContain("name: b.name || null");
  });

  it("includes providerType: business for business results", () => {
    // Check the business results mapping block
    const bizMapIdx = ROUTES_TS.indexOf('providerType: "business" as const');
    expect(bizMapIdx).toBeGreaterThan(-1);
  });

  it("includes providerType: contractor for contractor results", () => {
    expect(ROUTES_TS).toContain('providerType: "contractor" as const');
  });
});

// ─── DirectoryCandidate type — providerType field ────────────────────────────
describe("DirectoryCandidate type — universal provider fields", () => {
  it("includes providerType in DirectoryCandidate type", () => {
    const typeStart = DC_SHELL.indexOf("type DirectoryCandidate = {");
    expect(typeStart).toBeGreaterThan(-1);
    const typeBody = DC_SHELL.slice(typeStart, typeStart + 600);
    expect(typeBody).toContain("providerType");
  });

  it("includes name field in DirectoryCandidate type", () => {
    const typeStart = DC_SHELL.indexOf("type DirectoryCandidate = {");
    const typeBody = DC_SHELL.slice(typeStart, typeStart + 600);
    expect(typeBody).toContain("name?:");
  });

  it("includes businessId field in DirectoryCandidate type", () => {
    const typeStart = DC_SHELL.indexOf("type DirectoryCandidate = {");
    const typeBody = DC_SHELL.slice(typeStart, typeStart + 600);
    expect(typeBody).toContain("businessId?:");
  });

  it("includes slug field in DirectoryCandidate type", () => {
    const typeStart = DC_SHELL.indexOf("type DirectoryCandidate = {");
    const typeBody = DC_SHELL.slice(typeStart, typeStart + 600);
    expect(typeBody).toContain("slug?:");
  });
});

// ─── Dispatch sheet — candidate name rendering ───────────────────────────────
describe("dispatch sheet — candidate name rendering", () => {
  it("uses name as fallback for companyName in dispatch sheet", () => {
    expect(DC_SHELL).toContain('candidate.companyName || candidate.name || "Local company"');
  });

  it("uses name as fallback for companyName in reroute sheet", () => {
    expect(DC_SHELL).toContain('candidate.companyName || candidate.name || "Local business"');
  });
});

// ─── Route endpoint — direct-pick resolves business IDs ──────────────────────
describe("route endpoint — direct-pick resolves business IDs", () => {
  // Find the isDirectToProviders block in the route endpoint
  const routeEndpointIdx = DC_ROUTES.indexOf("/api/direct-connect/requests/:id/route");
  const routeBlock = DC_ROUTES.slice(routeEndpointIdx, routeEndpointIdx + 16000);

  it("resolves potential business IDs not found in contractors table", () => {
    expect(routeBlock).toContain("potentialBusinessIds");
  });

  it("queries businesses table for non-contractor IDs", () => {
    expect(routeBlock).toContain("inArray(businesses.id, potentialBusinessIds)");
  });

  it("filters businesses by active status", () => {
    expect(routeBlock).toContain('eq(businesses.status, "active" as any)');
  });

  it("creates assignments for businesses with ownerUserId", () => {
    expect(routeBlock).toContain("businessesToAssign");
    expect(routeBlock).toContain("responderUserId: biz.ownerUserId!");
  });

  it("deduplicates each business by canonical provider identity", () => {
    expect(routeBlock).toContain("existingBusinessProviderKeys");
    expect(routeBlock).toContain('buildWorkRequestAssignmentProviderKey("business", biz.id)');
    expect(routeBlock).toContain("responderUserId: biz.ownerUserId!");
  });

  it("notifies both contractor and business owner users", () => {
    expect(routeBlock).toContain("const notifyUserIds = [");
    expect(routeBlock).toContain("insertedProviderKeys.has");
    expect(routeBlock).toContain("contractor.userId");
    expect(routeBlock).toContain("responderUserId: biz.ownerUserId!");
    expect(routeBlock).toContain("businessesToAssign");
    expect(routeBlock).toContain("enqueueRoutedDirectConnectProviderNotifications");
    expect(routeBlock).toContain("userIds: notifyUserIds");
  });

  it("returns routeMode owner_direct for direct-pick", () => {
    expect(routeBlock).toContain('routeMode: "owner_direct"');
  });
});

describe("direct-pick notification recipient identity", () => {
  it("keeps provider assignments distinct while notifying each user only once", () => {
    expect(DC_ROUTES).toContain('buildWorkRequestAssignmentProviderKey("business", business.id)');
    expect(DC_ROUTES).toContain("const uniqueUserIds = Array.from(\n      new Set(userIds");
    expect(DC_ROUTES).toContain(
      "`direct-connect-provider-invitation:${requestId}:${notifyUserId}`"
    );
  });
});

// ─── Creation endpoint — direct-pick resolves business IDs ───────────────────
describe("creation endpoint — direct-pick resolves business IDs", () => {
  const creationRouteStart = DC_ROUTES.indexOf('"/api/direct-connect/requests/:id/route"');
  const creationRouteEnd = DC_ROUTES.indexOf(
    '"/api/direct-connect/requests/:id/cancel"',
    creationRouteStart
  );
  expect(creationRouteStart).toBeGreaterThan(-1);
  expect(creationRouteEnd).toBeGreaterThan(creationRouteStart);
  const creationBlock = DC_ROUTES.slice(creationRouteStart, creationRouteEnd);

  it("resolves potential business IDs not found in contractors table", () => {
    expect(creationBlock).toContain("potentialBusinessIds");
  });

  it("queries businesses table for non-contractor IDs", () => {
    expect(creationBlock).toContain("inArray(businesses.id, potentialBusinessIds)");
  });

  it("creates business assignments with responderUserId", () => {
    expect(creationBlock).toContain("responderUserId: biz.ownerUserId!");
  });

  it("merges contractor and business assignments before insert", () => {
    expect(creationBlock).toContain("allAssignmentsPayload");
    expect(creationBlock).toContain(
      "...contractorAssignmentsPayload,\n            ...businessAssignmentsPayload"
    );
  });

  it("emits provider_invited events for both contractors and businesses", () => {
    expect(creationBlock).toContain("businessEvents");
    expect(creationBlock).toContain("contractorEvents");
  });

  it("notifies both contractor and business owner users", () => {
    expect(creationBlock).toContain("notifyUserIds");
    expect(creationBlock).toContain(".map((business) => business.ownerUserId)");
  });
});

// ─── Admin creation endpoint — direct-pick resolves business IDs ─────────────
describe("admin creation endpoint — direct-pick resolves business IDs", () => {
  const helperStart = DC_ROUTES.indexOf(
    "const reconcileExplicitDirectConnectProviderRouting = async"
  );
  const helperEnd = DC_ROUTES.indexOf("const routeRequestToTopContractors = async", helperStart);
  expect(helperStart).toBeGreaterThan(-1);
  expect(helperEnd).toBeGreaterThan(helperStart);
  const helperBlock = DC_ROUTES.slice(helperStart, helperEnd);
  const adminRouteStart = DC_ROUTES.indexOf('"/api/admin/direct-connect/requests"');
  const adminRouteEnd = DC_ROUTES.indexOf(
    '"/api/admin/direct-connect/requests/:id"',
    adminRouteStart
  );
  const adminBlock = DC_ROUTES.slice(adminRouteStart, adminRouteEnd);

  it("admin block also resolves business IDs", () => {
    expect(helperBlock).toContain("potentialBusinessIds");
    expect(helperBlock).toContain("inArray(businesses.id, potentialBusinessIds)");
    expect(adminBlock).toContain("reconcileExplicitDirectConnectProviderRouting");
  });

  it("admin block uses actorUserId for event attribution", () => {
    expect(adminBlock).toContain("actorUserId: String(actorUserId)");
    expect(helperBlock).toContain("actorUserId,");
  });

  it("admin block includes createdForUserId in metadata", () => {
    expect(adminBlock).toContain("createdForUserId: resolvedTargetUserId");
    expect(helperBlock).toContain("createdForUserId: createdForUserId || null");
  });
});
