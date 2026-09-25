// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CheckEmail from "./check-email";
import VerifyEmail from "./verify-email";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  isAuthenticated: true,
  navigate: vi.fn(),
  refetch: vi.fn(),
  apiRequest: vi.fn(),
  toast: vi.fn(),
  invalidateQueries: vi.fn(),
  refetchQueries: vi.fn(),
}));
vi.mock("wouter", () => ({ useLocation: () => [window.location.pathname, state.navigate] }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: state.isAuthenticated, refetch: state.refetch }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/lib/queryClient", () => ({
  apiRequest: state.apiRequest,
  queryClient: {
    invalidateQueries: state.invalidateQueries,
    refetchQueries: state.refetchQueries,
  },
}));

const stonePath = "/exchange/building-materials/tradescout-stone-taj-mahal?inquiry=availability&audienceState=TX&audienceCountry=US";

async function render(Component: typeof CheckEmail | typeof VerifyEmail) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Component />));
  return { container, root };
}

beforeEach(() => {
  state.isAuthenticated = true;
  state.navigate.mockReset();
  state.refetch.mockReset().mockResolvedValue({ data: { emailVerified: true } });
  state.apiRequest.mockReset().mockResolvedValue({
    message: "Email verified successfully",
    email: "buyer@example.test",
    autoLoggedIn: true,
  });
  state.toast.mockReset();
  state.invalidateQueries.mockReset();
  state.refetchQueries.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("selected stone email confirmation", () => {
  it("uses the account handoff after the same-tab check-email page confirms verification", async () => {
    window.history.replaceState({}, "", `/check-email?email=buyer%40example.test&next=${encodeURIComponent(stonePath)}`);
    const { container, root } = await render(CheckEmail);
    try {
      const button = Array.from(container.querySelectorAll("button")).find((item) =>
        item.textContent?.includes("I verified my email")
      );
      expect(button).toBeTruthy();
      await act(async () => button!.click());
      const handoff = String(state.navigate.mock.lastCall?.[0] || "");
      expect(handoff.startsWith("/pre-scout-setup?mode=signin")).toBe(true);
      expect(new URL(handoff, "https://tradescout.internal").searchParams.get("next")).toBe(stonePath);
      expect(state.navigate).not.toHaveBeenCalledWith(stonePath);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("keeps the direct stone path when resending, with no nested auth wrapper", async () => {
    window.history.replaceState({}, "", `/check-email?email=buyer%40example.test&next=${encodeURIComponent(stonePath)}`);
    const { container, root } = await render(CheckEmail);
    try {
      const button = Array.from(container.querySelectorAll("button")).find((item) =>
        item.textContent?.includes("Resend email")
      );
      expect(button).toBeTruthy();
      await act(async () => button!.click());
      expect(state.apiRequest).toHaveBeenCalledWith(
        "POST", "/api/auth/request-email-verification",
        { email: "buyer@example.test", next: stonePath }
      );
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("hands a fresh-context verification link to auth setup before stone detail can consume the draft", async () => {
    window.history.replaceState({}, "", `/verify-email?token=synthetic&next=${encodeURIComponent(stonePath)}`);
    vi.useFakeTimers();
    const { container, root } = await render(VerifyEmail);
    try {
      expect(state.apiRequest).toHaveBeenCalledWith(
        "POST", "/api/auth/verify-email", { token: "synthetic" }
      );
      await act(async () => vi.advanceTimersByTimeAsync(900));
      const handoff = String(state.navigate.mock.lastCall?.[0] || "");
      expect(handoff.startsWith("/pre-scout-setup?mode=signin")).toBe(true);
      expect(new URL(handoff, "https://tradescout.internal").searchParams.get("next")).toBe(stonePath);
      expect(state.navigate).not.toHaveBeenCalledWith(stonePath);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("does not accept an auth-loop destination from a handcrafted verification link", async () => {
    window.history.replaceState({}, "", "/verify-email?token=synthetic&next=%2Fcheck-email%3Fnext%3D%2Fscout");
    vi.useFakeTimers();
    const { container, root } = await render(VerifyEmail);
    try {
      await act(async () => vi.advanceTimersByTimeAsync(900));
      expect(state.navigate).toHaveBeenLastCalledWith("/pre-scout-setup");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
