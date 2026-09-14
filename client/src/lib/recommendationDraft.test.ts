// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginRecommendationHandoff,
  browserRecommendationHandoffStorage,
  browserRecommendationDraftStorage,
  clearRecommendationHandoff,
  clearRecommendationDraft,
  emptyRecommendation,
  hasRecommendationHandoff,
  readRecommendationDraft,
  saveRecommendationDraft,
  type RecommendationDraft,
} from "./recommendationDraft";

const now = Date.UTC(2026, 8, 8, 12);
const submissionId = "9c81d74a-9b11-4f62-93f0-a56b4305e1f7";
const makeDraft = (overrides: Partial<RecommendationDraft> = {}): RecommendationDraft => ({
  version: 1,
  contractorId: "contractor-1",
  ownerUserId: null,
  savedAt: now,
  readyToSubmit: false,
  data: { submissionId, recommendationType: "positive", comment: "Good" },
  ...overrides,
});

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("explicit recommendation account handoff", () => {
  const path = "/u/acme-repair?trustAction=recommend";
  it("binds one pending handoff to the exact business, submission and return path", () => {
    const storage = browserRecommendationHandoffStorage();
    expect(hasRecommendationHandoff(storage, "contractor-1", submissionId, path, now)).toBe(false);
    expect(beginRecommendationHandoff(storage, "contractor-1", submissionId, path, now)).toBe(true);
    expect(hasRecommendationHandoff(storage, "contractor-1", submissionId, path, now + 1)).toBe(
      true
    );
    expect(hasRecommendationHandoff(storage, "contractor-2", submissionId, path, now + 1)).toBe(
      false
    );
    expect(
      hasRecommendationHandoff(storage, "contractor-1", "other-submission", path, now + 1)
    ).toBe(false);
    expect(
      hasRecommendationHandoff(
        storage,
        "contractor-1",
        submissionId,
        "/u/another-business?trustAction=recommend",
        now + 1
      )
    ).toBe(false);
    clearRecommendationHandoff(storage);
    expect(hasRecommendationHandoff(storage, "contractor-1", submissionId, path, now + 1)).toBe(
      false
    );
    expect(window.localStorage.length).toBe(0);
  });

  it("expires the account handoff and rejects future timestamps", () => {
    const storage = browserRecommendationHandoffStorage();
    beginRecommendationHandoff(storage, "contractor-1", submissionId, path, now);
    expect(hasRecommendationHandoff(storage, "contractor-1", submissionId, path, now - 1)).toBe(
      false
    );
    expect(
      hasRecommendationHandoff(storage, "contractor-1", submissionId, path, now + 30 * 60 * 1000)
    ).toBe(false);
  });

  it("does not claim success if session storage cannot arm the handoff", () => {
    const actualWindow = window;
    vi.stubGlobal(
      "window",
      new Proxy(actualWindow, {
        get(target, property) {
          if (property === "sessionStorage") throw new Error("Session storage denied");
          return Reflect.get(target, property, target);
        },
      })
    );
    const storage = browserRecommendationHandoffStorage();
    expect(beginRecommendationHandoff(storage, "contractor-1", submissionId, path, now)).toBe(
      false
    );
    expect(hasRecommendationHandoff(storage, "contractor-1", submissionId, path, now)).toBe(false);
    expect(() => clearRecommendationHandoff(storage)).not.toThrow();
  });
});

describe("private recommendation drafts", () => {
  it("restores partial text below the submit minimum without changing its submission identity", () => {
    const storage = browserRecommendationDraftStorage();
    expect(saveRecommendationDraft(storage, makeDraft())).toBe(true);
    expect(readRecommendationDraft(storage, "contractor-1", null, now)).toEqual(makeDraft());
    const updated = makeDraft({
      data: { ...makeDraft().data, comment: "Good work. Finished cleanly." },
      readyToSubmit: true,
    });
    expect(saveRecommendationDraft(storage, updated)).toBe(true);
    expect(readRecommendationDraft(storage, "contractor-1", null, now)).toEqual(updated);
    expect(readRecommendationDraft(storage, "contractor-1", null, now)?.data.submissionId).toBe(
      submissionId
    );
  });

  it("isolates guests, different members, and different businesses", () => {
    const storage = browserRecommendationDraftStorage();
    saveRecommendationDraft(storage, makeDraft());
    saveRecommendationDraft(
      storage,
      makeDraft({
        ownerUserId: "member-a",
        data: { ...makeDraft().data, comment: "Member A private text" },
      })
    );
    saveRecommendationDraft(
      storage,
      makeDraft({
        contractorId: "contractor-2",
        ownerUserId: "member-b",
        data: { ...makeDraft().data, comment: "Other business text" },
      })
    );
    expect(readRecommendationDraft(storage, "contractor-1", "member-b", now)).toBeNull();
    expect(readRecommendationDraft(storage, "contractor-1", "member-a", now)?.data.comment).toBe(
      "Member A private text"
    );
    expect(readRecommendationDraft(storage, "contractor-1", null, now)?.data.comment).toBe("Good");
    expect(readRecommendationDraft(storage, "contractor-2", "member-b", now)?.data.comment).toBe(
      "Other business text"
    );
    clearRecommendationDraft(storage, "contractor-1", "member-a");
    expect(readRecommendationDraft(storage, "contractor-1", "member-a", now)).toBeNull();
    expect(readRecommendationDraft(storage, "contractor-1", null, now)).not.toBeNull();
  });

  it.each([{ savedAt: now - 7 * 24 * 60 * 60 * 1000 - 1 }, { savedAt: now + 60_001 }])(
    "rejects and removes expired or future-dated records: %j",
    (overrides) => {
      const storage = browserRecommendationDraftStorage();
      saveRecommendationDraft(storage, makeDraft(overrides));
      expect(readRecommendationDraft(storage, "contractor-1", null, now)).toBeNull();
      expect(window.localStorage.length).toBe(0);
    }
  );

  it("rejects a record whose embedded owner differs from its storage location", () => {
    const storage = browserRecommendationDraftStorage();
    saveRecommendationDraft(storage, makeDraft({ ownerUserId: "member-b" }));
    const key = window.localStorage.key(0)!;
    window.localStorage.setItem(key, JSON.stringify(makeDraft({ ownerUserId: "member-a" })));
    expect(readRecommendationDraft(storage, "contractor-1", "member-b", now)).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("treats malformed and unsupported persisted data as absent", () => {
    const storage = browserRecommendationDraftStorage();
    saveRecommendationDraft(storage, makeDraft());
    const key = window.localStorage.key(0)!;
    for (const value of [
      "not JSON",
      JSON.stringify({ ...makeDraft(), version: 2 }),
      JSON.stringify({ ...makeDraft(), data: { comment: "Missing identifier" } }),
    ]) {
      window.localStorage.setItem(key, value);
      expect(readRecommendationDraft(storage, "contractor-1", null, now)).toBeNull();
    }
  });

  it("reports unavailable storage without falsely claiming a draft was saved", () => {
    const unavailable = {
      getItem: vi.fn(() => {
        throw new Error("Storage denied");
      }),
      setItem: vi.fn(() => {
        throw new Error("Storage denied");
      }),
      removeItem: vi.fn(() => {
        throw new Error("Storage denied");
      }),
    };
    expect(saveRecommendationDraft(unavailable, makeDraft())).toBe(false);
    expect(readRecommendationDraft(unavailable, "contractor-1", null, now)).toBeNull();
    expect(() => clearRecommendationDraft(unavailable, "contractor-1", null)).not.toThrow();
  });

  it("fails safely when the browser denies access to localStorage itself", () => {
    const actualWindow = window;
    vi.stubGlobal(
      "window",
      new Proxy(actualWindow, {
        get(target, property) {
          if (property === "localStorage") throw new Error("Storage denied");
          return Reflect.get(target, property, target);
        },
      })
    );
    const storage = browserRecommendationDraftStorage();
    expect(saveRecommendationDraft(storage, makeDraft())).toBe(false);
    expect(readRecommendationDraft(storage, "contractor-1", null, now)).toBeNull();
  });

  it("gives each new draft a distinct valid id and no fabricated experience", () => {
    const first = emptyRecommendation();
    const second = emptyRecommendation();
    expect(first.submissionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(first.submissionId).not.toBe(second.submissionId);
    expect(first.comment).toBe("");
    expect(first.recommendationType).toBe("positive");
  });
});
