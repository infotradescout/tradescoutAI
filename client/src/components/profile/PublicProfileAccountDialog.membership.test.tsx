// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  policy: { requiredIdentity: "business", profileSlug: "jw-stone" },
  viewerBusiness: { id: "business-1", name: "Member Business", verificationStatus: "approved" },
  requiresBusinessSetup: false,
  account: null,
  entitlements: [],
}));
const createAccount = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "member-1" },
    isAuthenticated: true,
    refetch: vi.fn(),
  }),
}));
vi.mock("./profileAccountClient", async (original) => ({
  ...(await original<typeof import("./profileAccountClient")>()),
  loadProfileAccountState: vi.fn(async () => state),
  createProfileAccount: createAccount,
}));
vi.mock("@/components/ui/dialog", () => {
  const Element = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Element,
    DialogContent: Element,
    DialogDescription: Element,
    DialogHeader: Element,
    DialogTitle: Element,
  };
});
import { PublicProfileAccountDialog } from "./PublicProfileAccountDialog";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const container = document.createElement("div");
const root = createRoot(container);
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it("notifies the stone page when an existing signed-in business creates its membership", async () => {
  const ready = {
    ...state,
    account: { id: "membership-1", status: "active", verificationStatus: "approved" },
  };
  createAccount.mockResolvedValue(ready);
  const onAccountChange = vi.fn();
  await act(async () => {
    root.render(
      <PublicProfileAccountDialog
        open
        onOpenChange={() => undefined}
        profileSlug="jw-stone"
        profileName="JW Stone"
        onAccountChange={onAccountChange}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(createAccount).toHaveBeenCalledOnce();
  expect(onAccountChange).toHaveBeenCalledWith(ready);
});
