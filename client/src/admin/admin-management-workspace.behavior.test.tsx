// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { describe, expect, it, vi } from "vitest";
import { canSeeAdminTool, getAllAdminTools, resolveAdminToolByLocation } from "./adminTools";
import {
  getAdminNavWorkspacesForRole,
  getAdminSearchWorkspacesForRole,
} from "./adminNavWorkspaces";
import {
  adminSourceState,
  knownQueueCount,
  queueDestination,
  refreshAdminSources,
  snapshotEvidenceKnown,
  useAdminObservationClock,
} from "./adminQueueState";
import { AdminHome } from "./AdminHome";
import AdminShell from "../pages/admin";
import AdminCommercialDirectory from "../pages/admin-commercial-directory";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: "moderator", isSuperAdmin: true }, isAuthenticated: true }),
}));

function client() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        retry: false,
        queryFn: async () => {
          throw new Error("Unseeded synthetic query");
        },
      },
    },
  });
}

function markup(queryClient: QueryClient, child: React.ReactNode, route = "/admin") {
  const originalError = console.error.bind(console);
  const error = vi.spyOn(console, "error").mockImplementation((...args) => {
    if (String(args[0]).includes("useLayoutEffect does nothing on the server")) return;
    originalError(...args);
  });
  try {
    return renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <Router ssrPath={route}>{child}</Router>
      </QueryClientProvider>
    );
  } finally {
    error.mockRestore();
  }
}

describe("actual admin renderer source failures", () => {
  it.each([{ payload: "not an array" }, { payload: [null] }, { payload: [{ document: null }] }])(
    "mounts the real document renderer and its selection effect safely for malformed %j",
    async ({ payload }) => {
      const queryClient = client();
      queryClient.setQueryData(["/api/admin/commercial-directory/projects"], []);
      queryClient.setQueryData(["/api/admin/commercial-directory/verification/pending"], payload);
      const oldUrl = window.location.href;
      window.history.replaceState({}, "", "/admin/commercial-directory?tab=verification");
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
      try {
        await act(async () =>
          root.render(
            <QueryClientProvider client={queryClient}>
              <AdminCommercialDirectory />
            </QueryClientProvider>
          )
        );
        expect(host.textContent).toContain("Unavailable · pending document count unknown");
        expect(host.textContent).not.toContain("0 pending documents");
        expect(
          Array.from(host.querySelectorAll("button")).some(
            (button) => button.textContent === "Approve" || button.textContent === "Reject"
          )
        ).toBe(false);
      } finally {
        act(() => root.unmount());
        host.remove();
        queryClient.clear();
        window.history.replaceState({}, "", oldUrl);
      }
    }
  );
  it.each([
    { statuses: [null] },
    { statuses: [{ rowCount: 2, isStale: false, latestComputedAt: "2999-01-01T00:00:00Z" }] },
    { statuses: null },
  ])("keeps Home available with malformed or future snapshot evidence: %j", ({ statuses }) => {
    const queryClient = client();
    queryClient.setQueryData(["/api/admin/tool-notifications"], {
      updatedAt: new Date().toISOString(),
      countsAvailable: true,
      totalUnread: 0,
      byTool: {},
    });
    queryClient.setQueryData(["/api/admin/mission-control/summary"], {
      totalConnectionAttempts: 0,
      successfulConnections: 0,
      blockedConnections: 0,
      confusingExperiences: 0,
    });
    queryClient.setQueryData(["/api/admin/observability/snapshot-status"], { statuses });
    try {
      const html = markup(queryClient, <AdminHome role="ops_admin" isSuperAdmin={false} />);
      expect(html).toContain("Site management");
      expect(html.includes("Unknown · incomplete evidence")).toBe(true);
      expect(html).not.toContain("0 stale");
    } finally {
      queryClient.clear();
    }
  });
  it("keeps the actual shell navigation consistent with an explicit lower health role despite a stale session super flag", () => {
    const queryClient = client();
    queryClient.setQueryData(["/api/admin/health"], {
      ok: true,
      role: "moderator",
      isSuperAdmin: false,
      userId: "synthetic",
    });
    queryClient.setQueryData(["/api/admin/tool-notifications"], {
      updatedAt: new Date().toISOString(),
      byTool: {},
      totalUnread: 0,
      countsAvailable: true,
    });
    try {
      const html = markup(queryClient, <AdminShell />, "/admin/production-acceptance");
      const aside = html.match(/<aside[\s\S]*?<\/aside>/)?.[0] || "";
      expect(aside).toContain("TradeScout Admin");
      expect(aside).not.toContain("Production Acceptance");
      expect(aside).not.toContain("Ecosystem Truth");
      expect(html).toContain("This workspace requires a higher admin role");
    } finally {
      queryClient.clear();
    }
  });
  it.each(["loading", "error", "cached-error", "stale"])(
    "withholds current verification count/action/empty claims in the real Commercial Work renderer for %s",
    (state) => {
      const queryClient = client();
      const key = ["/api/admin/commercial-directory/verification/pending"];
      queryClient.setQueryData(["/api/admin/commercial-directory/projects"], []);
      if (state === "cached-error" || state === "stale")
        queryClient.setQueryData(
          key,
          [{ document: { id: "synthetic-doc", type: "license" }, contractor: null }],
          { updatedAt: state === "stale" ? Date.now() - 120_000 : Date.now() }
        );
      if (state === "error" || state === "cached-error") {
        const query = queryClient.getQueryCache().build(queryClient, { queryKey: key });
        query.setState({ status: "error", error: new Error("synthetic 503") });
      }
      const oldUrl = window.location.href;
      window.history.replaceState({}, "", "/admin/commercial-directory?tab=verification");
      try {
        const html = markup(
          queryClient,
          <AdminCommercialDirectory />,
          "/admin/commercial-directory?tab=verification"
        );
        expect(html).toContain("pending document count unknown");
        expect(html).not.toMatch(/0 pending documents|1 pending document/);
        expect(html).not.toContain("No pending verification documents");
        expect(html).not.toMatch(/>Approve<|>Reject</);
      } finally {
        queryClient.clear();
        window.history.replaceState({}, "", oldUrl);
      }
    }
  );
});

describe("connected site management", () => {
  it.each(["moderator", "ops_admin", "super_admin", "owner"] as const)(
    "makes every permitted registered tool searchable for %s without duplicate destinations",
    (role) => {
      const search = getAdminSearchWorkspacesForRole(role).flatMap((section) => section.items);
      const expected = getAllAdminTools().filter((tool) => canSeeAdminTool(tool, role));
      expect(search.map((tool) => tool.id).sort()).toEqual(expected.map((tool) => tool.id).sort());
      expect(new Set(search.map((tool) => tool.path)).size).toBe(search.length);
      for (const tool of search)
        expect(resolveAdminToolByLocation(tool.path, role).allowed).toBe(true);
    }
  );
  it("connects every reported queue to primary navigation and opens the provider document review tab", () => {
    const tools = getAdminNavWorkspacesForRole("ops_admin").flatMap((section) => section.items);
    for (const id of [
      "verification",
      "professional-verification",
      "tradepartner-rsvps",
      "commercial-directory",
    ])
      expect(tools.some((tool) => tool.id === id)).toBe(true);
    const documents = tools.find((tool) => tool.id === "commercial-directory")!;
    expect(queueDestination(documents)).toBe("/admin/commercial-directory?tab=verification");
    expect(resolveAdminToolByLocation(queueDestination(documents), "ops_admin").tool?.id).toBe(
      "commercial-directory"
    );
  });
  it("does not expose higher-role controls through the catalog", () => {
    const moderator = getAdminSearchWorkspacesForRole("moderator").flatMap(
      (section) => section.items
    );
    expect(
      moderator.some(
        (tool) =>
          tool.id === "professional-verification" ||
          tool.id === "controls" ||
          tool.id === "live-stream"
      )
    ).toBe(false);
    expect(resolveAdminToolByLocation("/admin/control", "moderator").allowed).toBe(false);
  });
  it("keeps unregistered routes distinct from an allowed registered workspace", () => {
    expect(resolveAdminToolByLocation("/admin/not-a-real-tool", "ops_admin").tool?.path).toBe(
      "/admin"
    );
    // The shell recognizes this fallback and renders its existing explicit unknown-route state.
    expect(resolveAdminToolByLocation("/admin/errors", "ops_admin").tool?.path).toBe(
      "/admin/errors"
    );
  });
});

describe("source truth and refresh", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  it("does not turn unknown, negative, malformed, loading, or stale counts into zero", () => {
    for (const value of [null, undefined, "0", NaN, -1, 0.5, Infinity])
      expect(knownQueueCount(value)).toBeNull();
    expect(knownQueueCount(0)).toBe(0);
    expect(adminSourceState({ loading: true, error: false, now })).toBe("Loading");
    expect(adminSourceState({ loading: false, error: false, now })).toBe("Unavailable");
    expect(adminSourceState({ loading: false, error: true, observedAt: now, now })).toBe(
      "Unavailable"
    );
    expect(adminSourceState({ loading: false, error: false, observedAt: now - 91_000, now })).toBe(
      "Stale"
    );
    expect(adminSourceState({ loading: false, error: false, observedAt: now + 61_000, now })).toBe(
      "Unavailable"
    );
  });
  it("does not label missing or incomplete snapshot evidence current", () => {
    expect(snapshotEvidenceKnown(undefined)).toBe(false);
    expect(snapshotEvidenceKnown([])).toBe(false);
    expect(snapshotEvidenceKnown([{ rowCount: 0 }])).toBe(false);
    expect(snapshotEvidenceKnown([{ rowCount: 1, isStale: false, latestComputedAt: null }])).toBe(
      false
    );
    expect(
      snapshotEvidenceKnown([
        { rowCount: 1, isStale: false, latestComputedAt: "2026-10-01T11:59:00Z" },
      ])
    ).toBe(true);
  });
  it("refreshes only role-enabled sources, including after one request fails", async () => {
    const queues = vi.fn().mockRejectedValue(new Error("offline"));
    const mission = vi.fn().mockResolvedValue({});
    const snapshots = vi.fn().mockResolvedValue({});
    await refreshAdminSources(queues, false, mission, snapshots);
    expect(queues).toHaveBeenCalledTimes(1);
    expect(mission).not.toHaveBeenCalled();
    expect(snapshots).not.toHaveBeenCalled();
    await refreshAdminSources(queues, true, mission, snapshots);
    expect(mission).toHaveBeenCalledTimes(1);
    expect(snapshots).toHaveBeenCalledTimes(1);
  });
  it("expires displayed queue badges while network observations stay frozen", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    function Badge() {
      const clock = useAdminObservationClock();
      const state = adminSourceState({ loading: false, error: false, observedAt: now, now: clock });
      return <span>{state === "Current" ? "11 pending" : "Count " + state.toLowerCase()}</span>;
    }
    try {
      act(() => root.render(<Badge />));
      expect(host.textContent).toBe("11 pending");
      act(() => vi.advanceTimersByTime(105_000));
      expect(host.textContent).toBe("Count stale");
    } finally {
      act(() => root.unmount());
      host.remove();
      vi.useRealTimers();
    }
  });
});
