// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SEOHelmet } from "./SEOHelmet";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("wouter", () => ({
  useLocation: () => [window.location.pathname + window.location.search],
}));

describe("audience-qualified stone metadata", () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    if (root) act(() => root.unmount());
    host?.remove();
    document.head.querySelectorAll('[data-managed-by="seo-helmet"]').forEach((node) => node.remove());
    document.head.querySelectorAll('link[rel="canonical"]').forEach((node) => node.remove());
  });

  it("keeps OG URLs absolute and the market query while omitting a stale canonical", async () => {
    const id = "tradescout-stone-aj-quartz";
    const search = "?audienceState=TX&audienceCountry=US";
    const detail = `${window.location.origin}/exchange/building-materials/${id}${search}`;
    const image = `${window.location.origin}/api/exchange/stone-media/${id}${search}`;
    window.history.replaceState({}, "", `/exchange/building-materials/${id}${search}`);
    const stale = document.createElement("link");
    stale.rel = "canonical";
    stale.href = `/exchange/building-materials/${id}`;
    document.head.appendChild(stale);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => root.render(
      <SEOHelmet
        title="AJ Quartz"
        description="Slab price TBD. Published material rate $30.00 / sq ft."
        canonical={detail}
        ogImage={image}
        preserveCanonicalQuery
        omitCanonical
        robots="noindex, follow"
      />
    ));

    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe(detail);
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(image);
    expect(document.querySelector('meta[name="twitter:image"]')?.getAttribute("content")).toBe(image);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, follow");
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
