import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScoutWorkOverview } from "@shared/scoutWork";

const mocks = vi.hoisted(() => ({ auth: { user: { id: "owner-a" } as { id: string } | null, isAuthenticated: true }, result: {} as Record<string, unknown>, queryOptions: {} as Record<string, unknown> }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@tanstack/react-query", () => ({ useQuery: (options: Record<string, unknown>) => { mocks.queryOptions = options; return mocks.result; } }));
vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...props}>{children}</a> }));
import { ScoutWorkList, ScoutWorkPanel } from "./ScoutWorkPanel";

function overview(): ScoutWorkOverview {
  return { contractVersion: "scout_work.v1", ownerId: "owner-a", checkedAt: "2026-09-16T12:00:00Z", partial: false, sections: [
    { kind: "requests", label: "Your local requests", availability: "ready", hasMore: false, workspace: "/direct-connect/active", items: [
      { id: "r-1", kind: "requests", title: "Roof repair", state: "attention", statusLabel: "Draft saved", detail: "Review before sharing.", updatedAt: null, nextAction: { label: "Open request", to: "/direct-connect/active?selected=r-1&filter=all" } },
      { id: "r-2", kind: "requests", title: "Paint exterior", state: "complete", statusLabel: "Marked completed", detail: "Review the record.", updatedAt: null, nextAction: { label: "Open request", to: "/direct-connect/active?selected=r-2&filter=all" } },
    ] },
    { kind: "scout_actions", label: "Scout action results", availability: "ready", hasMore: false, workspace: "/profile-settings", items: [
      { id: "a-1", kind: "scout_actions", title: "Profile update", state: "attention", statusLabel: "Check result", detail: "Scout will not repeat this action automatically.", updatedAt: null, nextAction: { label: "Check profile", to: "/profile-settings" } },
    ] },
  ] };
}
beforeEach(() => {
  mocks.auth = { user: { id: "owner-a" }, isAuthenticated: true };
  mocks.result = { data: overview(), isError: false, isPending: false, isFetching: false, refetch: vi.fn() };
});

describe("Scout work continuity UI", () => {
  it("renders actual task titles and exact record links", () => {
    const html = renderToStaticMarkup(<ScoutWorkList overview={overview()} />);
    expect(html).toContain("Roof repair"); expect(html).toContain("selected=r-1&amp;filter=all");
    expect(html).toContain("Update time unavailable"); expect(html).not.toContain("Retry action");
  });
  it("filters recent work without pretending to search all history", () => {
    const html = renderToStaticMarkup(<ScoutWorkList overview={overview()} query="ROOF" />);
    expect(html).toContain("Roof repair"); expect(html).not.toContain("Paint exterior");
  });
  it("separates work area selection", () => {
    const html = renderToStaticMarkup(<ScoutWorkList overview={overview()} filter="scout_actions" />);
    expect(html).toContain("Profile update"); expect(html).not.toContain("Roof repair");
  });
  it("needs-review filter excludes completed tasks and retains uncertain outcomes", () => {
    const html = renderToStaticMarkup(<ScoutWorkList overview={overview()} attentionOnly />);
    expect(html).toContain("Roof repair"); expect(html).toContain("Check result"); expect(html).not.toContain("Paint exterior");
  });
  it("distinguishes a failed area from an empty area", () => {
    const data = overview(); data.sections[0].availability = "unavailable"; data.sections[0].items = [];
    const html = renderToStaticMarkup(<ScoutWorkList overview={data} filter="requests" />);
    expect(html).toContain("could not be loaded"); expect(html).not.toContain("No recent items");
  });
  it("shows bounded-history disclosure and retains all workspace entry points", () => {
    const html = renderToStaticMarkup(<ScoutWorkPanel />);
    expect(html).toContain("eight recent items per area"); expect(html).toContain("Start a local request");
    expect(html).toContain("Plan a supply run"); expect(html).toContain("Open Home Vault");
  });
  it("guests see no private cached work or enabled query", () => {
    mocks.auth = { user: null, isAuthenticated: false };
    const html = renderToStaticMarkup(<ScoutWorkPanel />);
    expect(html).toContain("Sign in to see your saved work"); expect(html).not.toContain("Roof repair");
    expect(mocks.queryOptions.enabled).toBe(false);
  });
  it("an account change cannot render the previous owner's query result", () => {
    mocks.auth = { user: { id: "owner-b" }, isAuthenticated: true };
    const html = renderToStaticMarkup(<ScoutWorkPanel />);
    expect(html).not.toContain("Roof repair"); expect(mocks.queryOptions.queryKey).toEqual(["/api/scout/work", "owner-b"]);
    expect(mocks.queryOptions.gcTime).toBe(0);
  });
  it("a failed refresh does not display stale private results as current status", () => {
    mocks.result.isError = true;
    const html = renderToStaticMarkup(<ScoutWorkPanel />);
    expect(html).toContain("could not be loaded"); expect(html).not.toContain("Roof repair");
    expect(mocks.queryOptions.retry).toBe(false);
  });
  it("separates loading and partial data from complete results", () => {
    mocks.result = { isPending: true, isFetching: true };
    expect(renderToStaticMarkup(<ScoutWorkPanel />)).toContain("Loading your saved work");
    mocks.result = { data: { ...overview(), partial: true } };
    expect(renderToStaticMarkup(<ScoutWorkPanel />)).toContain("Some work areas are unavailable");
  });
  it("escapes user-controlled titles rather than rendering executable markup", () => {
    const data = overview(); data.sections[0].items[0].title = '<img src=x onerror="alert(1)">';
    const html = renderToStaticMarkup(<ScoutWorkList overview={data} />);
    expect(html).toContain("&lt;img"); expect(html).not.toContain("<img");
  });
});
