import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { projectDirectConnectRequesterContactState } from "@shared/directConnectRequesterContact";

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

describe("Direct Connect DecisionContactGatePanel integration", () => {
  it("renders the shared contact gate primitive from the live request card surface", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain("DecisionContactGatePanel");
    expect(source).toContain('from "@/components/ui/DecisionContactGatePanel"');
    expect(source).toContain("normalizeDirectConnectContactState(r.contactGateState)");
    expect(source).toContain("contactState={contactPanelState}");
    expect(source).toContain('viewerRole="requester"');
    expect(source).toContain("safeSummary={getDirectConnectContactGateSummary(r)}");
    expect(source).toMatch(
      /releasedContact=\{getDirectConnectReleasedContactForPanel\(\s*r,\s*contactPanelState\s*\)\}/
    );
    expect(source).not.toContain("r.releasedContact?.phone");
    expect(source).not.toContain("r.releasedContact?.email");
    expect(source).not.toContain("r.releasedContact?.address");
    expect(source).not.toContain("r.releasedContact?.name");
    expect(source).not.toContain("r.releasedContact?.notes");
  });

  it("uses the shared read-only requester policy without manufacturing contact release", () => {
    const source = read("client/src/pages/direct-connect/requestCardPresentation.ts");
    const server = read("server/utils/workRequestShare.ts");
    for (const state of ["locked", "contractor_requested", "user_approved", "request_shared"]) {
      expect(projectDirectConnectRequesterContactState(state)).toBe("request_submission");
    }
    for (const state of ["denied", "closed", "unexpected_state"]) {
      expect(projectDirectConnectRequesterContactState(state)).toBe(state);
    }
    expect(source).toContain("projectDirectConnectRequesterContactState(contactGateState)");
    expect(server).toContain("projectDirectConnectRequesterContactState(contactGateState)");
    expect(source).toContain('normalized === "released"');
    expect(source).toContain('contactState !== "contact_released"');
    expect(source).toContain('return "Review the request status before taking the next step."');
  });

  it("keeps requester list/detail card contact rendering routed through DecisionContactGatePanel", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain("<DecisionContactGatePanel");
    expect(source).toContain("safeSummary={getDirectConnectContactGateSummary(r)}");
    expect(source).toMatch(
      /releasedContact=\{getDirectConnectReleasedContactForPanel\(\s*r,\s*contactPanelState\s*\)\}/
    );
    expect(source).not.toContain("Released contact");
    expect(source).not.toContain("Phone: {r.releasedContact");
    expect(source).not.toContain("Email: {r.releasedContact");
    expect(source).not.toContain("Address: {r.releasedContact");
  });
});
