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

  it("keeps the Jobs sibling surface within the workspace and gives every tab a mobile label", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain('className="w-full max-w-full overflow-x-hidden"');
    expect(source).toContain('className="grid grid-cols-3 gap-1 md:flex');
    expect(source).toContain("min-w-0 items-center justify-center");
    expect(source).toContain("SECTION_SHORT_LABELS[section]");
  });
});
