import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("Direct Connect shell hierarchy", () => {
  it("renders the request composer for guests while preserving submit-time auth gating", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const postCase = source.slice(source.indexOf('case "post":'), source.indexOf('case "board":'));

    expect(postCase).toContain("DirectConnectRequestComposer");
    expect(source).toContain("if (!isAuthenticated) {");
    expect(source).toContain("persistDirectConnectDraft");
    expect(source).toContain("direct-connect-auth-handoff-submit");
    expect(source).toContain("auth_required_before_submit");
  });

  it("does not duplicate app-level Messages and Notifications controls in the page header", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).not.toContain("Direct Connect notifications");
    expect(source).not.toContain("showNotificationCenter");
    expect(source).not.toContain(">Notifications</span>");
    expect(source).not.toContain(">Messages</span>");
  });

  it("opens the post screen into the request task without first-use intro panels", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain("What do you need help with?");
    expect(source).toContain("Describe the job. You can review before anything is sent.");
    expect(source).toContain("No one is contacted until you send.");
    expect(source).not.toContain("FirstUseGuidanceCard");
    expect(source).not.toContain("DIRECT_CONNECT_GUIDANCE_TEXT");
    expect(source).not.toContain("resolveDirectConnectFirstUseTaskPrompt");
    expect(source).not.toContain("Start your request.");
    expect(source).not.toContain("Start a local work request.");
  });
});
