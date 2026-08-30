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
const PROVIDER_SEARCH_ROUTE_PATH = path.resolve(__dirname, "../routes/provider-search.ts");
const PROVIDER_SEARCH_ROUTE = fs.existsSync(PROVIDER_SEARCH_ROUTE_PATH)
  ? fs.readFileSync(PROVIDER_SEARCH_ROUTE_PATH, "utf8")
  : ROUTES_TS.slice(ROUTES_TS.indexOf('"/api/business-providers/search"'));
const DC_SHELL = fs.readFileSync(
  path.resolve(__dirname, "../../client/src/pages/direct-connect/DirectConnectShell.tsx"),
  "utf8"
);

// ─── /api/providers/search — business result shape ───────────────────────────
describe("/api/providers/search — business result shape", () => {
  it("maps business name to companyName field", () => {
    expect(PROVIDER_SEARCH_ROUTE).toMatch(/companyName:\s*(?:b|business)\.name \|\| null/);
  });

  it("includes name field as well for backward compat", () => {
    expect(PROVIDER_SEARCH_ROUTE).toMatch(/name:\s*(?:b|business)\.name \|\| null/);
  });

  it("includes providerType: business for business results", () => {
    // Check the business results mapping block
    const bizMapIdx = PROVIDER_SEARCH_ROUTE.indexOf('providerType: "business" as const');
    expect(bizMapIdx).toBeGreaterThan(-1);
  });

  it("includes providerType: contractor for contractor results", () => {
    expect(PROVIDER_SEARCH_ROUTE).toContain('providerType: "contractor" as const');
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
  const routeBlock = DC_ROUTES.slice(routeEndpointIdx, routeEndpointIdx + 12000);

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

  it("deduplicates business assignments by responderUserId", () => {
    expect(routeBlock).toContain("existingResponderUserIds");
  });

  it("notifies both contractor and business owner users", () => {
    expect(routeBlock).toContain("notifyUserIds");
    expect(routeBlock).toContain("businessesToAssign.map((b) => b.ownerUserId)");
  });

  it("returns routeMode owner_direct for direct-pick", () => {
    expect(routeBlock).toContain('routeMode: "owner_direct"');
  });
});

// ─── Creation endpoint — direct-pick resolves business IDs ───────────────────
describe("creation endpoint — direct-pick resolves business IDs", () => {
  const listEndpointIdx = DC_ROUTES.indexOf('"/api/direct-connect/requests"');
  const creationIdx = DC_ROUTES.indexOf('"/api/direct-connect/requests"', listEndpointIdx + 1);
  const creationEnd = DC_ROUTES.indexOf('"/api/admin/direct-connect/requests"', creationIdx);
  expect(creationIdx).toBeGreaterThan(-1);
  expect(creationEnd).toBeGreaterThan(creationIdx);
  const creationBlock = DC_ROUTES.slice(creationIdx, creationEnd);

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
    expect(creationBlock).toContain("allAssignments");
    expect(creationBlock).toContain("...contractorAssignments, ...businessAssignments");
  });

  it("emits provider_invited events for both contractors and businesses", () => {
    expect(creationBlock).toContain("businessEvents");
    expect(creationBlock).toContain("contractorEvents");
  });

  it("notifies both contractor and business owner users", () => {
    expect(creationBlock).toContain("notifyUserIds");
    expect(creationBlock).toContain("eligibleBusinesses.map((b) => b.ownerUserId)");
  });
});

// ─── Admin creation endpoint — direct-pick resolves business IDs ─────────────
describe("admin creation endpoint — direct-pick resolves business IDs", () => {
  const adminStart = DC_ROUTES.indexOf('"/api/admin/direct-connect/requests"');
  const adminEnd = DC_ROUTES.indexOf('"/api/admin/direct-connect/requests/:id"', adminStart);
  expect(adminStart).toBeGreaterThan(-1);
  expect(adminEnd).toBeGreaterThan(adminStart);
  const adminBlock = DC_ROUTES.slice(adminStart, adminEnd);

  it("admin block also resolves business IDs", () => {
    expect(adminBlock).toContain("potentialBusinessIds");
    expect(adminBlock).toContain("inArray(businesses.id, potentialBusinessIds)");
  });

  it("admin block uses actorUserId for event attribution", () => {
    expect(adminBlock).toContain("actorUserId: String(actorUserId)");
  });

  it("admin block includes createdForUserId in metadata", () => {
    expect(adminBlock).toContain("createdForUserId: resolvedTargetUserId");
  });
});
