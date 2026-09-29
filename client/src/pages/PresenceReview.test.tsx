// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/queryClient";
import PresenceReview from "./PresenceReview";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const state = vi.hoisted(() => ({
  user: { id: "owner-1", onboardingCompleted: true } as Record<string, unknown>,
  apiRequest: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: state.user, isAuthenticated: true, isLoading: false }),
}));

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...actual, apiRequest: state.apiRequest };
});

const profile = {
  id: "profile-1",
  businessId: "business-1",
  ownerUserId: "owner-1",
  slug: "sample-shop",
  displayName: "Sample Shop",
};

function plan(overrides: Record<string, unknown> = {}) {
  const digest = String(overrides.evidenceDigest || "a".repeat(64));
  const hash = String(overrides.planHash || "b".repeat(64));
  const proposal = {
    businessId: "business-1",
    profileId: "profile-1",
    evidenceDigest: digest,
    planHash: hash,
    sitePath: {
      recommended: "hosted_new",
      allowed: ["hosted_new"],
      reason: "no_existing_website",
    },
    evidenceSources: [
      { path: "$.provenance.evidence.links[0]", sourceRef: "https://example.test/" },
    ],
    quarantinedEvidence: [
      {
        path: "$.provenance.evidence.name",
        reason: "requires_owner_confirmation",
      },
    ],
    actions: [
      {
        id: "site.prepare",
        adapterAvailability: "planned",
        executable: false,
        tierNeutral: true,
        requiredGates: [{ gate: "approve_site_path", role: "Business Owner" }],
      },
    ],
  };
  return {
    businessId: "business-1",
    profileId: "profile-1",
    evidenceDigest: digest,
    planHash: hash,
    revision: Number(overrides.revision || 1),
    status: "draft",
    selectedSitePath: null,
    executionAuthorized: false,
    plan: proposal,
    ...overrides,
  };
}

function authResponse(user: Record<string, unknown> | null = { id: "owner-1" }) {
  return new Response(
    JSON.stringify(user ? { authenticated: true, user } : { authenticated: false }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function flushUi() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("customer presence review", () => {
  let root: Root;
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state.user = { id: "owner-1", onboardingCompleted: true };
    state.apiRequest.mockReset();
    fetchMock = vi.fn(async () => authResponse());
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function mount() {
    await act(async () => root.render(<PresenceReview />));
    await flushUi();
  }

  async function chooseAndSave() {
    await act(async () => {
      container
        .querySelector<HTMLInputElement>('[data-testid="presence-choice-hosted_new"]')!
        .click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="presence-review-save"]')!.click();
    });
    await flushUi();
  }

  it("probes fresh auth before plan load and saves only the exact displayed site path", async () => {
    let releaseAuth!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          releaseAuth = resolve;
        })
    );
    const original = plan();
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/plan")
        return { success: true, plan: original };
      if (method === "GET" && path === "/api/profiles") return [profile];
      if (method === "POST" && path === "/api/presence/plan/review") {
        return {
          success: true,
          plan: {
            ...original,
            status: "site_path_selected",
            selectedSitePath: "hosted_new",
          },
        };
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    await mount();
    expect(state.apiRequest).not.toHaveBeenCalled();
    await act(async () => releaseAuth(authResponse()));
    await flushUi();
    expect(container.textContent).toContain("Sample Shop");
    expect(container.textContent).toContain("Business name");
    expect(container.textContent).toContain("Business source link");
    expect(container.textContent).toContain("Suggested because no current website is listed.");
    expect(container.textContent).not.toContain("$.provenance");
    expect(container.textContent).toContain("https://example.test/");
    expect(container.textContent).toContain("No step runs from this page");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      credentials: "include",
      cache: "no-store",
      redirect: "error",
    });

    await chooseAndSave();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state.apiRequest).toHaveBeenCalledWith("POST", "/api/presence/plan/review", {
      expectedDigest: "a".repeat(64),
      expectedPlanHash: "b".repeat(64),
      expectedRevision: 1,
      sitePath: "hosted_new",
    });
    expect(state.apiRequest.mock.calls.map((call) => `${call[0]} ${call[1]}`)).toEqual([
      "GET /api/presence/plan",
      "GET /api/profiles",
      "POST /api/presence/plan/review",
    ]);
    const saved = container.querySelector('[data-testid="presence-review-saved"]');
    expect(saved?.textContent).toBe("Website approach saved");
    expect(saved?.textContent).not.toMatch(
      /approved|authorized|confirmed|published|live|complete|connected|verified/i
    );
  });

  it("explains the existing-website recommendation without claiming a site was changed", async () => {
    const original = plan({
      plan: {
        ...plan().plan,
        sitePath: {
          recommended: "keep_external",
          allowed: ["keep_external", "preserve_migrate"],
          reason: "existing_website",
        },
      },
    });
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/plan")
        return { success: true, plan: original };
      if (method === "GET" && path === "/api/profiles") return [profile];
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await mount();
    expect(container.textContent).toContain("Suggested because a current website is listed.");
    expect(container.textContent).not.toContain("Suggested from your current website information");
    expect(container.textContent).toContain("This choice does not change your website");
  });

  it("uses neutral labels for unknown provenance paths without showing imported claims", async () => {
    const original = plan({
      plan: {
        ...plan().plan,
        evidenceSources: [
          {
            path: "$.provenance.enrichment.output.secretField",
            sourceRef: "https://example.test/source",
          },
        ],
        quarantinedEvidence: [
          {
            path: "$.provenance.evidence.secretField",
            reason: "requires_owner_confirmation",
            value: "Unconfirmed imported claim",
          },
        ],
      },
    });
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/plan")
        return { success: true, plan: original };
      if (method === "GET" && path === "/api/profiles") return [profile];
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await mount();
    expect(container.textContent).toContain("Business detail");
    expect(container.textContent).toContain("https://example.test/source");
    expect(container.textContent).not.toContain("secretField");
    expect(container.textContent).not.toContain("Unconfirmed imported claim");
  });

  it.each([
    { status: 409, code: "PRESENCE_PLAN_STALE" },
    { status: 422, code: "SITE_PATH_UNAVAILABLE" },
  ])(
    "refreshes $code and requires a new manual choice without replaying the write",
    async ({ status, code }) => {
      const oldPlan = plan();
      const newPlan = plan({
        evidenceDigest: "c".repeat(64),
        planHash: "d".repeat(64),
        revision: 2,
      });
      let planReads = 0;
      state.apiRequest.mockImplementation(async (method: string, path: string) => {
        if (method === "GET" && path === "/api/presence/plan") {
          planReads += 1;
          return { success: true, plan: planReads === 1 ? oldPlan : newPlan };
        }
        if (method === "GET" && path === "/api/profiles") return [profile];
        if (method === "POST" && path === "/api/presence/plan/refresh") {
          return { success: true, plan: newPlan };
        }
        if (method === "POST" && path === "/api/presence/plan/review") {
          throw new ApiError("Business evidence changed", { status, code });
        }
        throw new Error(`Unexpected request: ${method} ${path}`);
      });

      await mount();
      await chooseAndSave();
      expect(
        state.apiRequest.mock.calls.filter((call) => call[1] === "/api/presence/plan/review")
      ).toHaveLength(1);
      expect(
        state.apiRequest.mock.calls.filter((call) => call[1] === "/api/presence/plan/refresh")
      ).toHaveLength(1);
      expect(planReads).toBe(2);
      expect(container.textContent).toContain("Choose a website approach again");
      expect(
        container.querySelector<HTMLInputElement>('[data-testid="presence-choice-hosted_new"]')
          ?.checked
      ).toBe(false);
      expect(
        container.querySelector<HTMLButtonElement>('[data-testid="presence-review-save"]')?.disabled
      ).toBe(true);
    }
  );

  it("shows an impersonation banner and withholds the consent control", async () => {
    fetchMock.mockImplementation(async () =>
      authResponse({ id: "owner-1", isImpersonating: true })
    );
    await mount();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("End impersonation");
    expect(container.querySelector('[data-testid="presence-review-save"]')).toBeNull();
    expect(state.apiRequest).not.toHaveBeenCalled();
  });

  it("rechecks impersonation before saving and makes no review request", async () => {
    fetchMock
      .mockImplementationOnce(async () => authResponse())
      .mockImplementationOnce(async () => authResponse({ id: "owner-1", isImpersonating: true }));
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/plan") return { success: true, plan: plan() };
      if (method === "GET" && path === "/api/profiles") return [profile];
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await mount();
    await chooseAndSave();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("End impersonation");
    expect(
      state.apiRequest.mock.calls.some((call) => call[1] === "/api/presence/plan/review")
    ).toBe(false);
    expect(container.querySelector('[data-testid="presence-review-save"]')).toBeNull();
  });

  it("discards an old business save response after the cached account changes", async () => {
    const original = plan();
    let finishReview!: (response: unknown) => void;
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/plan")
        return { success: true, plan: original };
      if (method === "GET" && path === "/api/profiles") return [profile];
      if (method === "POST" && path === "/api/presence/plan/review") {
        return new Promise((resolve) => {
          finishReview = resolve;
        });
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await mount();
    await act(async () => {
      container
        .querySelector<HTMLInputElement>('[data-testid="presence-choice-hosted_new"]')!
        .click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="presence-review-save"]')!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(
      state.apiRequest.mock.calls.some((call) => call[1] === "/api/presence/plan/review")
    ).toBe(true);

    state.user = { id: "owner-2", onboardingCompleted: true };
    await act(async () => root.render(<PresenceReview />));
    await flushUi();
    expect(container.textContent).toContain("Business review unavailable");
    expect(container.textContent).not.toContain("Sample Shop");

    await act(async () =>
      finishReview({
        success: true,
        plan: {
          ...original,
          status: "site_path_selected",
          selectedSitePath: "hosted_new",
        },
      })
    );
    await flushUi();
    expect(container.textContent).toContain("Business review unavailable");
    expect(container.textContent).not.toContain("Sample Shop");
    expect(container.textContent).not.toContain("Website approach saved");
  });

  it("discards a pending save response after unmount", async () => {
    const original = plan();
    let finishReview!: (response: unknown) => void;
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/plan")
        return { success: true, plan: original };
      if (method === "GET" && path === "/api/profiles") return [profile];
      if (method === "POST" && path === "/api/presence/plan/review") {
        return new Promise((resolve) => {
          finishReview = resolve;
        });
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await mount();
    await act(async () => {
      container
        .querySelector<HTMLInputElement>('[data-testid="presence-choice-hosted_new"]')!
        .click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="presence-review-save"]')!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => root.unmount());
    await act(async () =>
      finishReview({
        success: true,
        plan: {
          ...original,
          status: "site_path_selected",
          selectedSitePath: "hosted_new",
        },
      })
    );
    root = createRoot(container);
    expect(container.textContent).toBe("");
  });

  it("routes a review-time identity conflict to the matching canonical editor", async () => {
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/plan") return { success: true, plan: plan() };
      if (method === "GET" && path === "/api/profiles") return [profile];
      if (method === "POST" && path === "/api/presence/plan/review") {
        throw new ApiError("Identity conflict", {
          status: 422,
          code: "PRESENCE_IDENTITY_CONFLICT",
        });
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await mount();
    await chooseAndSave();
    expect(
      container.querySelector<HTMLAnchorElement>('a[href="/u/sample-shop/edit"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="presence-review-content"]')).toBeNull();
    expect(
      state.apiRequest.mock.calls.some((call) => call[1] === "/api/presence/plan/refresh")
    ).toBe(false);
  });

  it("fails closed when fresh auth cannot be read or changes accounts", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await mount();
    expect(container.textContent).toContain("Could not load this review");
    expect(state.apiRequest).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    root = createRoot(container);
    fetchMock.mockImplementation(async () => authResponse({ id: "other-user" }));
    await mount();
    expect(container.textContent).toContain("Business review unavailable");
    expect(state.apiRequest).not.toHaveBeenCalled();
  });

  it("hides all plan content if the owned profile title or IDs do not match", async () => {
    const secretPlan = plan();
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/plan")
        return { success: true, plan: secretPlan };
      if (method === "GET" && path === "/api/profiles") {
        return [{ ...profile, businessId: "another-business", displayName: "Private Wrong Title" }];
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await mount();
    expect(container.textContent).toContain("Business review unavailable");
    expect(container.textContent).not.toContain("Private Wrong Title");
    expect(container.textContent).not.toContain("business-1");
    expect(container.textContent).not.toContain("https://example.test/");
    expect(container.querySelector('[data-testid="presence-review-save"]')).toBeNull();
  });

  it("separates guest, blocked, missing business outcome and identity conflict routes", async () => {
    fetchMock.mockImplementationOnce(async () => authResponse(null));
    await mount();
    expect(container.querySelector<HTMLAnchorElement>('a[href*="mode=signin"]')?.href).toContain(
      "next=%2Fpresence%2Freview"
    );
    expect(state.apiRequest).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    root = createRoot(container);
    state.apiRequest.mockRejectedValueOnce(new ApiError("Forbidden", { status: 403 }));
    await mount();
    expect(container.textContent).toContain("Business review unavailable");

    await act(async () => root.unmount());
    root = createRoot(container);
    state.apiRequest.mockReset().mockRejectedValueOnce(
      new ApiError("Missing", {
        status: 409,
        code: "COMPLETED_BUSINESS_ONBOARDING_REQUIRED",
      })
    );
    await mount();
    expect(container.querySelector<HTMLAnchorElement>('a[href="/onboarding"]')).not.toBeNull();

    await act(async () => root.unmount());
    root = createRoot(container);
    state.apiRequest.mockReset().mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/plan")
        return {
          success: true,
          plan: plan({
            plan: {
              ...plan().plan,
              quarantinedEvidence: [
                { path: "$.provenance.evidence.targetBusinessId", reason: "identity_conflict" },
              ],
            },
          }),
        };
      if (method === "GET" && path === "/api/profiles") return [profile];
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await mount();
    expect(
      container.querySelector<HTMLAnchorElement>('a[href="/u/sample-shop/edit"]')
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="presence-review-save"]')).toBeNull();
  });
});
