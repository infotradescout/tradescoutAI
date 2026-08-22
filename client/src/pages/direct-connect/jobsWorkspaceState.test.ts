/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
  JOBS_WORKSPACE_CANONICAL_PATH,
  buildCanonicalJobsWorkspaceHref,
  canonicalizeJobsWorkspacePathname,
  clearJobsWorkspaceState,
  createClearedJobsWorkspaceState,
  formatJobsPay,
  getJobsWorkspaceStorageKey,
  resolveJobsInspectorLifecycle,
  resolveJobsWorkspaceState,
  resolveJobsWorkspaceStateChange,
  resolveSelectedJobsWorkspacePost,
  updateJobsWorkspaceState,
  writeJobsWorkspaceState,
  type JobsWorkspaceState,
} from "./jobsWorkspaceState";

const storedState: JobsWorkspaceState = {
  mode: "resume",
  searchQuery: "saved search",
  tradeSlug: "roofing",
  stateCode: "FL",
  countyFips: "12033",
  selectedPostId: "post-saved",
};

describe("Jobs workspace state", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("lets explicit URL values win and restores only compatible missing fields", () => {
    writeJobsWorkspaceState({
      storage: window.sessionStorage,
      authenticatedUserId: "user-1",
      pathname: JOBS_WORKSPACE_CANONICAL_PATH,
      state: storedState,
    });

    expect(
      resolveJobsWorkspaceState({
        search: "?mode=job&q=tile&trade=&countyFips=12091&selected=post-url",
        storage: window.sessionStorage,
        authenticatedUserId: "user-1",
        pathname: JOBS_WORKSPACE_CANONICAL_PATH,
      })
    ).toEqual({
      mode: "job",
      searchQuery: "tile",
      tradeSlug: "",
      stateCode: "FL",
      countyFips: "12091",
      selectedPostId: "post-url",
    });

    expect(
      resolveJobsWorkspaceState({
        search: "?tab=resumes",
        storage: window.sessionStorage,
        authenticatedUserId: "user-1",
        pathname: JOBS_WORKSPACE_CANONICAL_PATH,
      })
    ).toEqual(storedState);
  });

  it("clears a stored county when an explicit state changes without a new county", () => {
    writeJobsWorkspaceState({
      storage: window.sessionStorage,
      authenticatedUserId: "user-1",
      pathname: JOBS_WORKSPACE_CANONICAL_PATH,
      state: storedState,
    });

    expect(
      resolveJobsWorkspaceState({
        search: "?mode=job&state=AL",
        storage: window.sessionStorage,
        authenticatedUserId: "user-1",
        pathname: "/direct-connect/employment",
        defaultStateCode: "FL",
        defaultCountyFips: "12033",
      })
    ).toEqual({
      mode: "job",
      searchQuery: "saved search",
      tradeSlug: "roofing",
      stateCode: "AL",
      countyFips: "",
      selectedPostId: "",
    });
  });

  it("never combines a restored state with an explicit county from another state", () => {
    writeJobsWorkspaceState({
      storage: window.sessionStorage,
      authenticatedUserId: "user-1",
      pathname: JOBS_WORKSPACE_CANONICAL_PATH,
      state: storedState,
    });

    expect(
      resolveJobsWorkspaceState({
        search: "?county=01003",
        storage: window.sessionStorage,
        authenticatedUserId: "user-1",
        pathname: JOBS_WORKSPACE_CANONICAL_PATH,
      })
    ).toMatchObject({ stateCode: "AL", countyFips: "01003" });

    expect(
      resolveJobsWorkspaceState({
        search: "?state=FL&county=01003",
        storage: window.sessionStorage,
        authenticatedUserId: "user-1",
        pathname: JOBS_WORKSPACE_CANONICAL_PATH,
      })
    ).toMatchObject({ stateCode: "FL", countyFips: "" });
  });

  it("canonicalizes the employment alias and scopes session state by account plus canonical path", () => {
    const canonicalKey = getJobsWorkspaceStorageKey("user-1", JOBS_WORKSPACE_CANONICAL_PATH);
    const aliasKey = getJobsWorkspaceStorageKey("user-1", "/direct-connect/employment/");

    expect(aliasKey).toBe(canonicalKey);
    expect(getJobsWorkspaceStorageKey("user-2", JOBS_WORKSPACE_CANONICAL_PATH)).not.toBe(
      canonicalKey
    );
    expect(getJobsWorkspaceStorageKey("user-1", "/contractors")).not.toBe(canonicalKey);
    expect(getJobsWorkspaceStorageKey(null, JOBS_WORKSPACE_CANONICAL_PATH)).toBeNull();
    expect(canonicalizeJobsWorkspacePathname("/direct-connect/employment")).toBe(
      JOBS_WORKSPACE_CANONICAL_PATH
    );

    writeJobsWorkspaceState({
      storage: window.sessionStorage,
      authenticatedUserId: "user-1",
      pathname: JOBS_WORKSPACE_CANONICAL_PATH,
      state: storedState,
    });
    expect(
      resolveJobsWorkspaceState({
        search: "",
        storage: window.sessionStorage,
        authenticatedUserId: "user-2",
        pathname: JOBS_WORKSPACE_CANONICAL_PATH,
      }).selectedPostId
    ).toBe("");
  });

  it("emits one bounded canonical URL form while preserving unrelated entry context", () => {
    const href = buildCanonicalJobsWorkspaceHref({
      pathname: "/direct-connect/employment/",
      currentSearch:
        "?tab=resumes&query=old&tradeId=old&stateCode=fl&countyFips=12033&postId=old&source=taskbar",
      state: {
        mode: "resume",
        searchQuery: `  finish   ${"x".repeat(200)}\u202E  `,
        tradeSlug: "FLOORING",
        stateCode: "fl",
        countyFips: "12091",
        selectedPostId: "post-2",
      },
    });
    const url = new URL(href, "https://www.thetradescout.com");

    expect(url.pathname).toBe(JOBS_WORKSPACE_CANONICAL_PATH);
    expect(url.searchParams.get("mode")).toBe("resume");
    expect(url.searchParams.get("q")?.startsWith("finish x")).toBe(true);
    expect(Array.from(url.searchParams.get("q") || "")).toHaveLength(160);
    expect(url.searchParams.get("trade")).toBe("flooring");
    expect(url.searchParams.get("state")).toBe("FL");
    expect(url.searchParams.get("county")).toBe("12091");
    expect(url.searchParams.get("selected")).toBe("post-2");
    expect(url.searchParams.get("source")).toBe("taskbar");
    expect(url.searchParams.has("tab")).toBe(false);
    expect(url.searchParams.has("query")).toBe(false);
    expect(url.searchParams.has("tradeId")).toBe(false);
    expect(url.searchParams.has("countyFips")).toBe(false);
    expect(url.searchParams.has("postId")).toBe(false);
  });

  it("invalidates selection for every mode, filter, and jurisdiction change", () => {
    const current: JobsWorkspaceState = {
      mode: "job",
      searchQuery: "tile",
      tradeSlug: "flooring",
      stateCode: "FL",
      countyFips: "12033",
      selectedPostId: "post-1",
    };

    const changes: Array<Partial<JobsWorkspaceState>> = [
      { mode: "resume" },
      { searchQuery: "roof" },
      { tradeSlug: "roofing" },
      { stateCode: "AL", countyFips: "01003" },
      { countyFips: "12091" },
    ];
    for (const change of changes) {
      expect(updateJobsWorkspaceState(current, change).selectedPostId).toBe("");
    }

    expect(resolveJobsWorkspaceStateChange(current, "AL")).toMatchObject({
      stateCode: "AL",
      countyFips: "",
      selectedPostId: "",
    });
  });

  it("resolves selection only from the current result set", () => {
    const posts = [
      { id: "post-1", title: "One" },
      { id: "post-2", title: "Two" },
    ];

    expect(resolveSelectedJobsWorkspacePost(posts, "post-2")).toEqual(posts[1]);
    expect(resolveSelectedJobsWorkspacePost(posts, "stale-post")).toBeNull();
    expect(resolveSelectedJobsWorkspacePost([], "post-2")).toBeNull();
  });

  it("models the role-aware open and closed lifecycle actions", () => {
    expect(
      resolveJobsInspectorLifecycle({
        postType: "job",
        status: "open",
        isOwner: false,
      })
    ).toMatchObject({ showApply: true, showApplicationStatus: false });
    expect(
      resolveJobsInspectorLifecycle({
        postType: "job",
        status: "open",
        isOwner: false,
        applicationStatus: "pending",
      })
    ).toMatchObject({ showApply: false, showApplicationStatus: true });
    expect(
      resolveJobsInspectorLifecycle({ postType: "job", status: "open", isOwner: true })
    ).toMatchObject({ showApplicants: true, showClose: true, showApply: false });
    expect(
      resolveJobsInspectorLifecycle({ postType: "resume", status: "open", isOwner: false })
    ).toMatchObject({ showStartReply: true, showApply: false });
    expect(
      resolveJobsInspectorLifecycle({ postType: "resume", status: "closed", isOwner: false })
    ).toMatchObject({
      isClosed: true,
      showStartReply: false,
      showApply: false,
      showClose: false,
    });
    expect(
      resolveJobsInspectorLifecycle({
        postType: "job",
        status: "open",
        isOwner: false,
        applicationLookupState: "loading",
      })
    ).toMatchObject({ isApplicationStateLoading: true, showApply: false });
    expect(
      resolveJobsInspectorLifecycle({
        postType: "job",
        status: "open",
        isOwner: false,
        applicationLookupState: "error",
      })
    ).toMatchObject({ hasApplicationStateError: true, showApply: false });
  });

  it("formats annual pay with exactly one suffix", () => {
    expect(formatJobsPay({ payMin: 50_000, payMax: 70_000, payUnit: "year" })).toBe(
      "$50,000 – $70,000/yr"
    );
    expect(formatJobsPay({ payMin: 50_000, payMax: 50_000, payUnit: "year" })).toBe("$50,000/yr");
    expect(formatJobsPay({ payMin: 25, payUnit: "hour" })).toBe("$25/hr");
  });

  it("clears filters and scoped storage only through the explicit clear path", () => {
    writeJobsWorkspaceState({
      storage: window.sessionStorage,
      authenticatedUserId: "user-1",
      pathname: JOBS_WORKSPACE_CANONICAL_PATH,
      state: storedState,
    });
    expect(window.sessionStorage.length).toBe(1);

    clearJobsWorkspaceState({
      storage: window.sessionStorage,
      authenticatedUserId: "user-1",
      pathname: "/direct-connect/employment",
    });
    expect(window.sessionStorage.length).toBe(0);
    expect(createClearedJobsWorkspaceState("resume")).toEqual({
      mode: "resume",
      searchQuery: "",
      tradeSlug: "",
      stateCode: "",
      countyFips: "",
      selectedPostId: "",
    });
  });
});
