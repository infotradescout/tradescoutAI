/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
  DIRECT_CONNECT_INCOMING_PATH,
  DIRECT_CONNECT_REQUESTS_PATH,
  DIRECT_CONNECT_START_PATH,
  DIRECT_CONNECT_TASKBAR_RESUME_HREF,
  buildCanonicalDirectConnectWorkspaceHref,
  canonicalizeDirectConnectWorkspacePathname,
  getDirectConnectComposerDraftSessionKey,
  getDirectConnectLastTaskStorageKey,
  getDirectConnectWorkspaceStorageKey,
  isRealDirectConnectAssignmentId,
  resolveDirectConnectTaskbarResumeHref,
  resolveDirectConnectComposerLocation,
  resolveDirectConnectComposerReturnPath,
  resolveDirectConnectWorkspaceScopeHydration,
  resolveDirectConnectWorkspaceState,
  resolveDirectConnectComposerDraftText,
  resolveSelectedDirectConnectWorkspaceItem,
  shouldKeepDirectConnectWorkspaceRequest,
  shouldConsumeDirectConnectDraftAfterHydration,
  shouldInvalidateDirectConnectWorkspaceSelection,
  updateDirectConnectWorkspaceState,
  writeDirectConnectLastTask,
  writeDirectConnectWorkspaceState,
  type DirectConnectWorkspaceState,
} from "./directConnectWorkspaceState";

const storedRequestsState: DirectConnectWorkspaceState = {
  filter: "in_progress",
  selectedId: "request-saved",
  countyFips: "12033",
};

describe("Direct Connect work-desk state", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("canonicalizes task aliases and scopes storage by account plus role route", () => {
    expect(canonicalizeDirectConnectWorkspacePathname("/direct-connect/post/")).toBe(
      "/direct-connect"
    );
    expect(canonicalizeDirectConnectWorkspacePathname("/direct-connect/engagements/")).toBe(
      DIRECT_CONNECT_REQUESTS_PATH
    );
    expect(getDirectConnectWorkspaceStorageKey("user-1", "/direct-connect/engagements")).toBe(
      getDirectConnectWorkspaceStorageKey("user-1", DIRECT_CONNECT_REQUESTS_PATH)
    );
    expect(getDirectConnectWorkspaceStorageKey("user-1", DIRECT_CONNECT_INCOMING_PATH)).not.toBe(
      getDirectConnectWorkspaceStorageKey("user-1", DIRECT_CONNECT_REQUESTS_PATH)
    );
    expect(getDirectConnectWorkspaceStorageKey("user-2", DIRECT_CONNECT_REQUESTS_PATH)).not.toBe(
      getDirectConnectWorkspaceStorageKey("user-1", DIRECT_CONNECT_REQUESTS_PATH)
    );
    expect(getDirectConnectWorkspaceStorageKey(null, DIRECT_CONNECT_REQUESTS_PATH)).toBeNull();
  });

  it("scopes resumable Start drafts by account, canonical route, and entry context", () => {
    const plainDraftKey = getDirectConnectComposerDraftSessionKey(
      "user-1",
      "/direct-connect/post",
      ""
    );
    expect(plainDraftKey).toBe(
      getDirectConnectComposerDraftSessionKey("user-1", "/direct-connect", "")
    );
    expect(plainDraftKey).not.toBe(
      getDirectConnectComposerDraftSessionKey("user-2", "/direct-connect", "")
    );
    expect(plainDraftKey).not.toBe(
      getDirectConnectComposerDraftSessionKey(
        "user-1",
        "/direct-connect",
        '{"targetProviderId":"provider-2"}'
      )
    );
    expect(
      getDirectConnectComposerDraftSessionKey("user-1", DIRECT_CONNECT_INCOMING_PATH, "")
    ).toBeNull();
    expect(getDirectConnectComposerDraftSessionKey(null, "/direct-connect", "")).toBeNull();
  });

  it("resumes only the authenticated account's last valid work-desk task on an explicit signal", () => {
    writeDirectConnectLastTask({
      storage: window.sessionStorage,
      authenticatedUserId: "user-1",
      task: "requests",
    });
    writeDirectConnectLastTask({
      storage: window.sessionStorage,
      authenticatedUserId: "user-2",
      task: "incoming",
    });

    expect(
      resolveDirectConnectTaskbarResumeHref({
        pathOrSearch: DIRECT_CONNECT_TASKBAR_RESUME_HREF,
        storage: window.sessionStorage,
        authenticatedUserId: "user-1",
      })
    ).toBe(DIRECT_CONNECT_REQUESTS_PATH);
    expect(
      resolveDirectConnectTaskbarResumeHref({
        pathOrSearch: DIRECT_CONNECT_TASKBAR_RESUME_HREF,
        storage: window.sessionStorage,
        authenticatedUserId: "user-2",
      })
    ).toBe(DIRECT_CONNECT_INCOMING_PATH);
    expect(
      resolveDirectConnectTaskbarResumeHref({
        pathOrSearch: "/direct-connect",
        storage: window.sessionStorage,
        authenticatedUserId: "user-1",
      })
    ).toBeNull();

    const userOneKey = getDirectConnectLastTaskStorageKey("user-1");
    expect(userOneKey).not.toBe(getDirectConnectLastTaskStorageKey("user-2"));
    window.sessionStorage.setItem(userOneKey!, "employment");
    expect(
      resolveDirectConnectTaskbarResumeHref({
        pathOrSearch: DIRECT_CONNECT_TASKBAR_RESUME_HREF,
        storage: window.sessionStorage,
        authenticatedUserId: "user-1",
      })
    ).toBe(DIRECT_CONNECT_START_PATH);
  });

  it("keeps the authenticated Start composer owner stable while removing the resume signal", () => {
    writeDirectConnectLastTask({
      storage: window.sessionStorage,
      authenticatedUserId: "user-1",
      task: "start",
    });
    const resumeHref = resolveDirectConnectTaskbarResumeHref({
      pathOrSearch: DIRECT_CONNECT_TASKBAR_RESUME_HREF,
      storage: window.sessionStorage,
      authenticatedUserId: "user-1",
    });

    expect(
      resolveDirectConnectComposerLocation(DIRECT_CONNECT_TASKBAR_RESUME_HREF, resumeHref)
    ).toBe(DIRECT_CONNECT_START_PATH);
    expect(resolveDirectConnectComposerLocation(DIRECT_CONNECT_START_PATH, null)).toBe(
      DIRECT_CONNECT_START_PATH
    );
    expect(
      resolveDirectConnectComposerLocation(
        "/direct-connect?intent=hire&contractorId=provider-1",
        null
      )
    ).toBe("/direct-connect?intent=hire&contractorId=provider-1");
  });

  it("retains authenticated session drafts across remount hydration but consumes guest handoff", () => {
    expect(shouldConsumeDirectConnectDraftAfterHydration(false)).toBe(false);
    expect(shouldConsumeDirectConnectDraftAfterHydration(undefined)).toBe(false);
    expect(shouldConsumeDirectConnectDraftAfterHydration(true)).toBe(true);
  });

  it("keeps cleanup persistence bound to Start after global navigation changes", () => {
    const stagedStart = "/direct-connect?staged=guest-handoff-token&source=profile";
    window.history.replaceState({}, "", DIRECT_CONNECT_REQUESTS_PATH);

    expect(
      resolveDirectConnectComposerReturnPath(
        stagedStart,
        `${window.location.pathname}${window.location.search}`
      )
    ).toBe(stagedStart);
    expect(resolveDirectConnectComposerReturnPath(undefined, "/direct-connect")).toBe(
      DIRECT_CONNECT_START_PATH
    );
  });

  it("retains a fresh explicit selection until post-navigation results are authoritative", () => {
    const selectionState = {
      workspaceHydrated: true,
      selectedId: "req-created",
      selectionResolved: false,
      queryIsSuccess: true,
      queryIsFetching: false,
      queryFetchedAfterMount: false,
    };

    expect(shouldInvalidateDirectConnectWorkspaceSelection(selectionState)).toBe(false);
    expect(
      shouldInvalidateDirectConnectWorkspaceSelection({
        ...selectionState,
        queryIsFetching: true,
      })
    ).toBe(false);
    expect(
      shouldInvalidateDirectConnectWorkspaceSelection({
        ...selectionState,
        queryFetchedAfterMount: true,
        selectionResolved: true,
      })
    ).toBe(false);
    expect(
      shouldInvalidateDirectConnectWorkspaceSelection({
        ...selectionState,
        queryFetchedAfterMount: true,
      })
    ).toBe(true);
    expect(
      shouldInvalidateDirectConnectWorkspaceSelection({
        ...selectionState,
        queryIsSuccess: false,
        queryFetchedAfterMount: true,
      })
    ).toBe(false);
  });

  it("keeps explicit staged values ahead of stored draft values", () => {
    expect(
      resolveDirectConnectComposerDraftText("Stored roof repair", "Explicit HVAC repair")
    ).toBe("Explicit HVAC repair");
    expect(resolveDirectConnectComposerDraftText("Stored roof repair", "  ")).toBe(
      "Stored roof repair"
    );
  });

  it("lets explicit URL values win and restores only compatible missing state", () => {
    writeDirectConnectWorkspaceState({
      storage: window.sessionStorage,
      authenticatedUserId: "user-1",
      pathname: DIRECT_CONNECT_REQUESTS_PATH,
      state: storedRequestsState,
    });

    expect(
      resolveDirectConnectWorkspaceState({
        search: "?filter=open&selected=request-url&county=12091",
        storage: window.sessionStorage,
        authenticatedUserId: "user-1",
        pathname: DIRECT_CONNECT_REQUESTS_PATH,
        currentCountyFips: "12033",
      })
    ).toEqual({ filter: "open", selectedId: "request-url", countyFips: "12091" });

    expect(
      resolveDirectConnectWorkspaceState({
        search: "",
        storage: window.sessionStorage,
        authenticatedUserId: "user-1",
        pathname: DIRECT_CONNECT_REQUESTS_PATH,
        currentCountyFips: "12033",
      })
    ).toEqual(storedRequestsState);

    expect(
      resolveDirectConnectWorkspaceState({
        search: "?filter=open",
        storage: window.sessionStorage,
        authenticatedUserId: "user-1",
        pathname: DIRECT_CONNECT_REQUESTS_PATH,
        currentCountyFips: "12033",
      }).selectedId
    ).toBe("");
  });

  it("bounds URL state and emits one canonical query form without dropping unrelated context", () => {
    const href = buildCanonicalDirectConnectWorkspaceHref({
      pathname: "/direct-connect/engagements/",
      currentSearch: "?status=routed&selectedId=old&countyFips=12033&source=taskbar&entry=auth",
      state: {
        filter: "in_progress",
        selectedId: ` request-${"x".repeat(180)}\u202E `,
        countyFips: "12091",
      },
    });
    const url = new URL(href, "https://www.thetradescout.com");

    expect(url.pathname).toBe(DIRECT_CONNECT_REQUESTS_PATH);
    expect(url.searchParams.get("filter")).toBe("in_progress");
    expect(Array.from(url.searchParams.get("selected") || "")).toHaveLength(120);
    expect(url.searchParams.get("county")).toBe("12091");
    expect(url.searchParams.get("source")).toBe("taskbar");
    expect(url.searchParams.get("entry")).toBe("auth");
    expect(url.searchParams.has("status")).toBe(false);
    expect(url.searchParams.has("selectedId")).toBe(false);
    expect(url.searchParams.has("countyFips")).toBe(false);
  });

  it("invalidates selection when account, task, filter, or county scope changes", () => {
    expect(
      resolveDirectConnectWorkspaceScopeHydration({
        restoredState: storedRequestsState,
        previousScope: `user-1:${DIRECT_CONNECT_REQUESTS_PATH}`,
        currentScope: `user-2:${DIRECT_CONNECT_REQUESTS_PATH}`,
        task: "requests",
      }).selectedId
    ).toBe("");
    expect(
      resolveDirectConnectWorkspaceScopeHydration({
        restoredState: storedRequestsState,
        previousScope: `user-1:${DIRECT_CONNECT_REQUESTS_PATH}`,
        currentScope: `user-1:${DIRECT_CONNECT_INCOMING_PATH}`,
        task: "incoming",
      }).selectedId
    ).toBe("");
    expect(
      updateDirectConnectWorkspaceState(storedRequestsState, { filter: "open" }, "requests")
        .selectedId
    ).toBe("");
    expect(
      updateDirectConnectWorkspaceState(
        storedRequestsState,
        { filter: "pending_outcome" },
        "requests"
      ).selectedId
    ).toBe("");
    expect(
      updateDirectConnectWorkspaceState(storedRequestsState, { countyFips: "12091" }, "requests")
        .selectedId
    ).toBe("");
  });

  it("isolates role storage and resolves selection only from current results", () => {
    writeDirectConnectWorkspaceState({
      storage: window.sessionStorage,
      authenticatedUserId: "user-1",
      pathname: DIRECT_CONNECT_REQUESTS_PATH,
      state: storedRequestsState,
    });
    expect(
      resolveDirectConnectWorkspaceState({
        search: "",
        storage: window.sessionStorage,
        authenticatedUserId: "user-1",
        pathname: DIRECT_CONNECT_INCOMING_PATH,
        currentCountyFips: "12033",
      }).selectedId
    ).toBe("");

    const items = [
      { id: "request-1", title: "One" },
      { id: "request-2", title: "Two" },
    ];
    expect(resolveSelectedDirectConnectWorkspaceItem(items, "request-2")).toEqual(items[1]);
    expect(resolveSelectedDirectConnectWorkspaceItem(items, "request-stale")).toBeNull();
    expect(resolveSelectedDirectConnectWorkspaceItem([], "request-2")).toBeNull();
  });

  it("keeps nonterminal owned requests regardless of age but bounds closed history", () => {
    const now = Date.parse("2026-08-22T00:00:00Z");
    const old = "2025-01-01T00:00:00Z";
    expect(shouldKeepDirectConnectWorkspaceRequest({ status: "open", updatedAt: old }, now)).toBe(
      true
    );
    expect(
      shouldKeepDirectConnectWorkspaceRequest({ status: "in_progress", updatedAt: old }, now)
    ).toBe(true);
    expect(
      shouldKeepDirectConnectWorkspaceRequest({ status: "pending_outcome", updatedAt: old }, now)
    ).toBe(true);
    expect(
      shouldKeepDirectConnectWorkspaceRequest({ status: "completed", updatedAt: old }, now)
    ).toBe(false);
  });

  it("never treats synthetic requester status rows as provider assignments", () => {
    expect(isRealDirectConnectAssignmentId("assignment-1")).toBe(true);
    expect(isRealDirectConnectAssignmentId("request-owned-1")).toBe(false);
    expect(isRealDirectConnectAssignmentId(" ")).toBe(false);
  });
});
