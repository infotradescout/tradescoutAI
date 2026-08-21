// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n";
import { ApiError } from "@/lib/queryClient";
import {
  readOutcomeOnboardingClaimContinuation,
  storeOutcomeOnboardingClaimContinuation,
} from "@/lib/outcomeOnboardingClaimContinuation";
import Onboarding from "./onboarding";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => ({
  user: { id: "user-1", onboardingCompleted: false } as Record<string, any>,
  location: "/onboarding",
  navigate: vi.fn(),
  apiRequest: vi.fn(),
  uploadObject: vi.fn(),
  refetch: vi.fn(),
}));

function onboardingRequest(body: Record<string, unknown>) {
  return ["/api/onboarding/complete", { method: "POST", body, timeoutMs: 130_000 }] as const;
}

vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return {
    ...actual,
    useLocation: () => [mocks.location, mocks.navigate] as const,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mocks.user,
    isAuthenticated: true,
    isLoading: false,
    refetch: mocks.refetch,
  }),
}));

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...actual, apiRequest: mocks.apiRequest };
});

vi.mock("@/lib/objectUpload", () => ({
  uploadObject: mocks.uploadObject,
}));

function setControlValue(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function setSelectValue(control: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function flushUi() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("universal outcome-first onboarding", () => {
  let container: HTMLDivElement;
  let root: Root;
  let createObjectUrlDescriptor: PropertyDescriptor | undefined;
  let revokeObjectUrlDescriptor: PropertyDescriptor | undefined;

  const renderOnboarding = () => {
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
  };

  beforeEach(() => {
    mocks.user = { id: "user-1", onboardingCompleted: false };
    mocks.location = "/onboarding";
    mocks.navigate.mockReset();
    mocks.apiRequest.mockReset();
    mocks.uploadObject.mockReset();
    mocks.refetch.mockReset();
    mocks.refetch.mockResolvedValue(undefined);
    window.sessionStorage.clear();
    window.localStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((file: File) => `blob:${file.name}`),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (createObjectUrlDescriptor) {
      Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
    } else {
      Reflect.deleteProperty(URL, "createObjectURL");
    }
    if (revokeObjectUrlDescriptor) {
      Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
    } else {
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
    vi.unstubAllGlobals();
  });

  it("starts with one required goal and reveals business evidence inline", () => {
    renderOnboarding();

    expect(container.querySelector('[data-testid="onboarding-goal"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="business-switch"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="business-name"]')).toBeNull();
    expect(container.textContent).toContain("Scout will help complete the profile.");

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
    });
    expect(container.textContent).toContain(
      "Tell us the result you want so Scout knows where to take you."
    );
    expect(mocks.apiRequest).not.toHaveBeenCalled();

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="business-switch"]')?.click();
    });

    expect(container.querySelector('[data-testid="business-name"]')).not.toBeNull();
    expect(container.textContent).toContain("Share what you already have");
    expect(container.textContent).toContain("Every field below is optional.");
    expect(container.textContent).toContain("Contact remains protected through Direct Connect");
    expect(container.textContent).toContain("Scout uses only the material you provide");
    expect(container.textContent).not.toContain("Selective Intelligence");
    expect(container.textContent).not.toContain("What should TradeScout remember for you?");
  });

  it("recovers a committed express result after its original response was lost", async () => {
    mocks.user = {
      id: "user-1",
      onboardingCompleted: true,
      preferences: {
        onboardingOutcome: {
          kind: "express_result",
          goal: "Find a mobile mechanic today",
          resultRoute: "/scout?source=onboarding_result",
        },
      },
    };
    renderOnboarding();
    await flushUi();

    expect(window.sessionStorage.getItem("ts_onboarding_result_prompt")).toBe(
      "Find a mobile mechanic today"
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/scout?source=onboarding_result");
  });

  it("sends express intent and preserves the returned deep result exactly", async () => {
    mocks.location = "/onboarding?next=%2Fexchange%2Fitems%2Fitem-42%3Fmode%3Dbuy";
    window.sessionStorage.setItem("ts_onboarding_next", "/projects/stale-project");
    mocks.apiRequest.mockResolvedValue({
      success: true,
      result: {
        kind: "express_result",
        resultRoute: "/exchange/items/item-42?mode=buy",
      },
    });
    renderOnboarding();
    expect(window.sessionStorage.getItem("ts_onboarding_next")).toBeNull();

    setControlValue(
      container.querySelector<HTMLTextAreaElement>('[data-testid="onboarding-goal"]')!,
      "Find a mobile mechanic today"
    );
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
    });
    await flushUi();

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      ...onboardingRequest({
        kind: "express_result",
        goal: "Find a mobile mechanic today",
        next: "/exchange/items/item-42?mode=buy",
      })
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/exchange/items/item-42?mode=buy");
  });

  it("uploads multiple photos and asks only for missing business identity from the server", async () => {
    mocks.uploadObject
      .mockResolvedValueOnce({ publicUrl: "/objects/front.jpg", rawUploadUrl: "/raw/front" })
      .mockResolvedValueOnce({ publicUrl: "/objects/work.jpg", rawUploadUrl: "/raw/work" });
    mocks.apiRequest.mockRejectedValue(
      new ApiError("Business identity required", {
        code: "BUSINESS_IDENTITY_REQUIRED",
        status: 422,
      })
    );
    renderOnboarding();

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="business-switch"]')?.click();
    });
    setControlValue(
      container.querySelector<HTMLTextAreaElement>('[data-testid="onboarding-goal"]')!,
      "Populate my public profile"
    );

    const photoInput = container.querySelector<HTMLInputElement>(
      '[data-testid="business-photos"]'
    )!;
    const files = [
      new File(["front"], "front.jpg", { type: "image/jpeg" }),
      new File(["work"], "work.jpg", { type: "image/jpeg" }),
    ];
    Object.defineProperty(photoInput, "files", { configurable: true, value: files });
    await act(async () => {
      photoInput.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent?.match(/Ready/g)).toHaveLength(2);
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
    });
    await flushUi();

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      ...onboardingRequest({
        kind: "business_profile",
        goal: "Populate my public profile",
        business: { photoUrls: ["/objects/front.jpg", "/objects/work.jpg"] },
      })
    );
    expect(container.textContent).toContain(
      "We need only a business name to create a new profile."
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("uses and clears the stored continuation when an auth return loses its query", async () => {
    window.sessionStorage.setItem(
      "ts_onboarding_next",
      "/projects/project-77?tab=estimates#latest"
    );
    mocks.apiRequest.mockResolvedValue({
      success: true,
      result: {
        kind: "express_result",
        resultRoute: "/projects/project-77?tab=estimates#latest",
      },
    });
    renderOnboarding();

    expect(window.sessionStorage.getItem("ts_onboarding_next")).toBeNull();
    setControlValue(
      container.querySelector<HTMLTextAreaElement>('[data-testid="onboarding-goal"]')!,
      "Continue my estimate"
    );
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
    });
    await flushUi();

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      ...onboardingRequest({
        kind: "express_result",
        goal: "Continue my estimate",
        next: "/projects/project-77?tab=estimates#latest",
      })
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/projects/project-77?tab=estimates#latest");
  });

  it("hands an express goal to Scout without putting it in the URL", async () => {
    mocks.apiRequest.mockResolvedValue({
      success: true,
      result: {
        kind: "express_result",
        resultRoute: "/scout?source=onboarding_result",
        resultPrompt: "Find a mobile mechanic today",
      },
    });
    renderOnboarding();

    setControlValue(
      container.querySelector<HTMLTextAreaElement>('[data-testid="onboarding-goal"]')!,
      "Find a mobile mechanic today"
    );
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
    });
    await flushUi();

    expect(window.sessionStorage.getItem("ts_onboarding_result_prompt")).toBe(
      "Find a mobile mechanic today"
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/scout?source=onboarding_result");
    expect(String(mocks.navigate.mock.calls.at(-1)?.[0])).not.toContain("Find");
  });

  it("preserves business intake before the exact claims-first handoff", async () => {
    mocks.apiRequest.mockResolvedValue({
      success: true,
      result: {
        kind: "business_claim_required",
        resultRoute: "/claim-my-business?source=outcome_onboarding_match&businessId=directory-1",
        claim: { businessId: "directory-1", name: "Acme Works", slug: "acme-works" },
      },
    });
    renderOnboarding();
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="business-switch"]')?.click();
    });
    setControlValue(
      container.querySelector<HTMLTextAreaElement>('[data-testid="onboarding-goal"]')!,
      "Build my Acme profile"
    );
    setControlValue(
      container.querySelector<HTMLInputElement>('[data-testid="business-name"]')!,
      "Acme Works"
    );
    setControlValue(
      container.querySelector<HTMLTextAreaElement>("#business-notes")!,
      "Family-run repair shop"
    );
    setControlValue(
      container.querySelector<HTMLTextAreaElement>("#business-services")!,
      "Repair\nInstallation"
    );

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
    });
    await flushUi();

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/claim-my-business?source=outcome_onboarding_match&businessId=directory-1"
    );
    expect(readOutcomeOnboardingClaimContinuation()).toMatchObject({
      businessId: "directory-1",
      goal: "Build my Acme profile",
      business: {
        name: "Acme Works",
        notes: "Family-run repair shop",
        services: ["Repair", "Installation"],
      },
    });
    expect(mocks.refetch).not.toHaveBeenCalled();
  });

  it("bounds rich service and link evidence before the API boundary", async () => {
    mocks.apiRequest.mockResolvedValue({
      success: true,
      result: { kind: "business_profile", resultRoute: "/u/rich-works?edit=1" },
    });
    renderOnboarding();
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="business-switch"]')?.click();
    });
    setControlValue(
      container.querySelector<HTMLTextAreaElement>('[data-testid="onboarding-goal"]')!,
      "Build my rich profile"
    );
    setControlValue(
      container.querySelector<HTMLInputElement>('[data-testid="business-name"]')!,
      "Rich Works"
    );
    setControlValue(
      container.querySelector<HTMLTextAreaElement>("#business-services")!,
      [`${"x".repeat(181)}`, ...Array.from({ length: 55 }, (_, i) => `Service ${i + 1}`)].join("\n")
    );
    setControlValue(
      container.querySelector<HTMLTextAreaElement>("#business-links")!,
      [
        `${"https://example.com/"}${"x".repeat(2_000)}`,
        ...Array.from({ length: 25 }, (_, i) => `https://example.com/work-${i + 1}`),
      ].join("\n")
    );
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
    });
    await flushUi();

    const body = mocks.apiRequest.mock.calls[0]?.[1]?.body;
    expect(body.business.services).toHaveLength(50);
    expect(body.business.links).toHaveLength(20);
    expect(body.business.services.every((item: string) => item.length <= 180)).toBe(true);
    expect(body.business.links.every((item: string) => item.length <= 2_000)).toBe(true);
  });

  it("hands duplicate unclaimed matches to a scoped claim search without choosing one", async () => {
    mocks.apiRequest.mockResolvedValue({
      success: true,
      result: {
        kind: "business_claim_required",
        resultRoute: "/claim-my-business?source=outcome_onboarding_match&q=Acme+Works",
        claim: { name: "Acme Works" },
      },
    });
    renderOnboarding();
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="business-switch"]')?.click();
    });
    setControlValue(
      container.querySelector<HTMLTextAreaElement>('[data-testid="onboarding-goal"]')!,
      "Build my Acme profile"
    );
    setControlValue(
      container.querySelector<HTMLInputElement>('[data-testid="business-name"]')!,
      "Acme Works"
    );
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
    });
    await flushUi();

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/claim-my-business?source=outcome_onboarding_match&q=Acme+Works"
    );
    expect(readOutcomeOnboardingClaimContinuation()).toMatchObject({
      claimQuery: "Acme Works",
      goal: "Build my Acme profile",
      business: { name: "Acme Works" },
    });
  });

  it("auto-resumes the preserved intake against the newly claimed business before profile handoff", async () => {
    storeOutcomeOnboardingClaimContinuation({
      businessId: "directory-1",
      goal: "Build my Acme profile",
      next: "/projects/project-9",
      business: {
        name: "Acme Works",
        notes: "Family-run repair shop",
        services: ["Repair", "Installation"],
        links: ["https://acme.com/"],
        photoUrls: ["/objects/acme.jpg"],
      },
    });
    mocks.location = "/onboarding?resumeClaimedBusinessId=directory-1";
    mocks.apiRequest.mockResolvedValue({
      success: true,
      result: {
        kind: "business_profile",
        resultRoute: "/u/acme-works?edit=1",
        profile: {
          id: "profile-1",
          slug: "acme-works",
          businessId: "directory-1",
          saved: true,
          published: true,
          discovery: "verification_gated",
        },
      },
    });

    renderOnboarding();
    await flushUi();

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      ...onboardingRequest({
        kind: "business_profile",
        goal: "Build my Acme profile",
        next: "/projects/project-9",
        business: {
          targetBusinessId: "directory-1",
          name: "Acme Works",
          notes: "Family-run repair shop",
          services: ["Repair", "Installation"],
          links: ["https://acme.com/"],
          photoUrls: ["/objects/acme.jpg"],
        },
      })
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/u/acme-works?edit=1");
    expect(readOutcomeOnboardingClaimContinuation()).toBeNull();
  });

  it("renders owned business choices inline and resubmits the selected target", async () => {
    mocks.apiRequest
      .mockRejectedValueOnce(
        new ApiError("Choose the business to update", {
          code: "BUSINESS_SELECTION_REQUIRED",
          status: 422,
          details: {
            candidates: [
              { id: "biz-a", name: "Alpha Works", slug: "alpha-works" },
              { id: "biz-b", name: "Beta Works", slug: "beta-works" },
            ],
          },
        })
      )
      .mockResolvedValueOnce({
        success: true,
        result: { kind: "business_profile", resultRoute: "/u/beta-works?edit=1" },
      });
    renderOnboarding();
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="business-switch"]')?.click();
    });
    setControlValue(
      container.querySelector<HTMLTextAreaElement>('[data-testid="onboarding-goal"]')!,
      "Update my business"
    );
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
    });
    await flushUi();

    const selector = container.querySelector<HTMLSelectElement>('[data-testid="target-business"]');
    expect(selector).not.toBeNull();
    expect(Array.from(selector!.options).map((option) => option.textContent)).toContain(
      "Beta Works (beta-works)"
    );
    setSelectValue(selector!, "biz-b");
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
    });
    await flushUi();

    expect(mocks.apiRequest).toHaveBeenLastCalledWith(
      ...onboardingRequest({
        kind: "business_profile",
        goal: "Update my business",
        business: { targetBusinessId: "biz-b", name: "Beta Works" },
      })
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/u/beta-works?edit=1");
  });

  it("clears stale business choices when the owner corrects the identity", async () => {
    mocks.apiRequest
      .mockRejectedValueOnce(
        new ApiError("Choose the business to update", {
          code: "BUSINESS_SELECTION_REQUIRED",
          status: 422,
          details: {
            candidates: [
              { id: "biz-a", name: "Alpha Works", slug: "alpha-works" },
              { id: "biz-b", name: "Beta Works", slug: "beta-works" },
            ],
          },
        })
      )
      .mockResolvedValueOnce({
        success: true,
        result: { kind: "business_profile", resultRoute: "/u/gamma-works?edit=1" },
      });
    renderOnboarding();
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="business-switch"]')?.click();
    });
    setControlValue(
      container.querySelector<HTMLTextAreaElement>('[data-testid="onboarding-goal"]')!,
      "Update my business"
    );
    setControlValue(
      container.querySelector<HTMLInputElement>('[data-testid="business-name"]')!,
      "Acme Works"
    );
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
    });
    await flushUi();
    expect(container.querySelector('[data-testid="target-business"]')).not.toBeNull();

    setControlValue(
      container.querySelector<HTMLInputElement>('[data-testid="business-name"]')!,
      "Gamma Works"
    );
    expect(container.querySelector('[data-testid="target-business"]')).toBeNull();
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
    });
    await flushUi();

    expect(mocks.apiRequest).toHaveBeenLastCalledWith(
      ...onboardingRequest({
        kind: "business_profile",
        goal: "Update my business",
        business: { name: "Gamma Works" },
      })
    );
  });

  it("renders matching profile choices inline and resubmits the selected profile", async () => {
    mocks.apiRequest
      .mockRejectedValueOnce(
        new ApiError("Choose the profile to reuse", {
          code: "BUSINESS_PROFILE_SELECTION_REQUIRED",
          status: 422,
          details: {
            candidates: [
              { id: "profile-a", displayName: "Acme Works", slug: "acme-a" },
              { id: "profile-b", displayName: "Acme Works", slug: "acme-b" },
            ],
          },
        })
      )
      .mockResolvedValueOnce({
        success: true,
        result: { kind: "business_profile", resultRoute: "/u/acme-b?edit=1" },
      });
    renderOnboarding();
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="business-switch"]')?.click();
    });
    setControlValue(
      container.querySelector<HTMLTextAreaElement>('[data-testid="onboarding-goal"]')!,
      "Finish Acme"
    );
    setControlValue(
      container.querySelector<HTMLInputElement>('[data-testid="business-name"]')!,
      "Acme Works"
    );
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
    });
    await flushUi();

    const selector = container.querySelector<HTMLSelectElement>('[data-testid="target-profile"]');
    expect(selector).not.toBeNull();
    setSelectValue(selector!, "profile-b");
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="complete-onboarding"]')?.click();
    });
    await flushUi();

    expect(mocks.apiRequest).toHaveBeenLastCalledWith(
      ...onboardingRequest({
        kind: "business_profile",
        goal: "Finish Acme",
        business: { targetProfileId: "profile-b", name: "Acme Works" },
      })
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/u/acme-b?edit=1");
  });
});
