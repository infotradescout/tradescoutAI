// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DirectConnectRequestComposer } from "./DirectConnectShell";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  user: null as any,
  path: "",
  navigate: vi.fn(),
  api: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: state.user, isAuthenticated: Boolean(state.user) }),
}));
vi.mock("wouter", () => ({
  useLocation: () => [state.path, state.navigate],
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/queryClient", () => ({ apiRequest: (...args: any[]) => state.api(...args) }));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: state.toast }),
  toast: (...args: any[]) => state.toast(...args),
}));
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key: string, fallback?: string) => fallback || key }),
}));
vi.mock("../tasks", () => ({ default: () => null }));
vi.mock("./DirectConnectPros", () => ({ default: () => null }));
vi.mock("./EstimatePanel", () => ({
  CreateEstimatePanel: () => null,
  ReviewEstimatePanel: () => null,
}));
vi.mock("./JobLifecyclePanels", () => ({}));
vi.mock("./EmploymentBoard", () => ({ EmploymentBoard: () => null }));
vi.mock("@/components/SEOHelmet", () => ({
  SEOHelmet: () => null,
  createServiceStructuredData: () => ({}),
  createBreadcrumbStructuredData: () => ({}),
}));
vi.mock("@/components/GooglePlacesLocationInput", () => ({
  GooglePlacesLocationInput: () => null,
}));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock("@/lib/analytics", () => ({ trackShellEvent: vi.fn(), getDeviceType: () => "desktop" }));
vi.mock("@/lib/telemetry", () => ({
  trackFrictionEvent: vi.fn(),
  trackOncePerSession: vi.fn(),
  trackRepeatedFrictionSignal: vi.fn(),
}));
vi.mock("@/lib/coreProductAnalytics", () => ({
  trackDirectConnectHomeRecordCreateSelected: vi.fn(),
  trackDirectConnectHomeRecordLinkSelected: vi.fn(),
  trackDirectConnectHomeRecordPromptViewed: vi.fn(),
  trackDirectConnectHomeRecordSkipped: vi.fn(),
  trackDirectConnectHomeIdLinkSelected: vi.fn(),
  trackDirectConnectRequestSubmittedAfterHomeRecordSkip: vi.fn(),
  trackDirectConnectRequestStarted: vi.fn(),
}));

const account = {
  id: "requester-1",
  firstName: "Jordan",
  lastName: "Test",
  phone: "2255550100",
  countyFips: "22105",
  stateCode: "LA",
};
const entry =
  "/direct-connect?profile=bayou-roofing&county=22105&state=LA&title=Original%20roof&description=Original%20repair%20details";
const initialProps = {
  entryLocation: entry,
  defaultCountyFips: "22105",
  defaultStateCode: "LA",
  prefillContextType: "profile" as const,
  prefillContextId: "bayou-roofing",
  prefillTargetName: "Bayou Roofing",
  prefillTitle: "Original roof",
  prefillDescription: "Original repair details",
};

describe("request composer recovery behavior", () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  let mounted = false;
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    state.user = null;
    state.path = entry;
    state.navigate.mockReset();
    state.toast.mockReset();
    state.api.mockReset();
    state.api.mockImplementation(async (method, url) =>
      method === "POST" ? { id: "request-saved" } : []
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, queryFn: async () => [] },
        mutations: { retry: false },
      },
    });
  });
  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    mounted = false;
    client.clear();
    container.remove();
    vi.restoreAllMocks();
  });
  async function mount(props: any = initialProps) {
    state.path = props.entryLocation;
    window.history.replaceState({}, "", props.entryLocation);
    root = createRoot(container);
    mounted = true;
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <DirectConnectRequestComposer {...props} />
        </QueryClientProvider>
      );
    });
  }
  async function unmount() {
    await act(async () => root.unmount());
    mounted = false;
  }
  async function click(text: string) {
    const button = Array.from(container.querySelectorAll("button")).find(
      (node) => node.textContent?.trim() === text
    );
    if (!button) throw new Error(`Missing button: ${text}`);
    await act(async () => button.click());
  }
  function field(value: string) {
    return Array.from(
      container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea")
    ).find((node) => node.value === value)!;
  }
  async function change(node: HTMLInputElement | HTMLTextAreaElement, value: string) {
    expect(node).toBeTruthy();
    await act(async () => {
      const prototype =
        node instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(node, value);
      node.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function send() {
    await click("Review request");
    await click(state.user ? "Review request details" : "Sign in to send");
    await click("Send to Bayou Roofing");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  function drafts() {
    return Object.keys(sessionStorage).filter((key) =>
      key.includes("direct-connect-composer-draft")
    );
  }

  it("restores guest edits after sign-in and sends the edited payload to the original business and county", async () => {
    await mount();
    await change(field("Original roof"), "Repair the porch roof");
    await change(
      field("Original repair details"),
      "Water enters above the porch after heavy rain. Please inspect next week."
    );
    await send();
    expect(state.api).not.toHaveBeenCalledWith("POST", expect.anything(), expect.anything());
    expect(
      new URL(state.navigate.mock.calls.at(-1)![0], "https://test.local").searchParams.get("next")
    ).toBe(entry);
    await unmount();
    state.user = account;
    await mount();
    expect(field("Repair the porch roof")).toBeTruthy();
    expect(sessionStorage.getItem("ts_direct_connect_draft_v1")).toBeNull();
    expect(drafts()).toHaveLength(1);
    await send();
    expect(state.api).toHaveBeenCalledWith(
      "POST",
      "/api/direct-connect/requests",
      expect.objectContaining({
        title: "Repair the porch roof",
        description: "Water enters above the porch after heavy rain. Please inspect next week.",
        targetProfileSlug: "bayou-roofing",
        countyFips: "22105",
        stateCode: "LA",
        autoRoute: false,
      })
    );
    expect(drafts()).toHaveLength(0);
  });

  it("keeps edits and deliberate deletions on immediate remount without waiting for autosave", async () => {
    state.user = account;
    await mount();
    await change(field("Original roof"), "Edited roof");
    await change(field("Original repair details"), "");
    await unmount();
    await mount();
    expect(field("Edited roof")).toBeTruthy();
    expect(container.querySelector("textarea")?.value).toBe("");
  });

  it("keeps separate county drafts and never hydrates them into another account", async () => {
    state.user = account;
    await mount();
    await change(field("Original roof"), "Tangipahoa repair");
    await unmount();
    const other = {
      ...initialProps,
      entryLocation: entry.replace("22105", "22063"),
      defaultCountyFips: "22063",
    };
    await mount(other);
    expect(field("Original roof")).toBeTruthy();
    await change(field("Original roof"), "Livingston repair");
    await unmount();
    await mount();
    expect(field("Tangipahoa repair")).toBeTruthy();
    await unmount();
    state.user = { ...account, id: "requester-2" };
    await mount();
    expect(field("Original roof")).toBeTruthy();
  });

  it("keeps profile recovery private while signed out and restores it only for its owner after filling a missing county", async () => {
    state.user = { ...account, countyFips: "", stateCode: "" };
    const props = {
      ...initialProps,
      entryLocation: "/direct-connect?profile=bayou-roofing",
      defaultCountyFips: undefined,
      defaultStateCode: undefined,
    };
    state.api.mockRejectedValue(
      Object.assign(new Error("Name, location, and contact info required"), {
        status: 428,
        code: "PROFILE_BASICS_REQUIRED",
      })
    );
    await mount(props);
    await change(field("Original roof"), "Keep this request");
    await send();
    const recovery = new URL(state.navigate.mock.calls.at(-1)![0], "https://test.local");
    expect(recovery.pathname).toBe("/profile-settings");
    expect(recovery.searchParams.get("next")).toBe(props.entryLocation);
    await unmount();
    state.user = null;
    await mount(props);
    expect(field("Original roof")).toBeTruthy();
    expect(field("Keep this request")).toBeUndefined();
    await unmount();
    state.user = { ...account, id: "requester-2" };
    await mount(props);
    expect(field("Original roof")).toBeTruthy();
    expect(field("Keep this request")).toBeUndefined();
    await unmount();
    state.user = account;
    await mount(props);
    expect(field("Keep this request")).toBeTruthy();
  });

  it("retains failed submissions and does not turn an unknown 428 into address verification", async () => {
    state.user = account;
    state.api.mockRejectedValue(
      Object.assign(new Error("Try again later"), { status: 428, code: "DIFFERENT_REQUIREMENT" })
    );
    await mount();
    await change(field("Original roof"), "Still here");
    await send();
    expect(state.navigate).not.toHaveBeenCalled();
    await unmount();
    await mount();
    expect(field("Still here")).toBeTruthy();
  });

  it("requires an explicit business selection for an unresolved legacy owner link", async () => {
    state.user = account;
    await mount({
      ...initialProps,
      entryLocation: "/direct-connect?target=legacy-owner",
      prefillContextType: undefined,
      prefillContextId: undefined,
      prefillTargetUserId: "legacy-owner",
    });
    await click("Review request");
    await click("Review request details");
    await click("Send when ready");
    expect(container.textContent).toContain("This older link does not identify a business.");
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(
      buttons.find((node) => node.textContent === "Continue without selection")?.disabled
    ).toBe(true);
    expect(buttons.find((node) => node.textContent === "Send with my selection")?.disabled).toBe(
      true
    );
    expect(state.api.mock.calls.some(([method]) => method === "POST")).toBe(false);
  });
});
