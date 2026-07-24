/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiBaseUrl", () => ({
  buildApiUrl: (url: string) => `https://example.test${url}`,
}));

import { apiRequest } from "./queryClient";

describe("apiRequest return contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns parsed JSON objects (not a Response that callers should .json())", async () => {
    const payload = [{ id: "p1", slug: "issa-build" }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify(payload),
        json: async () => {
          throw new Error("apiRequest must not leave callers needing response.json()");
        },
      }))
    );

    const result = await apiRequest("GET", "/api/profiles");
    expect(result).toEqual(payload);
    expect(typeof (result as { json?: unknown } | null)?.json).not.toBe("function");
  });

  it("still returns parsed JSON for profile detail payloads used by the editor", async () => {
    const detail = {
      id: "profile-1",
      slug: "issa-build",
      displayName: "ISSA Build",
      headline: null,
      contentBlocks: [],
      ctaConfig: {},
      seoMeta: {},
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify(detail),
        json: async () => detail,
      }))
    );

    const result = await apiRequest("GET", "/api/profiles/profile-1");
    expect(result).toEqual(detail);
    expect(Array.isArray((result as { contentBlocks: unknown[] }).contentBlocks)).toBe(true);
  });
});
