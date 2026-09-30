// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PresenceReviewRecord } from "@/lib/presenceReview";
import PresenceFactReview from "./PresenceFactReview";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const state = vi.hoisted(() => ({ apiRequest: vi.fn() }));
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
const record = {
  businessId: "business-1",
  profileId: "profile-1",
  revision: 2,
  evidenceDigest: "a".repeat(64),
  planHash: "b".repeat(64),
  status: "draft",
  selectedSitePath: null,
  executionAuthorized: false,
  plan: {
    businessId: "business-1",
    profileId: "profile-1",
    evidenceDigest: "a".repeat(64),
    planHash: "b".repeat(64),
    sitePath: { recommended: "hosted_new", allowed: ["hosted_new"], reason: "no_existing_website" },
    evidenceSources: [],
    quarantinedEvidence: [],
    actions: [],
  },
} as PresenceReviewRecord;

function review(decision: "approve" | "reject" | null = null) {
  return {
    planId: "plan-1",
    businessId: "business-1",
    profileId: "profile-1",
    revision: 2,
    evidenceDigest: "a".repeat(64),
    planHash: "b".repeat(64),
    facts: [
      {
        factKey: "description",
        kind: "description",
        value: "A sourced description",
        sourceRefs: ["https://example.test/about?private=1"],
        sourceVerificationLimited: true,
        valueDigest: "c".repeat(64),
        decision,
      },
    ],
  };
}

function authResponse(id = "owner-1") {
  return new Response(JSON.stringify({ authenticated: true, user: { id } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("customer imported fact review", () => {
  let root: Root;
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state.apiRequest.mockReset();
    fetchMock = vi.fn(async () => authResponse());
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
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
    await act(async () =>
      root.render(<PresenceFactReview record={record} profile={profile} ownerUserId="owner-1" />)
    );
    await flush();
  }

  it("requires an explicit owner click, records the exact shown version, then checks server state", async () => {
    let readCount = 0;
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/facts")
        return { success: true, review: review(readCount++ ? "approve" : null) };
      if (method === "POST" && path === "/api/presence/facts/description/decision")
        return {
          success: true,
          decision: {
            factKey: "description",
            valueDigest: "c".repeat(64),
            decision: "approve",
          },
        };
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await mount();
    expect(container.textContent).toContain("A sourced description");
    expect(container.textContent).not.toContain("private=1");
    expect(container.textContent).toContain("may not open the exact page");
    expect(state.apiRequest.mock.calls.filter((call) => call[0] === "POST")).toHaveLength(0);
    const approve = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "This is accurate"
    );
    if (!approve) throw new Error("Approve action missing");
    await act(async () => approve.click());
    await flush();
    expect(state.apiRequest).toHaveBeenCalledWith(
      "POST",
      "/api/presence/facts/description/decision",
      {
        expectedPlanId: "plan-1",
        expectedProfileId: "profile-1",
        expectedRevision: 2,
        expectedDigest: "a".repeat(64),
        expectedPlanHash: "b".repeat(64),
        valueDigest: "c".repeat(64),
        decision: "approve",
        idempotencyKey: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      }
    );
    expect(container.textContent).toContain("Approved for later use");
    expect(container.textContent).toContain("No public information was changed");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("enables the next fact after reloading a successful decision", async () => {
    const approved = new Set<string>();
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/facts") {
        const first = review();
        return {
          success: true,
          review: {
            ...first,
            facts: [
              { ...first.facts[0], decision: approved.has("description") ? "approve" : null },
              {
                ...first.facts[0],
                factKey: "about",
                kind: "about",
                value: "A sourced history",
                valueDigest: "d".repeat(64),
                decision: approved.has("about") ? "approve" : null,
              },
            ],
          },
        };
      }
      if (method === "POST" && path.startsWith("/api/presence/facts/")) {
        const key = decodeURIComponent(path.split("/")[4]);
        approved.add(key);
        return {
          success: true,
          decision: {
            factKey: key,
            valueDigest: key === "about" ? "d".repeat(64) : "c".repeat(64),
            decision: "approve",
          },
        };
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await mount();
    const first = container.querySelector<HTMLElement>('[data-testid="presence-fact-description"]');
    const firstApprove = [...(first?.querySelectorAll("button") || [])].find(
      (button) => button.textContent === "This is accurate"
    );
    if (!firstApprove) throw new Error("First fact action missing");
    await act(async () => firstApprove.click());
    await flush();
    const second = container.querySelector<HTMLElement>('[data-testid="presence-fact-about"]');
    const secondApprove = [...(second?.querySelectorAll("button") || [])].find(
      (button) => button.textContent === "This is accurate"
    );
    expect(secondApprove?.disabled).toBe(false);
    if (!secondApprove) throw new Error("Second fact action missing");
    await act(async () => secondApprove.click());
    await flush();
    expect(approved).toEqual(new Set(["description", "about"]));
    expect(state.apiRequest.mock.calls.filter((call) => call[0] === "POST")).toHaveLength(2);
    expect(container.querySelector('[data-testid="presence-about-intent"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="presence-fact-about"]')?.id).toBe(
      "presence-about-fact-review"
    );
    expect(
      state.apiRequest.mock.calls.filter((call) => call[1] === "/api/presence/about/preview")
    ).toHaveLength(0);
  });

  it("hides a response for another plan and never offers a decision", async () => {
    state.apiRequest.mockResolvedValue({
      success: true,
      review: { ...review(), profileId: "other-profile" },
    });
    await mount();
    expect(container.textContent).toContain("does not match your current business account");
    expect(container.textContent).not.toContain("A sourced description");
    expect(container.textContent).not.toContain("This is accurate");
  });

  it("rechecks the account before accepting a click and blocks an account switch", async () => {
    fetchMock
      .mockImplementationOnce(async () => authResponse("owner-1"))
      .mockImplementationOnce(async () => authResponse("other-owner"));
    state.apiRequest.mockResolvedValue({ success: true, review: review() });
    await mount();
    const approve = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "This is accurate"
    );
    if (!approve) throw new Error("Approve action missing");
    await act(async () => approve.click());
    await flush();
    expect(container.textContent).toContain("does not match your current business account");
    expect(state.apiRequest.mock.calls.filter((call) => call[0] === "POST")).toHaveLength(0);
  });

  it("does not show an uncited or malformed imported claim", async () => {
    state.apiRequest.mockResolvedValue({
      success: true,
      review: {
        ...review(),
        facts: [{ ...review().facts[0], sourceRefs: [] }],
      },
    });
    await mount();
    expect(container.textContent).not.toContain("A sourced description");
    expect(container.textContent).toContain("does not match your current business account");
  });

  it("takes the normalized description through approval, first About consent and publication", async () => {
    let approved = false;
    let consented = false;
    let applied = false;
    const intent = {
      id: "11111111-1111-4111-8111-111111111111",
      status: "active",
      authorizedAt: "2026-09-30T14:00:00.000Z",
      expiresAt: "2026-10-30T14:00:00.000Z",
      publicationApplied: false,
    };
    const receipt = {
      id: "22222222-2222-4222-8222-222222222222",
      profileId: profile.id,
      targetMode: "create",
      contentBlocksRevision: 2,
      contentBlocksDigest: "e".repeat(64),
      appliedAt: "2026-09-30T14:01:00.000Z",
    };
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/facts")
        return { success: true, review: review(approved ? "approve" : null) };
      if (method === "POST" && path === "/api/presence/facts/description/decision") {
        approved = true;
        return {
          success: true,
          decision: { factKey: "description", valueDigest: "c".repeat(64), decision: "approve" },
        };
      }
      if (method === "GET" && path === "/api/presence/about/preview") {
        return {
          success: true,
          preview: {
            eligible: true,
            reason: null,
            plan: {
              id: "plan-1",
              businessId: profile.businessId,
              profileId: profile.id,
              revision: 2,
              evidenceDigest: record.evidenceDigest,
              planHash: record.planHash,
              sitePath: "hosted_new",
            },
            fact: {
              key: "description",
              value: review().facts[0].value,
              valueDigest: "c".repeat(64),
              sourceRefs: ["https://example.test/about"],
              sourceVerificationLimited: true,
              decisionId: "decision-description",
              decisionEpoch: 1,
              approvedAt: "2026-09-30T13:59:00.000Z",
            },
            target: {
              targetMode: applied ? "replace" : "create",
              contentBlocksRevision: applied ? 2 : 1,
              profileTargetIdentity: {
                ownerUserId: profile.ownerUserId,
                businessId: profile.businessId,
                roleContext: "business_owner",
                slug: profile.slug,
                status: "published",
                publiclyReleased: true,
                customDomain: "",
              },
              currentText: applied ? review().facts[0].value : "",
              contentBlocksDigest: applied ? receipt.contentBlocksDigest : "d".repeat(64),
              aboutBlockDigest: "f".repeat(64),
              aboutBlockId: "1".repeat(64),
              field: "body",
            },
            previewDigest: "2".repeat(64),
            replacementRequired: applied,
            intent: applied
              ? { ...intent, status: "applied", publicationApplied: true, receipt }
              : consented
                ? intent
                : null,
            publicationApplied: applied,
          },
        };
      }
      if (method === "POST" && path === "/api/presence/about/intent") {
        consented = true;
        return { success: true, intent };
      }
      if (method === "POST" && path === "/api/presence/about/intent/apply") {
        applied = true;
        return {
          success: true,
          intent: { ...intent, status: "applied", publicationApplied: true, receipt },
        };
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    const click = async (label: string) => {
      const button = [...container.querySelectorAll("button")].find(
        (item) => item.textContent === label
      );
      if (!button) throw new Error(`Missing button ${label}`);
      await act(async () => button.click());
      await flush();
    };
    await mount();
    expect(container.querySelector('[data-testid="presence-about-intent"]')).toBeNull();
    await click("This is accurate");
    expect(container.querySelector('[data-testid="presence-about-intent"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="presence-fact-description"]')?.id).toBe(
      "presence-about-fact-review"
    );
    expect(applied).toBe(false);
    await click("Preview About request");
    expect(container.textContent).toContain("Imported business description approved");
    const acknowledgement = container.querySelector<HTMLInputElement>(
      '[data-testid="presence-about-create-ack"]'
    );
    if (!acknowledgement) throw new Error("Missing first About consent");
    await act(async () => acknowledgement.click());
    await click("Save About publication consent");
    const savedConsent = state.apiRequest.mock.calls.find(
      (call) => call[1] === "/api/presence/about/intent"
    )?.[2];
    expect(savedConsent).toMatchObject({
      factKey: "description",
      decisionId: "decision-description",
      targetMode: "create",
      contentBlocksRevision: 1,
      publicationAcknowledged: true,
      replacementAcknowledged: false,
    });
    expect(applied).toBe(false);
    await click("Publish About");
    expect(applied).toBe(true);
    expect(container.textContent).toContain("approved About text was published");
    expect(
      container.querySelector('[data-testid="presence-about-current"]')?.textContent
    ).toContain(review().facts[0].value);
    expect(state.apiRequest.mock.calls.filter((call) => call[0] === "POST")).toHaveLength(3);
  });
});
