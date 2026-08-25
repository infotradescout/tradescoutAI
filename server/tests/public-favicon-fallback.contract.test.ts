import { describe, expect, it, vi } from "vitest";
import { handlePublicFaviconFallback } from "../publicFaviconFallback";

describe("public favicon fallback", () => {
  it.each(["GET", "HEAD"])("permanently redirects %s /favicon.ico to the real PNG asset", (method) => {
    const setHeader = vi.fn();
    const redirect = vi.fn();
    const handled = handlePublicFaviconFallback(
      { path: "/favicon.ico", method } as any,
      { setHeader, redirect } as any
    );

    expect(handled).toBe(true);
    expect(setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800"
    );
    expect(redirect).toHaveBeenCalledWith(301, "/favicon-32x32.png");
  });

  it("leaves all other assets and non-read methods unchanged", () => {
    const redirect = vi.fn();
    expect(
      handlePublicFaviconFallback(
        { path: "/favicon-32x32.png", method: "GET" } as any,
        { redirect } as any
      )
    ).toBe(false);
    expect(
      handlePublicFaviconFallback(
        { path: "/favicon.ico", method: "POST" } as any,
        { redirect } as any
      )
    ).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
  });
});
