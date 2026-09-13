import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { Overview, Systems, Documents, Build, Sale } from "./HomeIdWorkspace";
import { LaunchContent, Fields } from "./PropertyBlessingsLaunchWorkspace";
import { LAUNCH_TABS, launchWorkspaceModel } from "./launchWorkspaceModel";
import { PACKAGE_HOME_ID } from "./homeWorkspaceModel";
vi.mock("@/lib/queryClient", () => ({ apiRequest: vi.fn(() => { throw new Error("Unexpected render-time IO"); }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "viewer" }, isAuthenticated: true, isLoading: false }) }));
vi.mock("@/lib/privateObjectUpload", () => ({ uploadPrivateObject: vi.fn() }));
vi.mock("@/lib/firstUseAnalytics", () => ({ trackFirstUseGuidanceViewed: vi.fn(), trackFirstUseTaskPromptClicked: vi.fn(), trackFirstUseTaskPromptViewed: vi.fn() }));
function render(child: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><Router ssrPath="/homes">{child}</Router></QueryClientProvider>);
  client.clear(); return html;
}
const noop = () => {};
const loaded = { isPending: false, isError: false, refetch: async () => {} };
const persistence = { propertyDetails: [], requestPackets: [], components: [], evidence: [] };

describe("real record-screen rendering", () => {
  it("keeps an empty record neutral rather than declaring readiness or supplier coverage", () => {
    const html = render(<Overview project={null} missing={[]} components={[]} evidence={[]} facts={[]} documents={[]} openProperty={noop} openSystems={noop} openDocuments={noop} />);
    for (const invented of ["Ready for next gate", "No major planning gaps detected", "Preconstruction", "relationships in place", "TradeScout professional network"]) expect(html).not.toContain(invented);
    expect(html).toContain("An empty list does not confirm project readiness");
    expect(html).toContain("View the planning sequence");
  });
  it("renders recorded system status even for stone and cabinets and keeps custom categories", () => {
    const html = render(<Systems components={[{ id: "stone", type: "natural_stone", label: "Stone selection", status: "needs_review" }, { id: "solar", type: "solar", label: "Solar array", status: "unknown" }]} />);
    expect(html).toContain("Stone selection"); expect(html).toContain("Needs review");
    expect(html).toContain("Solar array"); expect(html).toContain("Other systems");
    expect(html).not.toContain("Relationship covered");
  });
  it("renders an authenticated stored-document action without treating an evidence URL as stored proof", () => {
    const html = render(<Documents homeId="home-one" documents={[{ id: "document-one", originalName: "permit.pdf" }]} evidence={[{ id: "reference", title: "Reference", status: "pending", fileUrl: "https://example.com/manual.pdf" }]}
      referencesQuery={loaded} fileRef={React.createRef()} docType="other" setDocType={noop} docFile={null} setDocFile={noop} upload={noop} pending={false} />);
    expect(html).toContain('/api/homes/home-one/documents/document-one/download');
    expect(html).toContain('aria-label="Open permit.pdf"'); expect(html).toContain("Open / download");
    expect(html).toContain("Open file link"); expect(html).toContain("not proof that the original file is stored");
    expect(html).not.toContain(">Stored file<");
  });
  it("keeps stored documents usable while a separate reference load is failing", () => {
    const html = render(<Documents homeId="h" documents={[{ id: "d", originalName: "plan.pdf" }]} evidence={[]} referencesQuery={{ ...loaded, isError: true }} fileRef={React.createRef()} docType="other" setDocType={noop} docFile={null} setDocFile={noop} upload={noop} pending={false} />);
    expect(html).toContain("Open plan.pdf"); expect(html).toContain("References could not be loaded"); expect(html).toContain("Retry references");
    expect(html).not.toContain("No references have been added");
  });
  it("shows a missing selected project instead of a different project's details", () => {
    const html = render(<Build homeId="home" projectId="missing" project={null} projects={[{ id: "real", title: "Other project" }]} missing={[]} openProperty={noop} selectProject={noop} />);
    expect(html).toContain("This project is not available in this property"); expect(html).toContain("No other project has been substituted");
  });
  it("retains the project ID when opening its build timeline", () => {
    const project = { id: "selected-project", title: "Selected project", status: "planning" };
    const html = render(<Build homeId="home" projectId={project.id} project={project} projects={[project]} missing={[]} openProperty={noop} selectProject={noop} />);
    expect(html).toContain("projectId=selected-project"); expect(html).toContain("Open Build Timeline");
    expect(html).toContain("Not recorded"); expect(html).not.toContain("Preconstruction");
  });
  it("keeps the sale path and treats preparation steps as guidance, not completed work", () => {
    const html = render(<Sale homeId="home" openProperty={noop} openDocuments={noop} openRequest={noop} />);
    expect(html).toContain("/homescout/new?homeId=home"); expect(html).toContain("not completed tasks");
    expect(html).not.toContain("data-status=\"known\"");
  });
});

describe("real package-planning rendering", () => {
  it.each(LAUNCH_TABS)("retains $label without preset operational numbers", ({ id }) => {
    const project = { id: "project", title: "Package" };
    const html = render(<LaunchContent home={{ id: PACKAGE_HOME_ID, nickname: "Saved package home" }} project={project} model={launchWorkspaceModel(project)} persistence={persistence} documents={[]} records={[]} viewerId="viewer" tab={id} />);
    expect(html).toContain("Saved package home"); expect(html).toContain("Not recorded");
    expect(html).toContain("Open full property passport"); expect(html).toContain("Open saved scope request");
    expect(html).not.toContain("$13,600"); expect(html).not.toContain("Seventeen first-90-day");
    expect(html).not.toContain("18-line anchor"); expect(html).not.toContain("22 source targets");
  });
  it("keeps every template item available, including items after the eighth", () => {
    const html = render(<Fields value={{ requiredItems: Array.from({ length: 12 }, (_, index) => `Required item ${index + 1}`) }} />);
    expect(html).toContain("Required item 12"); expect(html).not.toContain("more required items");
  });
  it("renders actual scope length and preserves additional line data", () => {
    const project = { metadata: { packageExecution: { anchorScopeMatrix: [{ label: "Roof scope", status: "needs_review", responsibility: "Stored responsibility" }, { label: "Structure", status: "included" }] } } };
    const html = render(<LaunchContent home={{ id: PACKAGE_HOME_ID }} project={project} model={launchWorkspaceModel(project)} persistence={persistence} documents={[]} records={[]} viewerId="viewer" tab="scope" />);
    expect(html).toContain("2-line anchor metal-building scope matrix"); expect(html).toContain("Stored responsibility");
    expect(html).not.toContain("18-line anchor");
  });
});
