// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { JwStoneEmployeeReceiving } from "./JwStoneEmployeeReceiving";

const viewer = vi.hoisted(() => ({
  id: "",
  allowed: false,
  responseViewer: "",
  error: null as any,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: viewer.id ? { id: viewer.id } : null }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) =>
    options.queryKey[1] === "receiving-access"
      ? {
          data: {
            viewerId: viewer.responseViewer,
            allowed: viewer.allowed,
            enabled: true,
            canManageStaff: true,
          },
          error: viewer.error,
        }
      : { data: { viewerId: viewer.id, items: [], accounts: [] } },
  useQueryClient: () => ({ invalidateQueries() {} }),
}));
vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
  ApiError: class extends Error {
    constructor(
      message: string,
      public status: number
    ) {
      super(message);
    }
  },
}));
vi.mock("./jwStoneReceivingDraftStore", () => ({
  readReceivingDraft: async () => ({ revision: 0, draft: null }),
  writeReceivingDraft: async () => 1,
}));
// Import latency is tested separately; execute the actual authorized tools and
// receiving workspace here alongside Radix's real focus/pointer ownership.
vi.mock("./JwStoneEmployeeToolsLoader", async () => ({
  JwStoneEmployeeToolsLoader: (await import("./JwStoneEmployeeTools")).default,
}));

let root: Root, host: HTMLDivElement;
function Harness() {
  const [accountOpen, setAccountOpen] = useState(true);
  return (
    <>
      <JwStoneEmployeeReceiving onEnter={() => setAccountOpen(false)} />
      <button onClick={() => setAccountOpen(true)}>Open account</button>
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent data-testid="account-dialog">
          <DialogTitle>Fabricator Portal</DialogTitle>
          <DialogDescription>Sign in to your account.</DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}
const render = () =>
  act(async () => {
    root.render(<Harness />);
  });
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  viewer.id = "";
  viewer.allowed = false;
  viewer.responseViewer = "";
  viewer.error = null;
  // jsdom lacks native top-layer behavior. Keep the actual workspace lifecycle;
  // verify the real Radix body lock rather than imitating browser pointer input.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  vi.restoreAllMocks();
});

describe("JW account modal to employee receiving handoff", () => {
  it("releases the real account-modal pointer lock when employee sign-in mounts receiving", async () => {
    await render();
    expect(document.querySelector('[data-testid="account-dialog"]')).not.toBeNull();
    expect(document.body.style.pointerEvents).toBe("none");
    viewer.id = "owner";
    viewer.responseViewer = "owner";
    viewer.allowed = true;
    await render();
    expect(document.querySelector('[data-testid="account-dialog"]')).toBeNull();
    expect(document.body.style.pointerEvents).not.toBe("none");
    const receiving = document.querySelector<HTMLDialogElement>(
      'dialog[aria-labelledby="jw-receiving-title"]'
    );
    expect(receiving?.open).toBe(true);
    expect(document.querySelector<HTMLInputElement>('[name="materialName"]')?.disabled).toBe(false);
    expect(document.body.textContent).toContain("Manage employee access");
  });

  it("leaves the portal usable for ordinary buyers and rejects mismatched employee data", async () => {
    for (const allowed of [false, true]) {
      viewer.id = "buyer";
      viewer.responseViewer = allowed ? "former-owner" : "buyer";
      viewer.allowed = allowed;
      await render();
      expect(document.querySelector('[data-testid="account-dialog"]')).not.toBeNull();
      expect(document.querySelector('dialog[aria-labelledby="jw-receiving-title"]')).toBeNull();
    }
  });

  it("does not repeatedly close an employee's account form on refresh or clear their receiving draft", async () => {
    viewer.id = "owner";
    viewer.responseViewer = "owner";
    viewer.allowed = true;
    await render();
    const receiving = document.querySelector<HTMLDialogElement>(
      'dialog[aria-labelledby="jw-receiving-title"]'
    )!;
    await act(async () => {
      receiving.close();
    });
    // Select by visible purpose, independent of the receiving workspace's buttons.
    await act(async () => {
      [...host.querySelectorAll("button")]
        .find((button) => button.textContent === "Open account")!
        .click();
    });
    await render();
    expect(document.querySelector('[data-testid="account-dialog"]')).not.toBeNull();
    expect(document.querySelector('dialog[aria-labelledby="jw-receiving-title"]')).toBe(receiving);
    expect(receiving.open).toBe(false);
  });
});
