import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateDirectConnectAdminRescue } from "../routes/direct-connect/admin-rescue";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("Direct Connect admin routing rescue", () => {
  it("allows only pre-contact open or routed requests without a selected provider", () => {
    expect(
      evaluateDirectConnectAdminRescue({
        source: "direct_connect",
        status: "open",
        contactGateState: "locked",
        assignmentStatuses: ["suggested", "declined"],
      })
    ).toBeNull();
    expect(
      evaluateDirectConnectAdminRescue({
        source: "direct_connect",
        status: "routed",
        contactGateState: "locked",
        assignmentStatuses: ["invited", "withdrawn"],
      })
    ).toBeNull();
  });

  it("blocks non-Direct-Connect, active-contact, selected-provider, and later lifecycle states", () => {
    expect(
      evaluateDirectConnectAdminRescue({
        source: "tasks",
        status: "open",
        contactGateState: "locked",
        assignmentStatuses: [],
      })?.code
    ).toBe("DIRECT_CONNECT_RESCUE_SOURCE_REQUIRED");
    expect(
      evaluateDirectConnectAdminRescue({
        source: "direct_connect",
        status: "in_progress",
        contactGateState: "locked",
        assignmentStatuses: [],
      })?.code
    ).toBe("DIRECT_CONNECT_RESCUE_LIFECYCLE_LOCKED");
    expect(
      evaluateDirectConnectAdminRescue({
        source: "direct_connect",
        status: "routed",
        contactGateState: "contractor_requested",
        assignmentStatuses: [],
      })?.code
    ).toBe("DIRECT_CONNECT_RESCUE_CONTACT_SEQUENCE_ACTIVE");
    expect(
      evaluateDirectConnectAdminRescue({
        source: "direct_connect",
        status: "routed",
        contactGateState: "locked",
        assignmentStatuses: ["accepted"],
      })?.code
    ).toBe("DIRECT_CONNECT_RESCUE_PROVIDER_SELECTED");
  });

  it("keeps the staff endpoint and UI bound to eligible expansion without authority bypass", () => {
    const registrar = read("server/routes/direct-connect/admin-rescue.ts");
    const routes = read("server/routes/direct-connect.ts");
    const detail = read("client/src/components/admin/AdminDirectConnectRequestDetail.tsx");

    expect(routes).toContain("registerDirectConnectAdminRescueRoute(app, {");
    expect(registrar).toContain('"/api/admin/direct-connect/requests/:id/rescue"');
    expect(registrar).toContain("isAuthenticated,");
    expect(registrar).toContain("isStaff,");
    expect(registrar).toContain("bypassVerificationGate: false");
    expect(registrar).toContain('action: "admin_direct_connect_routing_rescue"');
    expect(registrar).not.toContain("resolveDirectConnectVerificationBypass");
    expect(registrar).not.toContain("setDispatchContactGateState");
    expect(registrar).not.toContain("targetProviderIds");
    expect(detail).toContain('data-testid="admin-direct-connect-routing-rescue"');
    expect(detail).toContain("Expand eligible routing");
  });
});
