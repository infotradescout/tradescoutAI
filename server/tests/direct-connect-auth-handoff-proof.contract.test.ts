import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const shellSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/direct-connect/DirectConnectShell.tsx"),
  "utf8"
);
const workspaceSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/direct-connect/directConnectWorkspaceState.ts"),
  "utf8"
);

describe("direct connect auth handoff proof", () => {
  it("persists anonymous Direct Connect drafts across auth handoff before redirecting", () => {
    expect(shellSource).toContain(
      'const DIRECT_CONNECT_DRAFT_DRAFT_KEY = "ts_direct_connect_draft_v1"'
    );
    expect(shellSource).toContain("window.sessionStorage.setItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY");
    expect(shellSource).toContain("window.localStorage.setItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY");
    expect(shellSource).toContain("window.sessionStorage.getItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY)");
    expect(shellSource).toContain("window.localStorage.getItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY)");
    expect(shellSource).toContain("hydrateDirectConnectDraft()");
  });

  it("uses one bounded auth handoff helper for submit and dispatch selection", () => {
    expect(workspaceSource).toContain("export function buildDirectConnectAuthHandoffHref");
    expect(workspaceSource).toContain("parsed.origin === baseOrigin");
    expect(workspaceSource).toContain(
      'getDirectConnectWorkspaceTask(parsed.pathname) === "start"'
    );
    expect(workspaceSource).toContain("canonicalizeDirectConnectWorkspacePathname(parsed.pathname)");
    expect(
      shellSource.match(/buildDirectConnectAuthHandoffHref\(currentReturnPath\(\)\)/g)
    ).toHaveLength(2);
    expect(shellSource).toContain("Your request draft is ready. Sign in to review and send it.");
    expect(shellSource).toContain("Create your free account to share this request");
  });

  it("persists one submission key and re-saves every failed API attempt", () => {
    expect(shellSource).toContain("submissionKey?: string");
    expect(shellSource).toContain("submissionKey,");
    expect(shellSource).toContain("setSubmissionKey(parsed.submissionKey)");
    const errorIndex = shellSource.indexOf("onError: (error: any");
    const persistIndex = shellSource.indexOf("persistDirectConnectDraft({", errorIndex);
    const authIndex = shellSource.indexOf("if (error?.status === 401)", errorIndex);
    const nextPersistIndex = shellSource.indexOf("persistDirectConnectDraft({", persistIndex + 1);
    const errorToastIndex = shellSource.indexOf('title: "Could not send request"', errorIndex);

    expect(errorIndex).toBeGreaterThan(-1);
    expect(persistIndex).toBeGreaterThan(errorIndex);
    expect(authIndex).toBeGreaterThan(persistIndex);
    expect(errorToastIndex).toBeGreaterThan(authIndex);
    expect(nextPersistIndex).toBeGreaterThan(errorToastIndex);
  });

  it("clears the saved draft only after successful request submission", () => {
    const clearIndex = shellSource.lastIndexOf("clearDirectConnectDraft();");
    const successIndex = shellSource.indexOf("onSuccess: (data, variables) => {");
    const errorIndex = shellSource.indexOf("onError: (error: any");

    expect(successIndex).toBeGreaterThan(-1);
    expect(clearIndex).toBeGreaterThan(successIndex);
    expect(errorIndex).toBeGreaterThan(clearIndex);
  });
});
