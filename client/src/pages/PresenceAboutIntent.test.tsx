// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/queryClient";
import type { PresenceFactReview } from "@/lib/presenceFacts";
import type { OwnedPresenceProfile } from "@/lib/presenceReview";
import PresenceAboutIntent from "./PresenceAboutIntent";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const state = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...actual, apiRequest: state.apiRequest };
});

const profile: OwnedPresenceProfile = {
  id: "profile-1",
  businessId: "business-1",
  ownerUserId: "owner-1",
  slug: "sample-shop",
  displayName: "Sample Shop",
};
const aboutFact = {
  factKey: "about",
  kind: "about" as const,
  value: "A sourced company history",
  sourceRefs: ["https://example.test/history"],
  sourceVerificationLimited: true,
  valueDigest: "c".repeat(64),
  decision: "approve" as const,
};
const review: PresenceFactReview = {
  planId: "plan-1",
  businessId: "business-1",
  profileId: "profile-1",
  revision: 2,
  evidenceDigest: "a".repeat(64),
  planHash: "b".repeat(64),
  facts: [aboutFact],
};
const activeIntent = {
  id: "intent-1",
  authorizedAt: "2026-09-29T20:00:00.000Z",
  expiresAt: "2026-10-29T20:00:00.000Z",
  status: "active" as const,
  publicationApplied: false as const,
};
const receipt = {
  id: "receipt-1",
  profileId: "profile-1",
  targetMode: "create",
  contentBlocksRevision: 2,
  contentBlocksDigest: "1".repeat(64),
  appliedAt: "2026-09-29T20:01:00.000Z",
};
const appliedIntent = { ...activeIntent, status: "applied", publicationApplied: true, receipt };

function preview(overrides: Record<string, unknown> = {}) {
  return {
    eligible: true,
    reason: null,
    plan: {
      id: review.planId,
      businessId: review.businessId,
      profileId: review.profileId,
      revision: review.revision,
      evidenceDigest: review.evidenceDigest,
      planHash: review.planHash,
      sitePath: "hosted_new",
    },
    fact: {
      key: "about",
      value: aboutFact.value,
      valueDigest: aboutFact.valueDigest,
      sourceRefs: ["https://example.test/history"],
      sourceVerificationLimited: true,
      decisionId: "decision-1",
      decisionEpoch: 1,
      approvedAt: "2026-09-29T19:00:00.000Z",
    },
    target: {
      targetMode: "replace",
      contentBlocksRevision: 1,
      profileTargetIdentity: {
        ownerUserId: profile.ownerUserId,
        businessId: profile.businessId,
        roleContext: "business_owner",
        slug: profile.slug,
        status: "published",
        publiclyReleased: true,
        customDomain: "",
      },
      currentText: "Existing owner-written history",
      contentBlocksDigest: "d".repeat(64),
      aboutBlockDigest: "e".repeat(64),
      aboutBlockId: "about-1",
      field: "body",
    },
    previewDigest: "f".repeat(64),
    replacementRequired: true,
    intent: null,
    publicationApplied: false,
    ...overrides,
  };
}

function authResponse(id = "owner-1", isImpersonating = false) {
  return new Response(JSON.stringify({ authenticated: true, user: { id, isImpersonating } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === label
  );
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

describe("customer About preview and publication consent", () => {
  let root: Root;
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.setSystemTime(new Date("2026-09-29T20:00:00.000Z"));
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
    vi.useRealTimers();
  });

  async function mount(
    props: { review?: PresenceFactReview; profile?: OwnedPresenceProfile } = {}
  ) {
    await act(async () =>
      root.render(
        <PresenceAboutIntent
          review={props.review ?? review}
          profile={props.profile ?? profile}
          fact={aboutFact}
          ownerUserId="owner-1"
        />
      )
    );
    await flush();
  }

  it("requires preview, replacement acknowledgement, and a separate request; confirms no publication", async () => {
    let readCount = 0;
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/about/preview")
        return { success: true, preview: preview(readCount++ ? { intent: activeIntent } : {}) };
      if (method === "POST" && path === "/api/presence/about/intent")
        return { success: true, intent: activeIntent };
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await mount();
    expect(state.apiRequest).not.toHaveBeenCalled();
    expect(container.textContent).toContain("give separate publication consent");
    await act(async () => button(container, "Preview About request").click());
    await flush();
    expect(
      container.querySelector('[data-testid="presence-about-current"]')?.textContent
    ).toContain("Existing owner-written history");
    expect(
      container.querySelector('[data-testid="presence-about-proposed"]')?.textContent
    ).toContain(aboutFact.value);
    expect(container.textContent).toContain("TradeScout profile of Sample Shop (/sample-shop)");
    expect(container.textContent).toContain("Imported About detail approved");
    expect(container.querySelector('a[href="#presence-about-fact-review"]')?.textContent).toContain(
      "approved detail and its sources"
    );
    expect(container.textContent).toContain("Your consent will allow TradeScout to replace");
    expect(container.textContent).toContain("may not open the exact cited page");
    expect(button(container, "Save About publication consent").disabled).toBe(true);
    const acknowledgement = container.querySelector<HTMLInputElement>(
      '[data-testid="presence-about-replacement-ack"]'
    );
    if (!acknowledgement) throw new Error("Missing replacement acknowledgement");
    await act(async () => acknowledgement.click());
    expect(button(container, "Save About publication consent").disabled).toBe(false);
    await act(async () => button(container, "Save About publication consent").click());
    await flush();
    expect(state.apiRequest).toHaveBeenCalledWith("POST", "/api/presence/about/intent", {
      expectedPlanId: "plan-1",
      expectedProfileId: "profile-1",
      expectedRevision: 2,
      expectedDigest: "a".repeat(64),
      expectedPlanHash: "b".repeat(64),
      factKey: "about",
      decisionId: "decision-1",
      valueDigest: "c".repeat(64),
      contentBlocksDigest: "d".repeat(64),
      aboutBlockDigest: "e".repeat(64),
      aboutBlockId: "about-1",
      previewDigest: "f".repeat(64),
      targetMode: "replace",
      contentBlocksRevision: 1,
      publicationAcknowledged: true,
      replacementAcknowledged: true,
      idempotencyKey: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
    expect(container.textContent).toContain("About publication consent was saved");
    expect(container.textContent).toContain("Your public About has not changed yet");
    expect(container.textContent).toContain("Expires");
    expect(container.textContent).not.toContain("published");
  });

  it.each(["ABOUT_HIDDEN", "UNSUPPORTED_TEMPLATE"] as const)(
    "refuses a %s target without showing an authorization button",
    async (reason) => {
      state.apiRequest.mockResolvedValue({
        success: true,
        preview: preview({
          eligible: false,
          reason,
          fact: null,
          target: null,
          previewDigest: null,
        }),
      });
      await mount();
      await act(async () => button(container, "Preview About request").click());
      await flush();
      expect(container.querySelector('[role="alert"]')?.textContent).toBeTruthy();
      expect(container.querySelector('[data-testid="presence-about-authorize"]')).toBeNull();
      expect(state.apiRequest.mock.calls.filter((call) => call[0] === "POST")).toHaveLength(0);
      if (reason === "ABOUT_HIDDEN") {
        expect(container.textContent).toContain(
          "Public Profile Settings, choose Make link public and enable About"
        );
        expect(container.textContent).toContain("Business profiles require approved verification");
        const verificationLink = [...container.querySelectorAll<HTMLAnchorElement>("a")].find(
          (link) => link.textContent === "Business verification"
        )!;
        const verificationUrl = new URL(verificationLink.getAttribute("href")!, "https://www.thetradescout.com");
        expect(verificationUrl.pathname).toBe("/business-verification");
        expect(verificationUrl.searchParams.get("publicProfileId")).toBe(profile.id);
        expect(verificationUrl.searchParams.has("businessProfileId")).toBe(false);
        expect(verificationUrl.searchParams.get("next")).toBe("/presence/review?section=facts");
        expect(container.querySelector('a[href="/u/sample-shop/edit"]')?.textContent).toBe(
          "Open profile editor"
        );
      }
    }
  );

  it("refuses an external site path without offering authorization", async () => {
    state.apiRequest.mockResolvedValue({
      success: true,
      preview: preview({
        eligible: false,
        reason: "UNSUPPORTED_SITE_PATH",
        plan: { ...preview().plan, sitePath: "keep_external" },
        fact: null,
        target: null,
        previewDigest: null,
      }),
    });
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    expect(container.textContent).toContain("website approach does not support");
    expect(container.querySelector('[data-testid="presence-about-authorize"]')).toBeNull();
  });

  it("discards the preview and acknowledgement after a stale request", async () => {
    state.apiRequest.mockImplementation(async (method: string) => {
      if (method === "GET") return { success: true, preview: preview() };
      throw new ApiError("Changed", { status: 409, code: "PRESENCE_ABOUT_PREVIEW_STALE" });
    });
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    const acknowledgement = container.querySelector<HTMLInputElement>(
      '[data-testid="presence-about-replacement-ack"]'
    );
    if (!acknowledgement) throw new Error("Missing acknowledgement");
    await act(async () => acknowledgement.click());
    await act(async () => button(container, "Save About publication consent").click());
    await flush();
    expect(container.textContent).toContain("Preview again before saving a request");
    expect(container.querySelector('[data-testid="presence-about-current"]')).toBeNull();
    expect(container.querySelector('[data-testid="presence-about-replacement-ack"]')).toBeNull();
    expect(button(container, "Preview again")).toBeTruthy();
  });

  it("blocks a changed account before recording an intent", async () => {
    fetchMock
      .mockImplementationOnce(async () => authResponse())
      .mockImplementationOnce(async () => authResponse("other-owner"));
    state.apiRequest.mockResolvedValue({ success: true, preview: preview() });
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    const acknowledgement = container.querySelector<HTMLInputElement>(
      '[data-testid="presence-about-replacement-ack"]'
    );
    if (!acknowledgement) throw new Error("Missing acknowledgement");
    await act(async () => acknowledgement.click());
    await act(async () => button(container, "Save About publication consent").click());
    await flush();
    expect(container.textContent).toContain("does not match your current business account");
    expect(state.apiRequest.mock.calls.filter((call) => call[0] === "POST")).toHaveLength(0);
  });

  it("blocks impersonation before requesting a preview", async () => {
    fetchMock.mockResolvedValue(authResponse("owner-1", true));
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    expect(container.textContent).toContain("End impersonation");
    expect(state.apiRequest).not.toHaveBeenCalled();
  });

  it("explains a same-site origin refusal without claiming the request was saved", async () => {
    state.apiRequest.mockImplementation(async (method: string) => {
      if (method === "GET") return { success: true, preview: preview() };
      throw new ApiError("Origin required", {
        status: 403,
        code: "PRESENCE_ABOUT_ORIGIN_REQUIRED",
      });
    });
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    const acknowledgement = container.querySelector<HTMLInputElement>(
      '[data-testid="presence-about-replacement-ack"]'
    );
    if (!acknowledgement) throw new Error("Missing acknowledgement");
    await act(async () => acknowledgement.click());
    await act(async () => button(container, "Save About publication consent").click());
    await flush();
    expect(container.textContent).toContain("Open Presence on the same TradeScout site");
    expect(container.textContent).not.toContain("authorization was saved");
  });

  it("hides a ready preview immediately when profile or plan identity changes", async () => {
    state.apiRequest.mockResolvedValue({ success: true, preview: preview() });
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    expect(container.textContent).toContain("Existing owner-written history");
    await mount({ profile: { ...profile, id: "profile-2" } });
    expect(container.textContent).not.toContain("Existing owner-written history");
    await mount({ review: { ...review, revision: 3 } });
    expect(container.textContent).not.toContain("Existing owner-written history");
    expect(state.apiRequest.mock.calls.filter((call) => call[0] === "POST")).toHaveLength(0);
  });

  it("discards a late preview response after the profile changes", async () => {
    let resolvePreview: ((value: unknown) => void) | undefined;
    state.apiRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePreview = resolve;
        })
    );
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    await mount({ profile: { ...profile, id: "profile-2" } });
    await act(async () => resolvePreview?.({ success: true, preview: preview() }));
    await flush();
    expect(container.textContent).not.toContain("Existing owner-written history");
    expect(container.querySelector('[data-testid="presence-about-authorize"]')).toBeNull();
  });

  it("withdraws an active request and confirms profile content remains unchanged", async () => {
    let readCount = 0;
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/about/preview")
        return {
          success: true,
          preview: preview({
            intent: readCount++ === 0 ? activeIntent : { ...activeIntent, status: "withdrawn" },
          }),
        };
      if (method === "POST" && path === "/api/presence/about/intent/withdraw")
        return { success: true, intent: { ...activeIntent, status: "withdrawn" } };
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    expect(container.textContent).toContain("About publication consent saved");
    await act(async () => button(container, "Withdraw About request").click());
    await flush();
    expect(state.apiRequest).toHaveBeenCalledWith("POST", "/api/presence/about/intent/withdraw", {
      intentId: "intent-1",
      idempotencyKey: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
    expect(container.textContent).toContain("Your About request was withdrawn");
    expect(container.textContent).toContain(
      "profile content is unchanged; no public change was made"
    );
    expect(container.querySelector('[data-testid="presence-about-active-intent"]')).toBeNull();
  });

  it("retains an idempotency key when a successful POST is not confirmed by reload", async () => {
    let getCount = 0;
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET" && path === "/api/presence/about/preview") {
        getCount += 1;
        if (getCount === 2) throw new Error("Synthetic reload failure");
        return { success: true, preview: preview() };
      }
      if (method === "POST" && path === "/api/presence/about/intent")
        return { success: true, intent: activeIntent };
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    const firstAcknowledgement = container.querySelector<HTMLInputElement>(
      '[data-testid="presence-about-replacement-ack"]'
    );
    if (!firstAcknowledgement) throw new Error("Missing acknowledgement");
    await act(async () => firstAcknowledgement.click());
    await act(async () => button(container, "Save About publication consent").click());
    await flush();
    expect(container.textContent).toContain("could not be confirmed");
    await act(async () => button(container, "Preview again").click());
    await flush();
    const secondAcknowledgement = container.querySelector<HTMLInputElement>(
      '[data-testid="presence-about-replacement-ack"]'
    );
    if (!secondAcknowledgement) throw new Error("Missing acknowledgement after retry");
    await act(async () => secondAcknowledgement.click());
    await act(async () => button(container, "Save About publication consent").click());
    await flush();
    const posts = state.apiRequest.mock.calls.filter((call) => call[0] === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[0][2].idempotencyKey).toBe(posts[1][2].idempotencyKey);
  });

  it("adds the first public About only after imported approval, fresh creation consent and a separate apply", async () => {
    let phase = "preview";
    const creation = preview({
      target: { ...preview().target, targetMode: "create", currentText: "" },
      replacementRequired: false,
    });
    state.apiRequest.mockImplementation(async (method: string, path: string) => {
      if (method === "GET") {
        return {
          success: true,
          preview:
            phase === "applied"
              ? preview({
                  target: {
                    ...preview().target,
                    currentText: aboutFact.value,
                    contentBlocksRevision: receipt.contentBlocksRevision,
                    contentBlocksDigest: receipt.contentBlocksDigest,
                  },
                  intent: appliedIntent,
                  publicationApplied: true,
                })
              : { ...creation, intent: phase === "consented" ? activeIntent : null },
        };
      }
      if (path === "/api/presence/about/intent") {
        phase = "consented";
        return { success: true, intent: activeIntent };
      }
      if (path === "/api/presence/about/intent/apply") {
        phase = "applied";
        return { success: true, intent: appliedIntent };
      }
      throw new Error(`Unexpected request ${path}`);
    });
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    expect(container.textContent).toContain("profile has no About section");
    expect(container.textContent).toContain("I authorize adding the first public About section");
    expect(button(container, "Save About publication consent").disabled).toBe(true);
    const ack = container.querySelector<HTMLInputElement>(
      '[data-testid="presence-about-create-ack"]'
    );
    if (!ack) throw new Error("Missing fresh first-publication acknowledgement");
    await act(async () => ack.click());
    await act(async () => button(container, "Save About publication consent").click());
    await flush();
    const consent = state.apiRequest.mock.calls.find(
      (call) => call[1] === "/api/presence/about/intent"
    );
    expect(consent?.[2]).toMatchObject({
      targetMode: "create",
      contentBlocksRevision: 1,
      publicationAcknowledged: true,
      replacementAcknowledged: false,
    });
    expect(container.textContent).toContain("Your public About has not changed yet");
    expect(state.apiRequest.mock.calls.filter((call) => call[1].endsWith("/apply"))).toHaveLength(
      0
    );
    await act(async () => button(container, "Publish About").click());
    await flush();
    expect(state.apiRequest).toHaveBeenCalledWith("POST", "/api/presence/about/intent/apply", {
      intentId: activeIntent.id,
      idempotencyKey: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    });
    expect(container.textContent).toContain("approved About text was published");
    expect(
      container.querySelector('[data-testid="presence-about-current"]')?.textContent
    ).toContain(aboutFact.value);
    expect(container.querySelector('a[href="/u/sample-shop"]')?.textContent).toBe(
      "View public profile"
    );
    expect(container.querySelector('[data-testid="presence-about-apply"]')).toBeNull();
    expect(container.querySelector('[data-testid="presence-about-authorize"]')).toBeNull();
  });

  it("rejects a legacy replacement preview without a version-bound target", async () => {
    const legacy = preview();
    const { targetMode: _mode, contentBlocksRevision: _revision, ...oldTarget } = legacy.target;
    state.apiRequest.mockResolvedValue({
      success: true,
      preview: { ...legacy, target: oldTarget },
    });
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    expect(container.textContent).toContain("Preview again");
    expect(container.querySelector('[data-testid="presence-about-authorize"]')).toBeNull();
    expect(state.apiRequest.mock.calls.filter((call) => call[0] === "POST")).toHaveLength(0);
  });

  it("rejects a preview for a changed profile address before showing consent", async () => {
    const changed = preview();
    state.apiRequest.mockResolvedValue({
      success: true,
      preview: {
        ...changed,
        target: {
          ...changed.target,
          profileTargetIdentity: {
            ...changed.target.profileTargetIdentity,
            slug: "new-profile-address",
          },
        },
      },
    });
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    expect(container.querySelector('[data-testid="presence-about-authorize"]')).toBeNull();
    expect(container.querySelector('a[href="/presence/review?section=facts"]')?.textContent).toBe(
      "Reload imported detail review"
    );
    expect(state.apiRequest.mock.calls.filter((call) => call[0] === "POST")).toHaveLength(0);
  });

  it("shows the freshly bound connected domain before publication consent", async () => {
    const current = preview();
    state.apiRequest.mockResolvedValue({
      success: true,
      preview: {
        ...current,
        target: {
          ...current.target,
          profileTargetIdentity: {
            ...current.target.profileTargetIdentity,
            customDomain: "example.test",
          },
        },
      },
    });
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    expect(container.textContent).toContain("Connected profile domain: example.test");
    expect(button(container, "Save About publication consent").disabled).toBe(true);
  });

  it.each([
    "PRESENCE_ABOUT_INTENT_STALE",
    "PRESENCE_ABOUT_INTENT_WITHDRAWN",
    "PRESENCE_ABOUT_INTENT_EXPIRED",
    "PRESENCE_ABOUT_FRESH_CONSENT_REQUIRED",
  ])("retains the private imported draft after apply is refused with %s", async (code) => {
    state.apiRequest.mockImplementation(async (method: string) => {
      if (method === "GET") return { success: true, preview: preview({ intent: activeIntent }) };
      throw new ApiError("Fresh consent needed", { status: 409, code });
    });
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    await act(async () => button(container, "Publish About").click());
    await flush();
    expect(
      container.querySelector('[data-testid="presence-about-retained-draft"]')?.textContent
    ).toContain(aboutFact.value);
    expect(container.querySelector('[data-testid="presence-about-applied"]')).toBeNull();
    expect(container.querySelector('[data-testid="presence-about-apply"]')).toBeNull();
  });

  it("does not claim a public result from a receipt for another profile", async () => {
    state.apiRequest.mockImplementation(async (method: string) =>
      method === "GET"
        ? { success: true, preview: preview({ intent: activeIntent }) }
        : {
            success: true,
            intent: { ...appliedIntent, receipt: { ...receipt, profileId: "another-profile" } },
          }
    );
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    await act(async () => button(container, "Publish About").click());
    await flush();
    expect(container.textContent).toContain("could not be confirmed");
    expect(container.textContent).not.toContain("text was published");
  });

  it("does not claim current publication until the saved About and receipt agree on readback", async () => {
    let applied = false;
    const replacementApplied = { ...appliedIntent, receipt: { ...receipt, targetMode: "replace" } };
    state.apiRequest.mockImplementation(async (method: string) => {
      if (method === "POST") {
        applied = true;
        return { success: true, intent: replacementApplied };
      }
      return {
        success: true,
        preview: preview({
          intent: applied ? replacementApplied : activeIntent,
          publicationApplied: applied,
        }),
      };
    });
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    await act(async () => button(container, "Publish About").click());
    await flush();
    expect(container.textContent).toContain("Preview again");
    expect(container.textContent).not.toContain("text was published");
  });

  it("keeps an apply retry key after an unknown response and checks the owner again", async () => {
    let attempts = 0;
    state.apiRequest.mockImplementation(async (method: string) => {
      if (method === "GET") return { success: true, preview: preview({ intent: activeIntent }) };
      attempts += 1;
      throw new Error(`Unknown result ${attempts}`);
    });
    await mount();
    await act(async () => button(container, "Preview About request").click());
    await flush();
    await act(async () => button(container, "Publish About").click());
    await flush();
    await act(async () => button(container, "Preview again").click());
    await flush();
    await act(async () => button(container, "Publish About").click());
    await flush();
    const applies = state.apiRequest.mock.calls.filter((call) => call[1].endsWith("/apply"));
    expect(applies).toHaveLength(2);
    expect(applies[0][2].idempotencyKey).toBe(applies[1][2].idempotencyKey);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
