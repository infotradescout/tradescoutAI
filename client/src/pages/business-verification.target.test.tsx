// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BusinessVerificationPage from "./business-verification";

const state = vi.hoisted(() => ({ api: vi.fn(), navigate: vi.fn(), location: "" }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("wouter", () => ({ useLocation: () => [state.location, state.navigate] }));
vi.mock("@/lib/queryClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/queryClient")>(), apiRequest: state.api,
}));
vi.mock("@/lib/privateObjectUpload", () => ({ uploadPrivateObject: vi.fn() }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const response = (overrides: Record<string, unknown> = {}) => ({
  profileId: "verification-uuid", publicProfileId: "public-profile-1", displayName: "Synthetic business",
  verificationStatus: "pending", requirements: { tax_id: true, business_registration: true },
  fieldReview: { tax_id: { status: "pending" }, business_registration: { status: "pending" } },
  submissions: {}, ...overrides,
});
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  state.location = "/business-verification?publicProfileId=public-profile-1&next=%2Fpresence%2Freview%3Fsection%3Dfacts";
  state.api.mockResolvedValue(response());
  container = document.createElement("div"); document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
async function render() {
  await act(async () => { root.render(<QueryClientProvider client={client}><BusinessVerificationPage /></QueryClientProvider>); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); });
}
async function saveLastFour() {
  const input = container.querySelector<HTMLInputElement>('input[aria-label="Last four digits of Tax ID"]')!;
  expect(input).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "4321");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "Save")!.click());
}
describe("exact public business verification target", () => {
  it("shows pending business requirements and submits the distinct public selector without aliasing verification IDs", async () => {
    await render();
    expect(state.api).toHaveBeenCalledWith("GET", "/api/profile/verification?publicProfileId=public-profile-1");
    expect(container.querySelector('[data-testid="business-verification-business_registration"]')).not.toBeNull();
    expect(container.textContent).not.toContain("No additional documents");
    await saveLastFour();
    expect(state.api).toHaveBeenCalledWith("PATCH", "/api/profile/verification", { publicProfileId: "public-profile-1", taxIdLast4: "4321" });
  });
  it("retains the existing legacy verification selector", async () => {
    state.location = "/business-verification?businessProfileId=verification-uuid";
    await render(); await saveLastFour();
    expect(state.api).toHaveBeenCalledWith("PATCH", "/api/profile/verification", { businessProfileId: "verification-uuid", taxIdLast4: "4321" });
  });
  it("refuses to submit evidence if the server resolves a different public profile", async () => {
    state.api.mockResolvedValue(response({ publicProfileId: "different-public-profile" }));
    await render();
    expect(container.textContent).toContain("Business verification is unavailable");
    expect(container.querySelector('input[aria-label="Last four digits of Tax ID"]')).toBeNull();
    expect(state.api.mock.calls.every(([method]) => method === "GET")).toBe(true);
  });
  it("returns to the preserved imported-detail review", async () => {
    await render();
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("Return to profile"))!.click());
    expect(state.navigate).toHaveBeenCalledWith("/presence/review?section=facts");
  });
  it("does not follow an external return destination", async () => {
    state.location = "/business-verification?publicProfileId=public-profile-1&next=https%3A%2F%2Foutside.invalid";
    await render();
    expect(container.textContent).not.toContain("Return to profile");
  });
  it("keeps public release pending after document approval while owner identity checks are missing", async () => {
    state.api.mockResolvedValue(response({ verificationStatus: "approved", publicReleaseVerificationSatisfied: false,
      requirements: { email: true, address: true, tax_id: true, business_registration: true },
      status: { email: false, address: false, tax_id: true, business_registration: true },
      fieldReview: { tax_id: { status: "approved" }, business_registration: { status: "approved" } },
    }));
    await render();
    expect(container.textContent).toContain("must also be complete before this business can go public");
    const emailLink = [...container.querySelectorAll<HTMLAnchorElement>("a")].find((link) => link.textContent === "Verify your email")!;
    const emailUrl = new URL(emailLink.getAttribute("href")!, "https://www.thetradescout.com");
    expect(emailUrl.pathname).toBe("/check-email");
    expect(emailUrl.searchParams.get("next")).toBe(state.location);
    expect(container.querySelector('a[href="/address-verification"]')).not.toBeNull();
    expect(container.textContent).toContain("Action needed");
  });
});
