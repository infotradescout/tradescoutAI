// @vitest-environment jsdom
// Synthetic UI/account transport only; this test never submits a customer request.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DirectConnectRequestComposer } from "./DirectConnectShell";
import { parseDirectConnectEntryContext } from "./directConnectEntryContext";
import { buildPublicProfileServiceHtml } from "../../../../server/publicProfileServiceHtml";
import { ISSA_BUILD_PROFILE_CONTENT_BLOCKS } from "@shared/issaBuildProfile";
import { buildIssaBuildBusinessContentBlocks } from "@shared/issaBuildPageContent";
import { listFactBearingProfileServices } from "@shared/profileServiceShare";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const fixture = vi.hoisted(() => ({ user: null as any, path: "", navigate: vi.fn(), api: vi.fn(), toast: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: fixture.user, isAuthenticated: Boolean(fixture.user) }) }));
vi.mock("wouter", () => ({ useLocation: () => [fixture.path, fixture.navigate], Link: ({ href, children }: any) => <a href={href}>{children}</a> }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: (...args: any[]) => fixture.api(...args) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: fixture.toast }), toast: (...args: any[]) => fixture.toast(...args) }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key: string, fallback?: string) => fallback || key }) }));
vi.mock("../tasks", () => ({ default: () => null }));
vi.mock("./DirectConnectPros", () => ({ default: () => null }));
vi.mock("./EstimatePanel", () => ({ CreateEstimatePanel: () => null, ReviewEstimatePanel: () => null }));
vi.mock("./JobLifecyclePanels", () => ({}));
vi.mock("./EmploymentBoard", () => ({ EmploymentBoard: () => null }));
vi.mock("@/components/SEOHelmet", () => ({ SEOHelmet: () => null, createServiceStructuredData: () => ({}), createBreadcrumbStructuredData: () => ({}) }));
vi.mock("@/components/GooglePlacesLocationInput", () => ({ GooglePlacesLocationInput: () => null }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: any) => open ? <div>{children}</div> : null,
  SheetContent: ({ children }: any) => <div>{children}</div>, SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock("@/lib/analytics", () => ({ trackShellEvent: vi.fn(), getDeviceType: () => "desktop" }));
vi.mock("@/lib/telemetry", () => ({ trackFrictionEvent: vi.fn(), trackOncePerSession: vi.fn(), trackRepeatedFrictionSignal: vi.fn() }));
vi.mock("@/lib/coreProductAnalytics", () => ({
  trackDirectConnectHomeRecordCreateSelected: vi.fn(), trackDirectConnectHomeRecordLinkSelected: vi.fn(),
  trackDirectConnectHomeRecordPromptViewed: vi.fn(), trackDirectConnectHomeRecordSkipped: vi.fn(),
  trackDirectConnectHomeIdLinkSelected: vi.fn(), trackDirectConnectRequestSubmittedAfterHomeRecordSkip: vi.fn(),
  trackDirectConnectRequestStarted: vi.fn(),
}));

describe("ISSA installation discovery to synthetic buyer request", () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  beforeEach(() => {
    sessionStorage.clear(); localStorage.clear(); fixture.user = null;
    fixture.navigate.mockReset(); fixture.api.mockReset(); fixture.toast.mockReset();
    fixture.api.mockImplementation(async method => method === "POST" ? { id: "synthetic-issa-request" } : []);
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: async () => [] }, mutations: { retry: false } } });
  });
  afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); vi.restoreAllMocks(); });
  async function click(label: string) {
    const button = Array.from(host.querySelectorAll("button")).find(node => node.textContent?.trim() === label);
    expect(button, `Missing ${label}`).toBeTruthy();
    await act(async () => button!.click());
  }
  async function setDescription(value: string) {
    const textarea = host.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, value);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  it.each(["12033", "12113"])("retains ISSA ownership and the synthetic buyer's actual county %s through review and explicit local send", async county => {
    const blocks = buildIssaBuildBusinessContentBlocks(ISSA_BUILD_PROFILE_CONTENT_BLOCKS);
    const service = listFactBearingProfileServices(blocks).find(item => item.slug === "countertops-fabrication")!;
    const html = buildPublicProfileServiceHtml({ templateHtml: '<html><head></head><body><div id="root"></div></body></html>',
      origin: "https://www.thetradescout.com", profile: { slug: "issa-build", displayName: "ISSA Build", contentBlocks: blocks }, service });
    const surface = new DOMParser().parseFromString(html, "text/html");
    const link = Array.from(surface.querySelectorAll("a")).find(node => node.textContent === "Start a Request")!;
    const absolute = new URL(link.getAttribute("href")!, "https://www.thetradescout.com");
    fixture.path = absolute.pathname + absolute.search;
    const context = parseDirectConnectEntryContext(fixture.path);
    expect(context).toMatchObject({ contextType: "profile", contextId: "issa-build", targetName: "ISSA Build", subjectType: "service" });
    window.history.replaceState({}, "", fixture.path);
    const props = { entryLocation: fixture.path, defaultCountyFips: county, defaultStateCode: "FL",
      prefillContextType: context.contextType, prefillContextId: context.contextId, prefillTargetName: context.targetName,
      prefillTitle: context.title, prefillDescription: context.description };
    const render = async () => act(async () => root.render(<QueryClientProvider client={client}><DirectConnectRequestComposer {...props} /></QueryClientProvider>));
    await render();
    await setDescription("Synthetic countertop fabrication and installation project. Confirm measurements and schedule.");
    await click("Review request");
    expect(fixture.api.mock.calls.filter(([method]) => method === "POST")).toHaveLength(0);
    await click("Sign in to send");
    expect(fixture.api.mock.calls.filter(([method]) => method === "POST")).toHaveLength(0);
    await click("Send to ISSA Build");
    expect(fixture.navigate).toHaveBeenCalledWith(expect.stringContaining("mode=signin"));
    expect(fixture.api.mock.calls.filter(([method]) => method === "POST")).toHaveLength(0);
    await act(async () => root.unmount());
    root = createRoot(host);
    fixture.user = { id: `synthetic-issa-buyer-${county}`, firstName: "Synthetic", lastName: "Buyer", phone: "8505550100", countyFips: county, stateCode: "FL" };
    await render();
    await click("Review request");
    await click("Review request details");
    expect(fixture.api.mock.calls.filter(([method]) => method === "POST")).toHaveLength(0);
    await click("Send to ISSA Build");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    const posts = fixture.api.mock.calls.filter(([method]) => method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]).toEqual(["POST", "/api/direct-connect/requests", expect.objectContaining({
      targetProfileSlug: "issa-build", countyFips: county, stateCode: "FL", autoRoute: false,
      title: service.title, description: "Synthetic countertop fabrication and installation project. Confirm measurements and schedule.",
    })]);
    expect(posts[0][2]).not.toHaveProperty("targetProviderIds");
  });
});
