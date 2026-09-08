// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminAddressVerifications from "./admin-address-verifications";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({ api: vi.fn(), toast: vi.fn(), hasDocument: true }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: (...args: any[]) => state.api(...args) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
// The native control isolates application state/payload behavior from Radix gestures.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select value={value} onChange={(event) => onValueChange(event.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null,
}));
const timestamp = "2026-09-01T12:00:00.000Z";
describe("address verification admin review", () => {
  let root: Root;
  let container: HTMLDivElement;
  let client: QueryClient;
  beforeEach(() => {
    state.hasDocument = true;
    state.api.mockReset();
    state.toast.mockReset();
    state.api.mockImplementation(async (method) =>
      method === "GET"
        ? [
            {
              verification: {
                id: "verification-1",
                userId: "member-1",
                fullAddress: "123 Main Street",
                city: "Hammond",
                state: "LA",
                zipCode: "70401",
                verificationMethod: "utility_bill",
                status: "submitted",
                hasDocument: state.hasDocument,
                createdAt: timestamp,
                updatedAt: timestamp,
                deadline: "2026-09-08T12:00:00.000Z",
              },
              user: {
                id: "member-1",
                email: "member@example.test",
                firstName: "Jordan",
                addressVerified: false,
              },
            },
          ]
        : { id: "verification-1", status: "approved" }
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
  });
  async function mount() {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <AdminAddressVerifications />
        </QueryClientProvider>
      )
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  function button(text: string) {
    return Array.from(document.querySelectorAll("button")).find(
      (node) => node.textContent?.trim() === text
    )!;
  }
  async function click(text: string) {
    await act(async () => button(text).click());
  }
  async function decision(value: string) {
    const select = document.querySelector<HTMLSelectElement>('[role="dialog"] select')!;
    await act(async () => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  it("links the saved private document and sends the version the admin reviewed", async () => {
    await mount();
    await click("Review");
    expect(
      document.querySelector('a[href="/api/admin/address-verifications/verification-1/document"]')
    ).toBeTruthy();
    await decision("approved");
    await click("Save decision");
    expect(state.api).toHaveBeenCalledWith(
      "PUT",
      "/api/admin/address-verifications/verification-1",
      { status: "approved", adminNotes: "", rejectionReason: "", expectedUpdatedAt: timestamp }
    );
  });
  it("cannot approve a row without saved evidence", async () => {
    state.hasDocument = false;
    await mount();
    await click("Review");
    await decision("approved");
    expect(button("Save decision").disabled).toBe(true);
    expect(document.body.textContent).toContain("No address document is attached.");
    expect(state.api.mock.calls.some(([method]) => method === "PUT")).toBe(false);
  });
  it("closes stale review details and refreshes the queue after a version conflict", async () => {
    await mount();
    await click("Review");
    await decision("approved");
    state.api.mockRejectedValueOnce(
      Object.assign(
        new Error("This submission changed. Refresh and review the current document."),
        { status: 409 }
      )
    );
    await click("Save decision");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(state.api.mock.calls.filter(([method]) => method === "GET").length).toBeGreaterThan(1);
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});
