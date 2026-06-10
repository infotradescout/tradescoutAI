import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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
    expect(source).not.toContain("releasedContact={");
  });

  it("keeps the presentation mapping on exact P2 state names", () => {
    const source = read("client/src/pages/direct-connect/requestCardPresentation.ts");

    for (const state of [
      "contact_hidden",
      "provider_requested_contact",
      "requester_approved",
      "contact_released",
      "denied",
      "closed",
    ]) {
      expect(source).toContain(state);
    }

    expect(source).toContain('normalized === "contractor_requested"');
    expect(source).toContain('normalized === "user_approved"');
    expect(source).toContain('normalized === "released"');
  });
});
