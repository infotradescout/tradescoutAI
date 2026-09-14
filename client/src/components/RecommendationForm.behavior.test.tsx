// @vitest-environment jsdom
import React, { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecommendationForm } from "./RecommendationForm";
import { readRecommendationDraft, saveRecommendationDraft } from "@/lib/recommendationDraft";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  user: null as any,
  authLoading: false,
  navigate: vi.fn(),
  storageUnavailable: false,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: state.user,
    isAuthenticated: Boolean(state.user),
    isLoading: state.authLoading,
  }),
}));

const contractorId = "contractor-1";
const recommendationPath = "/u/acme-repair?trustAction=recommend";
const endpoint = `/api/contractors/${contractorId}/recommendations`;
const memberA = {
  id: "member-a",
  email: "a@example.test",
  emailVerified: false,
  onboardingCompleted: false,
};
const memberB = {
  id: "member-b",
  email: "b@example.test",
  emailVerified: false,
  onboardingCompleted: false,
};
const comment = "They repaired our cabinets carefully and kept the area clean.";
const emptyReceipt = { recommendation: null, missingVerification: ["email"] };
const json = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  json: async () => body,
});
const actualWindow = window;
const actualStorage = actualWindow.localStorage;
const fetchMock = vi.fn();
let root: Root;
let client: QueryClient;
let container: HTMLDivElement;
let props: ComponentProps<typeof RecommendationForm>;

beforeEach(() => {
  actualStorage.clear();
  actualWindow.sessionStorage.clear();
  actualWindow.history.replaceState({}, "", recommendationPath);
  state.user = null;
  state.authLoading = false;
  state.storageUnavailable = false;
  state.navigate.mockReset();
  props = {
    contractorId,
    contractorName: "Acme Repair",
    defaultOpen: true,
    resumePath: recommendationPath,
  };
  fetchMock.mockReset().mockImplementation(async (_url, options) => {
    if (options?.method === "POST") {
      const data = JSON.parse(options.body);
      return json({
        recommendation: {
          id: data.submissionId,
          comment: data.comment,
          moderationStatus: "pending",
          isPublic: false,
        },
        missingVerification: ["email"],
      });
    }
    return json(emptyReceipt);
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal(
    "window",
    new Proxy(actualWindow, {
      get(target, property) {
        if (property === "location") return { pathname: "/u/acme-repair", assign: state.navigate };
        if (property === "localStorage" && state.storageUnavailable) {
          return {
            getItem: actualStorage.getItem.bind(actualStorage),
            removeItem: actualStorage.removeItem.bind(actualStorage),
            setItem: () => {
              throw new Error("Storage unavailable");
            },
          };
        }
        return Reflect.get(target, property, target);
      },
    })
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.unstubAllGlobals();
});

const posts = () => fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");
const textInput = () =>
  container.querySelector<HTMLTextAreaElement>('[data-testid="textarea-comment"]');
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
async function eventually(assert: () => void) {
  let last: unknown;
  for (let i = 0; i < 60; i++) {
    await settle();
    try {
      assert();
      return;
    } catch (error) {
      last = error;
    }
  }
  throw last;
}
async function render(nextProps: Partial<typeof props> = {}) {
  props = { ...props, ...nextProps };
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <RecommendationForm {...props} />
      </QueryClientProvider>
    )
  );
  await settle();
}
async function typeExperience(value: string) {
  const textarea = textInput();
  expect(textarea).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
      textarea,
      value
    );
    textarea!.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (node) => node.textContent?.trim() === label
  );
  expect(button, label).toBeTruthy();
  await act(async () => button!.click());
  await settle();
}
async function submit() {
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
  );
  await settle();
}
async function remount() {
  await act(async () => root.unmount());
  client.clear();
  root = createRoot(container);
  await render();
}

describe("recommendation action before account setup", () => {
  it("opens the experience form for guests without an account or verification wall", async () => {
    await render({ defaultOpen: false });
    expect(textInput()).toBeNull();
    await click("Share your experience");
    expect(textInput()).not.toBeNull();
    expect(container.textContent).toContain("What was your experience?");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it("restores unfinished text on reload before the recommendation is ready to submit", async () => {
    await render();
    await typeExperience("Good");
    const draft = readRecommendationDraft(actualStorage, contractorId, null);
    expect(draft?.data.comment).toBe("Good");
    expect(draft?.readyToSubmit).toBe(false);
    await remount();
    expect(textInput()?.value).toBe("Good");
    expect(readRecommendationDraft(actualStorage, contractorId, null)?.data.submissionId).toBe(
      draft?.data.submissionId
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves a truthful device-only receipt without making a server request", async () => {
    await render();
    await typeExperience(comment);
    await submit();
    expect(container.textContent).toContain("Saved on this device");
    expect(container.textContent).toContain(comment);
    expect(container.textContent).not.toContain("published");
    expect(readRecommendationDraft(actualStorage, contractorId, null)?.readyToSubmit).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.navigate).not.toHaveBeenCalled();
    await remount();
    expect(container.textContent).toContain("Saved on this device");
    expect(container.textContent).toContain(comment);
  });

  it("keeps text visible and does not navigate when device storage cannot save", async () => {
    state.storageUnavailable = true;
    await render();
    await typeExperience(comment);
    await submit();
    expect(textInput()?.value).toBe(comment);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("could not save");
    expect(container.textContent).not.toContain("Saved on this device");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it("does not leave the page if storage stops working before account handoff", async () => {
    await render();
    await typeExperience(comment);
    await submit();
    state.storageUnavailable = true;
    await render();
    await click("Continue with a free account");
    expect(state.navigate).not.toHaveBeenCalled();
    expect(container.textContent).toContain(comment);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("could not save");
  });

  it("saves an authenticated unverified recommendation privately and returns through email confirmation", async () => {
    state.user = memberA;
    await render();
    await typeExperience(comment);
    await submit();
    await eventually(() =>
      expect(container.querySelector('[data-testid="recommendation-saved"]')).not.toBeNull()
    );
    expect(posts()).toHaveLength(1);
    expect(posts()[0][0]).toBe(endpoint);
    const payload = JSON.parse(posts()[0][1].body);
    expect(payload.comment).toBe(comment);
    expect(payload).not.toHaveProperty("userId");
    expect(payload).not.toHaveProperty("isPublic");
    expect(container.textContent).toContain("It is private. Confirm your email");
    await click("Confirm email to continue");
    expect(state.navigate).toHaveBeenCalledWith(
      `/verification?next=${encodeURIComponent(recommendationPath)}`
    );
    expect(state.navigate.mock.calls.some(([path]) => String(path).includes("onboarding"))).toBe(
      false
    );
  });

  it("resumes an explicitly handed-off guest draft exactly once with the same submission id", async () => {
    await render();
    await typeExperience(comment);
    await submit();
    const guestDraft = readRecommendationDraft(actualStorage, contractorId, null)!;
    await click("I already have an account");
    expect(state.navigate).toHaveBeenCalledWith(
      `/pre-scout-setup?mode=signin&next=${encodeURIComponent(recommendationPath)}`
    );
    state.user = memberA;
    await render({ resumeSaved: true });
    await eventually(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0][1].body).submissionId).toBe(guestDraft.data.submissionId);
    await render();
    await settle();
    expect(posts()).toHaveLength(1);
    expect(readRecommendationDraft(actualStorage, contractorId, null)).toBeNull();
  });

  it("does not auto-submit an account draft when the user opens the form normally", async () => {
    state.user = memberA;
    saveRecommendationDraft(actualStorage, {
      version: 1,
      contractorId,
      ownerUserId: memberA.id,
      savedAt: Date.now(),
      readyToSubmit: true,
      data: {
        submissionId: "9c81d74a-9b11-4f62-93f0-a56b4305e1f7",
        recommendationType: "positive",
        comment,
      },
    });
    await render({ resumeSaved: false });
    expect(textInput()?.value).toBe(comment);
    expect(posts()).toHaveLength(0);
  });

  it("does not replay an adopted guest draft into another account while the first save is pending", async () => {
    fetchMock.mockImplementation(async (_url, options) =>
      options?.method === "POST" ? new Promise(() => {}) : json(emptyReceipt)
    );
    await render();
    await typeExperience(comment);
    await submit();
    await click("I already have an account");
    state.user = memberA;
    await render({ resumeSaved: true });
    await eventually(() => expect(posts()).toHaveLength(1));
    state.user = memberB;
    await render();
    await settle();
    expect(posts()).toHaveLength(1);
    expect(textInput()?.value).toBe("");
    expect(container.textContent).not.toContain(comment);
  });

  it("does not repeat automatic saving when account status refreshes during that save", async () => {
    fetchMock.mockImplementation(async (_url, options) =>
      options?.method === "POST" ? new Promise(() => {}) : json(emptyReceipt)
    );
    await render();
    await typeExperience(comment);
    await submit();
    await click("I already have an account");
    state.user = memberA;
    await render({ resumeSaved: true });
    await eventually(() => expect(posts()).toHaveLength(1));
    state.authLoading = true;
    await render();
    state.authLoading = false;
    await render();
    await settle();
    expect(posts()).toHaveLength(1);
  });

  it("does not show or replay an unbound guest draft just because a different account opens its URL", async () => {
    await render();
    await typeExperience(comment);
    await submit();
    state.user = memberB;
    await render({ resumeSaved: true });
    await settle();
    expect(posts()).toHaveLength(0);
    expect(textInput()?.value).toBe("");
    expect(container.textContent).not.toContain(comment);
  });

  it("retains the account draft and submission id after a failed save", async () => {
    state.user = memberA;
    fetchMock.mockImplementation(async (_url, options) =>
      options?.method === "POST"
        ? json({ message: "Unable to save right now. Please try again." }, 503)
        : json(emptyReceipt)
    );
    await render();
    await typeExperience(comment);
    const before = readRecommendationDraft(actualStorage, contractorId, memberA.id)!;
    await submit();
    await eventually(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    expect(textInput()?.value).toBe(comment);
    expect(
      readRecommendationDraft(actualStorage, contractorId, memberA.id)?.data.submissionId
    ).toBe(before.data.submissionId);
    expect(state.navigate).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="recommendation-saved"]')).toBeNull();
  });

  it("does not expose an old account's save response after switching accounts in flight", async () => {
    let finishPost!: (result: ReturnType<typeof json>) => void;
    fetchMock.mockImplementation(async (_url, options) =>
      options?.method === "POST"
        ? new Promise((resolve) => {
            finishPost = resolve;
          })
        : json(emptyReceipt)
    );
    state.user = memberA;
    await render();
    await typeExperience(comment);
    await submit();
    expect(posts()).toHaveLength(1);
    const payload = JSON.parse(posts()[0][1].body);
    state.user = memberB;
    await render();
    expect(textInput()?.value).toBe("");
    await act(async () =>
      finishPost(
        json({
          recommendation: {
            id: payload.submissionId,
            comment,
            moderationStatus: "pending",
            isPublic: false,
          },
          missingVerification: ["email"],
        })
      )
    );
    await settle();
    expect(container.textContent).not.toContain(comment);
    expect(container.querySelector('[data-testid="recommendation-saved"]')).toBeNull();
    expect(readRecommendationDraft(actualStorage, contractorId, memberB.id)).toBeNull();
  });

  it("uses B's restored draft when switching from A into B's already successful query cache", async () => {
    state.user = memberA;
    await render({ resumeSaved: true });
    await typeExperience(comment);
    const memberADraft = readRecommendationDraft(actualStorage, contractorId, memberA.id)!;
    const memberBSubmissionId = "6652f8df-b5b1-45ca-a5d4-d0bc8772fd36";
    const memberBComment = "They installed our new shelves and arrived when promised.";
    saveRecommendationDraft(actualStorage, {
      version: 1,
      contractorId,
      ownerUserId: memberB.id,
      savedAt: Date.now(),
      readyToSubmit: true,
      data: {
        submissionId: memberBSubmissionId,
        recommendationType: "positive",
        comment: memberBComment,
      },
    });
    client.setQueryData([endpoint, "mine", memberB.id], emptyReceipt);
    expect(posts()).toHaveLength(0);

    state.user = memberB;
    await render();
    await eventually(() => expect(posts()).toHaveLength(1));
    await settle();
    expect(posts()).toHaveLength(1);
    const request = posts()[0][1];
    expect(request.headers["X-Expected-Account-Id"]).toBe(memberB.id);
    expect(JSON.parse(request.body)).toMatchObject({
      submissionId: memberBSubmissionId,
      comment: memberBComment,
    });
    expect(JSON.parse(request.body).comment).not.toBe(comment);
    expect(readRecommendationDraft(actualStorage, contractorId, memberA.id)).toEqual(memberADraft);
    expect(container.textContent).not.toContain(comment);
  });

  it("keeps a new owned draft visible when an older recommendation is returned by mine", async () => {
    state.user = memberA;
    const newSubmissionId = "dcd75a8b-aa46-4db5-a4fa-afcc45bc5b99";
    const oldRecommendation = {
      id: "a115e2c4-24ac-4499-b4b4-172a962be97f",
      comment: "My older project went smoothly.",
      moderationStatus: "approved",
      isPublic: true,
      createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    };
    saveRecommendationDraft(actualStorage, {
      version: 1,
      contractorId,
      ownerUserId: memberA.id,
      savedAt: Date.now(),
      readyToSubmit: true,
      data: { submissionId: newSubmissionId, recommendationType: "positive", comment },
    });
    fetchMock.mockImplementation(async (_url, options) => {
      if (options?.method === "POST") {
        const payload = JSON.parse(options.body);
        return json({
          recommendation: {
            id: payload.submissionId,
            comment: payload.comment,
            moderationStatus: "pending",
            isPublic: false,
          },
          missingVerification: ["email"],
        });
      }
      return json({ recommendation: oldRecommendation, missingVerification: [] });
    });
    await render({ resumeSaved: false });
    await eventually(() =>
      expect(client.getQueryData([endpoint, "mine", memberA.id])).toEqual({
        recommendation: oldRecommendation,
        missingVerification: [],
      })
    );
    expect(textInput()?.value).toBe(comment);
    expect(container.textContent).not.toContain(oldRecommendation.comment);
    expect(container.querySelector('[data-testid="recommendation-saved"]')).toBeNull();
    expect(posts()).toHaveLength(0);
    expect(
      readRecommendationDraft(actualStorage, contractorId, memberA.id)?.data.submissionId
    ).toBe(newSubmissionId);

    await submit();
    await eventually(() =>
      expect(container.querySelector('[data-testid="recommendation-saved"]')).not.toBeNull()
    );
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(posts()[0][1].body)).toMatchObject({
      submissionId: newSubmissionId,
      comment,
    });
    expect(container.textContent).toContain(comment);
    expect(container.textContent).not.toContain(oldRecommendation.comment);
  });

  it("disables recommendation fields and submission controls while a save is pending", async () => {
    state.user = memberA;
    fetchMock.mockImplementation(async (_url, options) =>
      options?.method === "POST" ? new Promise(() => {}) : json(emptyReceipt)
    );
    await render();
    await typeExperience(comment);
    await submit();
    await eventually(() => expect(posts()).toHaveLength(1));
    const controls = container.querySelectorAll("form input, form textarea, form button");
    expect(controls.length).toBeGreaterThan(5);
    for (const control of controls) {
      expect(
        control.matches(":disabled") || control.getAttribute("aria-disabled") === "true",
        control.outerHTML
      ).toBe(true);
    }
    expect(readRecommendationDraft(actualStorage, contractorId, memberA.id)?.data.comment).toBe(
      comment
    );
  });

  it("requires a choice when an explicit guest handoff conflicts with an account draft", async () => {
    await render();
    await typeExperience(comment);
    await submit();
    await click("I already have an account");
    const guestDraft = readRecommendationDraft(actualStorage, contractorId, null)!;
    const ownDraft = {
      version: 1 as const,
      contractorId,
      ownerUserId: memberA.id,
      savedAt: Date.now(),
      readyToSubmit: true,
      data: {
        submissionId: "564399c0-0959-4506-9df5-2e6e515c7054",
        recommendationType: "negative" as const,
        comment: "I already drafted feedback about a different visit.",
      },
    };
    saveRecommendationDraft(actualStorage, ownDraft);
    state.user = memberA;
    await render({ resumeSaved: true });
    await settle();
    expect(posts()).toHaveLength(0);
    expect(textInput()?.value).toBe(ownDraft.data.comment);
    expect(readRecommendationDraft(actualStorage, contractorId, memberA.id)).toEqual(ownDraft);
    expect(readRecommendationDraft(actualStorage, contractorId, null)).toEqual(guestDraft);
    expect(container.textContent).toContain("Restore a draft saved on this device");
    await submit();
    expect(posts()).toHaveLength(0);
    await click("Restore a draft saved on this device");
    expect(textInput()?.value).toBe(comment);
    expect(posts()).toHaveLength(0);
    await submit();
    await eventually(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0][1].body).submissionId).toBe(guestDraft.data.submissionId);
  });

  it("does not carry an unresolved guest handoff conflict into a different account", async () => {
    await render();
    await typeExperience(comment);
    await submit();
    await click("I already have an account");
    const guestDraft = readRecommendationDraft(actualStorage, contractorId, null)!;
    const ownDraft = {
      version: 1 as const,
      contractorId,
      ownerUserId: memberA.id,
      savedAt: Date.now(),
      readyToSubmit: true,
      data: {
        submissionId: "29e9aeef-50e8-4484-8313-2b4fdc6e0a39",
        recommendationType: "negative" as const,
        comment: "This account has unfinished feedback about an earlier visit.",
      },
    };
    saveRecommendationDraft(actualStorage, ownDraft);
    state.user = memberA;
    await render({ resumeSaved: true });
    expect(textInput()?.value).toBe(ownDraft.data.comment);
    expect(container.textContent).toContain("Restore a draft saved on this device");
    expect(posts()).toHaveLength(0);

    state.user = memberB;
    await render();
    await settle();
    expect(posts()).toHaveLength(0);
    expect(textInput()?.value).toBe("");
    expect(readRecommendationDraft(actualStorage, contractorId, null)).toEqual(guestDraft);
    expect(readRecommendationDraft(actualStorage, contractorId, memberA.id)).toEqual(ownDraft);
    expect(readRecommendationDraft(actualStorage, contractorId, memberB.id)).toBeNull();
    expect(container.textContent).toContain("Restore a draft saved on this device");

    await click("Restore a draft saved on this device");
    expect(textInput()?.value).toBe(comment);
    expect(posts()).toHaveLength(0);
  });

  it("keeps an explicitly handed-off guest draft recoverable when account storage adoption fails", async () => {
    await render();
    await typeExperience(comment);
    await submit();
    await click("I already have an account");
    const guestDraft = readRecommendationDraft(actualStorage, contractorId, null)!;
    state.storageUnavailable = true;
    state.user = memberA;
    await render({ resumeSaved: true });
    await settle();
    expect(posts()).toHaveLength(0);
    expect(readRecommendationDraft(actualStorage, contractorId, null)).toEqual(guestDraft);
    expect(readRecommendationDraft(actualStorage, contractorId, memberA.id)).toBeNull();
    expect(container.textContent).toContain("Restore a draft saved on this device");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    const lastNavigation = state.navigate.mock.calls.at(-1)?.[0];
    expect(lastNavigation).toBe(
      `/pre-scout-setup?mode=signin&next=${encodeURIComponent(recommendationPath)}`
    );
    state.storageUnavailable = false;
    state.user = memberB;
    await render();
    await settle();
    expect(posts()).toHaveLength(0);
    expect(readRecommendationDraft(actualStorage, contractorId, null)).toEqual(guestDraft);
    expect(textInput()?.value).toBe("");
  });

  it.each(["same submission", "new submission"])(
    "preserves newer stored text when an older save completes (%s)",
    async (kind) => {
      let finishPost!: (result: ReturnType<typeof json>) => void;
      fetchMock.mockImplementation(async (_url, options) =>
        options?.method === "POST"
          ? new Promise((resolve) => {
              finishPost = resolve;
            })
          : json(emptyReceipt)
      );
      state.user = memberA;
      await render();
      await typeExperience(comment);
      await submit();
      const payload = JSON.parse(posts()[0][1].body);
      const newerDraft = {
        version: 1 as const,
        contractorId,
        ownerUserId: memberA.id,
        savedAt: Date.now(),
        readyToSubmit: false,
        data: {
          ...payload,
          submissionId:
            kind === "same submission"
              ? payload.submissionId
              : "e6bf9f66-9833-4a93-8940-3f239339eb74",
          comment: "Newer text saved from another tab must stay available.",
        },
      };
      saveRecommendationDraft(actualStorage, newerDraft);
      await act(async () =>
        finishPost(
          json({
            recommendation: {
              id: payload.submissionId,
              comment: payload.comment,
              moderationStatus: "pending",
              isPublic: false,
            },
            missingVerification: ["email"],
          })
        )
      );
      await settle();
      expect(readRecommendationDraft(actualStorage, contractorId, memberA.id)).toEqual(newerDraft);
    }
  );
});
