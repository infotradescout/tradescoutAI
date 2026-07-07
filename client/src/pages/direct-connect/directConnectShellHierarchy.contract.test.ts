import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("Direct Connect shell hierarchy", () => {
  it("requires an account before rendering the request composer", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const postCase = source.slice(source.indexOf('case "post":'), source.indexOf('case "board":'));

    expect(postCase).toContain("centerContent = isAuthenticated ?");
    expect(postCase).toContain("Sign in before starting a request");
    expect(postCase).toContain("Account required");
    expect(postCase).toContain("Browse directory");
  });

  it("does not duplicate app-level Messages and Notifications controls in the page header", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).not.toContain("Direct Connect notifications");
    expect(source).not.toContain("showNotificationCenter");
    expect(source).not.toContain(">Notifications</span>");
    expect(source).not.toContain(">Messages</span>");
  });
});
