// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BusinessOwnerDashboard from "./business-owner-dashboard";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const state = vi.hoisted(() => ({
  plan: null as Record<string, unknown> | null,
  profiles: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "owner-1", activeProfileId: "profile-primary" } }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey: string[] }) => ({
      data:
        queryKey[0] === "/api/profiles"
          ? state.profiles
          : queryKey[0] === "/api/presence/plan"
            ? state.plan
            : undefined,
      isLoading: false,
      isError: false,
    }),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

const primaryProfile = {
  id: "profile-primary",
  businessId: "business-primary",
  ownerUserId: "owner-1",
  slug: "primary-shop",
  displayName: "Primary Shop",
  status: "published",
};
const reviewedProfile = {
  id: "profile-reviewed",
  businessId: "business-reviewed",
  ownerUserId: "owner-1",
  slug: "reviewed-shop",
  displayName: "Reviewed Shop",
  status: "published",
};

function reviewedPlan(businessId = "business-reviewed") {
  const evidenceDigest = "a".repeat(64);
  const planHash = "b".repeat(64);
  return {
    businessId,
    profileId: "profile-reviewed",
    revision: 1,
    evidenceDigest,
    planHash,
    status: "draft",
    selectedSitePath: null,
    executionAuthorized: false,
    plan: {
      businessId,
      profileId: "profile-reviewed",
      evidenceDigest,
      planHash,
      sitePath: { recommended: "hosted_new", allowed: ["hosted_new"], reason: "new_site" },
      evidenceSources: [],
      quarantinedEvidence: [],
      actions: [],
    },
  };
}

describe("business dashboard presence entry", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    state.profiles = [primaryProfile, reviewedProfile];
    state.plan = reviewedPlan();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("links the owned latest-outcome profile even when another profile is primary", async () => {
    await act(async () => root.render(<BusinessOwnerDashboard />));
    const link = container.querySelector<HTMLAnchorElement>('a[href="/presence/review"]');
    expect(link?.textContent).toBe("Review website approach for Reviewed Shop");
  });

  it("withholds the entry point when the plan does not match an owned profile", async () => {
    state.plan = reviewedPlan("someone-elses-business");
    await act(async () => root.render(<BusinessOwnerDashboard />));
    expect(container.querySelector('a[href="/presence/review"]')).toBeNull();
  });
});
