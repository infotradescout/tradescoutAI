import { afterEach, describe, expect, it, vi } from "vitest";
import { getCanonicalAppOrigin } from "@/lib/canonicalOrigin";

describe("canonical app origin", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps customer profile domains separate from platform-owned routes", () => {
    vi.stubGlobal("window", {
      location: {
        hostname: "jwstonelogistics.com",
        origin: "https://jwstonelogistics.com",
      },
    });

    expect(getCanonicalAppOrigin()).toBe("https://www.thetradescout.com");
  });

  it("preserves local development origins", () => {
    vi.stubGlobal("window", {
      location: { hostname: "localhost", origin: "http://localhost:5173" },
    });

    expect(getCanonicalAppOrigin()).toBe("http://localhost:5173");
  });
});
