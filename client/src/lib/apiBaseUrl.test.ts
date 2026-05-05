import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApiUrl, getApiBaseUrl } from "./apiBaseUrl";

describe("apiBaseUrl", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalWindow) {
      vi.stubGlobal("window", originalWindow);
    }
  });

  it("routes apex production API calls to canonical www host", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "thetradescout.com",
        origin: "https://thetradescout.com",
      },
    });

    expect(getApiBaseUrl()).toBe("https://www.thetradescout.com");
    expect(buildApiUrl("/api/auth/user")).toBe("https://www.thetradescout.com/api/auth/user");
  });
});
