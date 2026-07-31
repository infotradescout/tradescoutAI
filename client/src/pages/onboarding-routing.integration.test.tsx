// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n";
import Onboarding from "./onboarding";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), refetch: vi.fn() }));

function onboardingRequest(body: Record<string, unknown>) {
  return ["/api/onboarding/complete", { method: "POST", body, timeoutMs: 130_000 }] as const;
}

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", onboardingCompleted: false },
    isAuthenticated: true,
    isLoading: false,
    refetch: mocks.refetch,
  }),
}));

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...actual, apiRequest: mocks.apiRequest };
});

vi.mock("@/lib/objectUpload", () => ({ uploadObject: vi.fn() }));

function setTextareaValue(control: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("onboarding browser-history continuation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.refetch.mockReset().mockResolvedValue(undefined);
    window.sessionStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    window.history.replaceState(
      {},
      "",
      "/onboarding?next=%2Fprojects%2Fproject-77%3Ftab%3Destimates%23latest"
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("reads the exact query continuation with the real wouter browser location hook", async () => {
    mocks.apiRequest.mockResolvedValue({
      success: true,
      result: {
        kind: "express_result",
        resultRoute: "/projects/project-77?tab=estimates#latest",
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <Onboarding />
          </I18nProvider>
        </QueryClientProvider>
      );
    });

    setTextareaValue(
      container.querySelector<HTMLTextAreaElement>('[data-testid="onboarding-goal"]')!,
      "Open my estimate"
    );
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      ...onboardingRequest({
        kind: "express_result",
        goal: "Open my estimate",
        next: "/projects/project-77?tab=estimates#latest",
      })
    );
  });
});
