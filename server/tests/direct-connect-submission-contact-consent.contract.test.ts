import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("Direct Connect submission contact consent", () => {
  it("releases only the minimum requester contact to exact standard recipients", () => {
    const route = read("server/routes/direct-connect.ts");

    expect(route).toContain('contactGateState: "released"');
    expect(route).toContain('eventType: "contact_released"');
    expect(route).toContain('contactConsent: "request_submission"');
    expect(route).toContain('minimumContactFields: ["name", "phone"]');
    expect(route).toContain('recipientScope: "exact_assigned_recipients_only"');
    expect(route).toContain("loadDirectConnectContactReleasedRequestIds");
    expect(route).toContain("requesterContact: requesterContactByRequest");
    expect(route).toContain("requesterContact,");
    expect(route).not.toContain("homeownerContact: null");
  });

  it("keeps provider contact delivery assignment-scoped and fail-closed", () => {
    const contactModule = read("server/routes/direct-connect/requester-contact.ts");
    const shell = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(contactModule).toContain("releasedRequestIds");
    expect(contactModule).toContain("phone.replace(/\\D+/g, "").length < 10");
    expect(contactModule).toContain("loadDirectConnectRequesterContactByRequestIds");
    expect(shell).toContain("requesterContact={request?.requesterContact}");
    expect(shell).toContain("direct-connect-requester-contact");
    expect(shell).toContain("Email and address stay private.");
  });

  it("records Express submission consent and exposes name and phone before acceptance", () => {
    const express = read("server/routes/tradepartner-express.ts");
    const authority = read("server/routes/direct-connect/authority.ts");

    expect(express).toContain('status: "accepted"');
    expect(express).toContain('"requester_consent_granted"');
    expect(express).toContain('respondedBy: params.requesterUserId');
    expect(express).toContain('contactGateState: "released"');
    expect(express).toContain("Requester contact:");
    expect(express).not.toContain("public profile phone number was not exposed");

    expect(authority).toContain("automaticallyReleasedPermission");
    expect(authority).toContain('assignmentStatus !== "accepted" && assignmentStatus !== "invited"');
    expect(authority).toContain("SELECT first_name, last_name, phone");
    expect(authority).toContain("name,");
    expect(authority).toContain('contactGateState: automaticallyReleasedPermission ? "released" : "accepted"');
  });

  it("renders immediate provider contact while preserving the legacy call endpoint", () => {
    const callAction = read("client/src/pages/direct-connect/AcceptedExpressCallAction.tsx");

    expect(callAction).toContain('assignmentStatus === "invited"');
    expect(callAction).toContain('["accepted", "released"]');
    expect(callAction).toContain("requesterContact?: { name: string; phone: string } | null");
  });
});
