// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Verification from "./verification";
import CheckEmail from "./check-email";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  user: null as any,
  path: "",
  navigate: vi.fn(),
  refetch: vi.fn(),
  apiRequest: vi.fn(),
  useQuery: vi.fn(() => ({ data: undefined, isLoading: false })),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: state.user,
    isAuthenticated: Boolean(state.user),
    isLoading: false,
    refetch: state.refetch,
  }),
}));
vi.mock("@/lib/queryClient", () => ({ apiRequest: state.apiRequest }));
vi.mock("@tanstack/react-query", () => ({ useQuery: state.useQuery }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("wouter", () => ({
  useLocation: () => [state.path, state.navigate],
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const recommendationPath = "/u/acme-repair?trustAction=recommend";
const verificationPath = `/verification?next=${encodeURIComponent(recommendationPath)}`;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  state.path = verificationPath;
  window.history.replaceState({}, "", verificationPath);
  state.user = {
    id: "reviewer",
    email: "neighbor@example.test",
    emailVerified: false,
    onboardingCompleted: false,
  };
  state.navigate.mockReset();
  state.apiRequest
    .mockReset()
    .mockResolvedValue({ message: "If an account exists, a link was sent." });
  state.refetch.mockReset().mockResolvedValue({ data: state.user });
  state.useQuery.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function clickButton(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (node) => node.textContent === label
  );
  expect(button, label).toBeTruthy();
  await act(async () => button!.click());
}

describe("action-specific recommendation email confirmation", () => {
  it("shows only email ownership and preserves the exact recommendation in the confirmation request", async () => {
    await act(async () => root.render(<Verification />));
    expect(container.textContent).toContain("Confirm your email to share your recommendation");
    expect(container.textContent).toContain("Confirm email ownership");
    expect(state.useQuery).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("address verification");
    expect(container.textContent).not.toContain("Professional status");
    expect(state.apiRequest).not.toHaveBeenCalled();
    await clickButton("Send confirmation email");
    expect(state.apiRequest).toHaveBeenCalledWith("POST", "/api/auth/request-email-verification", {
      email: "neighbor@example.test",
      next: recommendationPath,
    });
    expect(container.textContent).toContain("Confirmation requested.");
  });

  it("does not treat clicking the confirmation button as verified", async () => {
    await act(async () => root.render(<Verification />));
    await clickButton("I confirmed my email");
    expect(state.navigate).not.toHaveBeenCalled();
    expect(container.textContent).toContain("still awaiting confirmation");
    state.refetch.mockResolvedValue({ data: { ...state.user, emailVerified: true } });
    await clickButton("I confirmed my email");
    expect(state.navigate).toHaveBeenCalledWith(recommendationPath);
  });

  it("keeps failed delivery actionable without claiming the email was sent", async () => {
    state.apiRequest.mockRejectedValue(
      new Error("Confirmation email is unavailable. Try again later.")
    );
    await act(async () => root.render(<Verification />));
    await clickButton("Send confirmation email");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("unavailable");
    expect(container.textContent).not.toContain("Confirmation requested.");
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it("uses the actual authenticated email state after returning from another tab", async () => {
    await act(async () => root.render(<Verification />));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(state.refetch).toHaveBeenCalledTimes(1);
    expect(state.apiRequest).not.toHaveBeenCalled();
    state.user = { ...state.user, emailVerified: true };
    await act(async () => root.render(<Verification />));
    expect(container.textContent).toContain("Email confirmed");
    expect(container.textContent).not.toContain("Confirm email ownership");
    await clickButton("Return to recommendation");
    expect(state.navigate).toHaveBeenCalledWith(recommendationPath);
  });

  it("retains context in both guest account options", async () => {
    state.user = null;
    await act(async () => root.render(<Verification />));
    for (const link of container.querySelectorAll<HTMLAnchorElement>("a")) {
      expect(new URL(link.href).searchParams.get("next")).toBe(verificationPath);
    }
    expect(container.querySelectorAll("a")).toHaveLength(2);
  });

  it("checks real email status on the existing check-email recovery page", async () => {
    state.path = `/check-email?email=neighbor%40example.test&next=${encodeURIComponent(recommendationPath)}`;
    window.history.replaceState({}, "", state.path);
    await act(async () => root.render(<CheckEmail />));
    await clickButton("I verified my email");
    expect(state.navigate).not.toHaveBeenCalled();
    expect(container.textContent).toContain("still awaiting confirmation");
    state.refetch.mockResolvedValue({ data: { ...state.user, emailVerified: true } });
    await clickButton("I verified my email");
    expect(state.navigate).toHaveBeenCalledWith(recommendationPath);
  });
});
