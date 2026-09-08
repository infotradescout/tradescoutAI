// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddressVerification from "./address-verification";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  user: { id: "member-1" } as any,
  status: {} as any,
  api: vi.fn(),
  upload: vi.fn(),
  toast: vi.fn(),
  navigate: vi.fn(),
  path: "",
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: state.user, isAuthenticated: Boolean(state.user) }),
}));
vi.mock("@/lib/queryClient", () => ({ apiRequest: (...args: any[]) => state.api(...args) }));
vi.mock("@/lib/privateObjectUpload", () => ({
  uploadPrivateObject: (...args: any[]) => state.upload(...args),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("wouter", () => ({ useLocation: () => [state.path, state.navigate] }));
const requestPath = "/direct-connect?county=22105&profile=bayou-roofing";
const uploadKey = "private/member-1/123e4567-e89b-12d3-a456-426614174000";

describe("address document verification journey", () => {
  let root: Root;
  let container: HTMLDivElement;
  let client: QueryClient;
  beforeEach(() => {
    state.user = { id: "member-1" };
    state.status = { verification: null, isVerified: false };
    state.path = `/address-verification?next=${encodeURIComponent(requestPath)}`;
    window.history.replaceState({}, "", state.path);
    state.api.mockReset();
    state.upload.mockReset();
    state.toast.mockReset();
    state.navigate.mockReset();
    state.upload.mockResolvedValue({ objectKey: uploadKey });
    state.api.mockImplementation(async (method) => {
      if (method === "GET") return structuredClone(state.status);
      state.status = {
        verification: { id: "verification-1", status: "submitted", hasDocument: true },
        isVerified: false,
      };
      return { id: "verification-1", status: "submitted" };
    });
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
  async function render() {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <AddressVerification />
        </QueryClientProvider>
      )
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  async function fill() {
    for (const [field, value] of Object.entries({
      fullAddress: "123 Main Street",
      city: "Hammond",
      state: "LA",
      zipCode: "70401",
    })) {
      const input = container.querySelector<HTMLInputElement>(`#address-${field}`)!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
          input,
          value
        );
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
  }
  async function choose(
    file = new File(["%PDF-1.7 Synthetic address document"], "address.pdf", {
      type: "application/pdf",
    })
  ) {
    const input = container.querySelector<HTMLInputElement>("#address-document")!;
    await act(async () => {
      Object.defineProperty(input, "files", { configurable: true, value: [file] });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return file;
  }
  async function submit() {
    await act(async () =>
      container
        .querySelector<HTMLFormElement>("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  const posts = () =>
    state.api.mock.calls.filter(([method]) => method === "POST" || method === "PUT");
  it("requires a real selected document and sends only member fields after private upload", async () => {
    await render();
    await fill();
    await submit();
    expect(state.upload).not.toHaveBeenCalled();
    expect(posts()).toHaveLength(0);
    expect(container.textContent).toContain("before submitting");
    const file = await choose();
    await submit();
    expect(state.upload).toHaveBeenCalledWith(file);
    expect(posts()).toEqual([
      [
        "POST",
        "/api/address-verification",
        {
          fullAddress: "123 Main Street",
          city: "Hammond",
          state: "LA",
          zipCode: "70401",
          verificationMethod: "utility_bill",
          documentUrl: uploadKey,
          documentType: "application/pdf",
        },
      ],
    ]);
    expect(container.textContent).toContain("Document submitted for review");
    expect(container.textContent).toContain("Your address is not verified yet.");
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).not.toContain("Postcard Sent");
  });
  it("keeps the form through upload and submission failures and reuses a completed upload on retry", async () => {
    await render();
    await fill();
    await choose();
    state.upload.mockRejectedValueOnce(new Error("Upload failed"));
    await submit();
    expect(posts()).toHaveLength(0);
    expect(container.querySelector<HTMLInputElement>("#address-fullAddress")!.value).toBe(
      "123 Main Street"
    );
    state.api.mockImplementation(async (method) => {
      if (method === "POST") throw new Error("Submission failed");
      return state.status;
    });
    await submit();
    await submit();
    expect(state.upload).toHaveBeenCalledTimes(2);
    expect(posts()).toHaveLength(2);
    expect(container.querySelector("form")).toBeTruthy();
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
  it("does not submit an upload after the authenticated account changes", async () => {
    let resolveUpload!: (value: any) => void;
    state.upload.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      })
    );
    await render();
    await fill();
    await choose();
    await submit();
    state.user = { id: "member-2" };
    await render();
    await act(async () => resolveUpload({ objectKey: uploadKey }));
    expect(posts()).toHaveLength(0);
  });
  it("offers document resubmission for a rejected legacy postcard record without requesting mail", async () => {
    state.status.verification = {
      id: "verification-1",
      status: "rejected",
      hasDocument: false,
      fullAddress: "123 Main Street",
      city: "Hammond",
      state: "LA",
      zipCode: "70401",
      verificationMethod: "postcard",
      rejectionReason: "Show your current address",
    };
    await render();
    expect(container.textContent).toContain("Show your current address");
    expect(container.querySelector<HTMLOptionElement>('option[value="postcard"]')!.disabled).toBe(
      true
    );
    await choose();
    await submit();
    expect(posts()[0][0]).toBe("PUT");
    expect(posts()[0][1]).toBe("/api/address-verification/verification-1");
    expect(posts()[0][2].verificationMethod).toBe("utility_bill");
    expect(state.api.mock.calls.some(([, url]) => url.includes("postcard"))).toBe(false);
  });
  it("returns to the exact saved request and never equates address approval with unrestricted access", async () => {
    state.status.isVerified = true;
    await render();
    expect(container.textContent).toContain("Address verified");
    expect(container.textContent).not.toContain("full access");
    const button = Array.from(container.querySelectorAll("button")).find(
      (node) => node.textContent === "Return to saved request"
    )!;
    await act(async () => button.click());
    expect(state.navigate).toHaveBeenCalledWith(requestPath);
  });
  it("rejects unsupported file types before uploading", async () => {
    await render();
    await fill();
    await choose(new File(["<html>"], "address.html", { type: "text/html" }));
    expect(container.textContent).toContain("Choose a PDF, JPG, or PNG document.");
    await submit();
    expect(state.upload).not.toHaveBeenCalled();
  });
});
