import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shouldRenderDirectConnectSectionChrome } from "./directConnectRoutes";

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

  it("lets Jobs and the three-task work desk own hierarchy while true sibling sections keep chrome", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(shouldRenderDirectConnectSectionChrome("employment")).toBe(false);
    expect(shouldRenderDirectConnectSectionChrome("post")).toBe(false);
    expect(shouldRenderDirectConnectSectionChrome("inbox")).toBe(false);
    expect(shouldRenderDirectConnectSectionChrome("engagements")).toBe(false);
    expect(shouldRenderDirectConnectSectionChrome("board")).toBe(true);
    expect(shouldRenderDirectConnectSectionChrome("pros")).toBe(true);
    expect(source).toContain(
      "const showSectionChrome = shouldRenderDirectConnectSectionChrome(activeSection)"
    );
    expect((source.match(/\{showSectionChrome/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(source).toContain("<EmploymentBoard");
    expect(source).toContain("defaultStateCode={defaultStateCode}");
  });

  it("uses one compact role-labeled task switcher while preserving the secondary route wall", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain('className="w-full max-w-full overflow-x-hidden"');
    expect(source).toContain('data-testid="direct-connect-task-switcher"');
    expect(source).toContain('post: { label: "Start", role: "Requester" }');
    expect(source).toContain('inbox: { label: "Incoming", role: "Provider" }');
    expect(source).toContain('engagements: { label: "My Requests", role: "Requester" }');
    expect(source).toContain("isDirectConnectWorkdeskSection(activeSection)");
    expect(source).toContain('className="grid grid-cols-3 gap-1 md:flex');
    expect(source).toContain("DIRECT_CONNECT_TABS.map");
    expect(source).toContain('aria-label="Open public request board"');
    expect(source).toContain("min-h-[44px]");
    expect(source).toContain("max-md:[&_button]:!min-h-[44px]");
  });

  it("lands creation on the exact owned request and renders one requester inspector", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain(
      "`${DIRECT_CONNECT_REQUESTS_PATH}?selected=${encodeURIComponent(submittedRequestId)}`"
    );
    expect(source).toContain('data-testid="direct-connect-requests-workspace"');
    expect(source).toContain('data-testid="my-requests-list"');
    expect(source).toContain('data-testid="my-request-inspector"');
    expect(source).toMatch(/selectedRequest\s*\?\s*\(\s*\[selectedRequest\]\.map/);
    expect(source).toContain("shouldInvalidateDirectConnectWorkspaceSelection({");
    expect(source).toContain("queryFetchedAfterMount: isFetchedAfterMount");
    expect(source).toContain('id="direct-connect-request-back"');
    expect(source).toContain("Back to My Requests");
    expect(source).toContain(
      'aria-label={`${isMobileActionOpen ? "Hide" : "Show"} request actions`}'
    );
    expect(source).toContain("aria-expanded={isMobileActionOpen}");
    expect(source).toContain('aria-controls="direct-connect-selected-request-actions"');
    expect(source).toContain('id="direct-connect-selected-request-actions"');
    expect(source).toContain("My Requests couldn’t load");
    expect(source).toContain("Retry My Requests");
  });

  it("keeps requester sharing and Messages as explicit inspector actions", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).not.toContain("handleOpenRequest");
    expect(source).toContain("handleShareRequest");
    expect(source).toContain("Share request");
    expect(source).toContain('{r.dcConversationThreadId ? "Open conversation" : "Open Messages"}');
    expect(source).not.toContain('navigate("/direct-connect/inbox")');
    expect(source).toContain("<DecisionContactGatePanel");
  });

  it("remounts user-owned live state and scopes each owned query by viewer", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain(
      'key={`direct-connect-composer:${user?.id || "guest"}:${user?.countyFips || ""}:${user?.stateCode || ""}:${composerEntryLocation}`}'
    );
    expect(source).toContain("resolveDirectConnectComposerLocation(");
    expect(source).toContain(
      'resolveDirectConnectComposerReturnPath(entryLocation, location || "/direct-connect")'
    );
    expect(source).toContain('key={`direct-connect-incoming:${user?.id || "guest"}`}');
    expect(source).toContain('key={`direct-connect-requests:${user?.id || "guest"}`}');
    expect(source).toContain('queryKey: ["/api/direct-connect/inbox", "workspace", user?.id]');
    expect(source).toContain('queryKey: ["/api/direct-connect/requests", "workspace", user?.id]');
  });

  it("saves authenticated Start drafts in scoped session storage without weakening guest handoff", () => {
    const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");

    expect(source).toContain("getDirectConnectComposerDraftSessionKey");
    expect(source).toContain("DIRECT_CONNECT_DRAFT_SAVE_DEBOUNCE_MS");
    expect(source).toContain("latestAuthenticatedDraftSaveRef");
    const synchronizedSnapshotIndex = source.indexOf(
      "latestAuthenticatedDraftSaveRef.current = () => {"
    );
    const debounceIndex = source.indexOf("const timeoutId = window.setTimeout(");
    expect(synchronizedSnapshotIndex).toBeGreaterThan(-1);
    expect(debounceIndex).toBeGreaterThan(synchronizedSnapshotIndex);
    expect(source).toContain("() => latestAuthenticatedDraftSaveRef.current()");
    expect(source).toContain('window.addEventListener("pagehide", flushAuthenticatedDraft)');
    expect(source).toContain("if (authenticatedDraftKey) {");
    expect(source).toContain("window.sessionStorage.setItem(authenticatedDraftKey, serialized)");
    expect(source).toContain(
      "window.localStorage.setItem(DIRECT_CONNECT_DRAFT_DRAFT_KEY, serialized)"
    );
    expect(source).toContain("resolveDirectConnectComposerDraftText(parsed.title, prefillTitle)");
    expect(source).toContain("shouldConsumeDirectConnectDraftAfterHydration(");
    expect(source).toContain("parsed.authHandoff || parsed.profileRecovery,");
  });

  it("resumes the scoped work-desk task only from the global taskbar signal", () => {
    const shellSource = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const appShellSource = read("client/src/components/layout/AppShell.tsx");

    expect(appShellSource).toContain(
      'import { DIRECT_CONNECT_TASKBAR_RESUME_HREF } from "@/pages/direct-connect/directConnectWorkspaceState"'
    );
    expect(appShellSource).toMatch(
      /label: "Direct Connect",\s+href: DIRECT_CONNECT_TASKBAR_RESUME_HREF/
    );
    expect(shellSource).toContain("resolveDirectConnectTaskbarResumeHref");
    expect(shellSource).toContain("hasDirectConnectTaskbarResumeSignal");
    expect(shellSource).toContain("writeDirectConnectLastTask({");
    expect(shellSource).toContain("navigate(taskbarResumeHref, { replace: true })");
  });
});
