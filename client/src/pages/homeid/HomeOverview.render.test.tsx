import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import HomeOverview from "./HomeOverview";
import { HOME_SECTIONS, PACKAGE_HOME_ID } from "./homeWorkspaceModel";
import { homeOverviewQueryKeys } from "./homeOverviewQueryKeys";

// Render the real component with an isolated cache. Network IO, not UI, is mocked.
vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn(() => { throw new Error("Unexpected render-time network request"); }) }));

function render(options: { missingAddress?: boolean; failedProjects?: boolean; wrongViewer?: boolean; noHome?: boolean } = {}) {
  const viewer = "test-owner";
  const id = PACKAGE_HOME_ID;
  const keys = homeOverviewQueryKeys(id, viewer);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const home = { id, nickname: "Sample property", propertyType: "single_family", ...(options.missingAddress ? {} : { address1: "Example address", city: "Example", stateCode: "FL" }) };
  client.setQueryData(keys.detail, { home, records: [
    { id: "record", title: "Inspected roof", occurredAt: "2026-09-01" },
    { id: "meta", title: "homeid:internal", occurredAt: "2026-09-02" },
  ], documents: [{ id: "file", originalName: "roof-report.pdf", documentType: "inspection_report" }] });
  client.setQueryData(keys.projects, [{ id: "project-a", title: "Kitchen renovation", status: "planning", description: "Replace cabinets" }]);
  client.setQueryData(keys.schedules, []);
  client.setQueryData(keys.persistence, { propertyDetails: [{ id: "detail", status: "needs_review", note: "Check dimensions" }], components: [], requestPackets: [], evidence: [{ id: "ref" }] });
  if (options.failedProjects) client.getQueryCache().find({ queryKey: keys.projects })!.setState({ status: "error", error: new Error("Unavailable") });
  const markup = renderToStaticMarkup(<QueryClientProvider client={client}><Router ssrPath="/homes"><HomeOverview
    viewerId={options.wrongViewer ? "different-owner" : viewer}
    homeId={options.noHome ? null : id}
    homes={[home]}
    homesPending={false} homesError={false} retryHomes={() => {}} selectHome={() => {}}
  /></Router></QueryClientProvider>);
  client.clear();
  return markup;
}

describe("actual HomeOverview render", () => {
  it("renders saved property and project information without operational metric theater", () => {
    const html = render();
    expect(html).toContain("Sample property");
    expect(html).toContain("Kitchen renovation");
    expect(html).toContain("Example address");
    expect(html).toContain("projectId=project-a");
    expect(html).not.toContain("Ready for next gate");
    expect(html).not.toContain("Design and property screening");
    expect(html).not.toContain("Launch tasks");
    expect(html).not.toContain("homeid:internal");
  });
  it("retains every workspace section and explicit specialist tools", () => {
    const html = render();
    for (const section of HOME_SECTIONS.filter((section) => section.id !== "overview")) expect(html).toContain(`tab=${section.id}`);
    expect(html).toContain("workspace=launch");
    expect(html).toContain("Prepare a work request");
    expect(html).toContain("roof-report.pdf");
    expect(html).toContain("References are not uploaded files");
  });
  it("does not turn failed loads into empty or healthy claims", () => {
    const html = render({ failedProjects: true });
    expect(html).toContain("Projects could not be loaded");
    expect(html).toContain("Retry");
    expect(html).not.toContain("No projects have been saved");
    expect(html).not.toContain("Kitchen renovation");
  });
  it("does not expose another viewer's cached property", () => {
    const html = render({ wrongViewer: true });
    expect(html).toContain("Loading the selected property");
    expect(html).not.toContain("Kitchen renovation");
    expect(html).not.toContain("Example address");
  });
  it("offers the existing creation workflow for an empty account", () => {
    expect(render({ noHome: true })).toContain("Create a property record");
  });
  it("treats a missing address as missing information, not an invented construction stage", () => {
    const html = render({ missingAddress: true });
    expect(html).toContain("Address not added");
    expect(html).toContain("Review missing location details");
    expect(html).not.toContain("Preconstruction");
    expect(html).not.toContain("Add the property address");
  });
  it("shares editor invalidation prefixes while keeping viewer caches distinct", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const keys = homeOverviewQueryKeys(PACKAGE_HOME_ID, "viewer-one");
    expect(keys.detail[0]).toBe(`/api/homes/${PACKAGE_HOME_ID}`);
    expect(keys.projects[0]).toBe(`/api/homes/${PACKAGE_HOME_ID}/projects`);
    expect(keys.schedules[0]).toBe(`/api/homes/${PACKAGE_HOME_ID}/maintenance-schedules`);
    expect(keys.persistence[0]).toBe(`/api/homeid/${PACKAGE_HOME_ID}/persistence`);
    for (const key of Object.values(keys)) {
      client.setQueryData(key, { saved: true });
      await client.invalidateQueries({ queryKey: [key[0]] });
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    }
    expect(client.getQueryData(homeOverviewQueryKeys(PACKAGE_HOME_ID, "viewer-two").detail)).toBeUndefined();
    client.clear();
  });
});
