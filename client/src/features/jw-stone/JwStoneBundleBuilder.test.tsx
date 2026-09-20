import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { JwStoneCartReview } from "@shared/jwStoneCart";
import { getJwStoneBundleProgress } from "@shared/jwStoneBundle";
import { JwStoneBundleBuilder } from "./JwStoneBundleBuilder";

function review(materials: string[], quantities: number[]): JwStoneCartReview {
  const lines = materials.map((materialName, index) => ({
    status: "ready" as const,
    materialName,
    requestedQuantity: quantities[index],
    bundlePricing: {
      slabRateCents: 300,
      bundleRateCents: 200,
      minimumSlabs: 7,
      regularOneSlabCents: 15000,
      bundleOneSlabCents: 10000,
    },
  }));
  // Rendering-only fixture: monetary and request authority are exercised by the HTTP/native tests.
  return { lines, bundle: getJwStoneBundleProgress(lines) } as unknown as JwStoneCartReview;
}
function markup(value?: JwStoneCartReview, checking = false) {
  return renderToStaticMarkup(
    <JwStoneBundleBuilder review={value} empty={!value} checking={checking} onBrowse={() => {}} />
  );
}

describe("JW Stone bundle eligibility messaging", () => {
  it("does not show unlocked pricing or a completed progress bar for mixed materials", () => {
    const html = markup(review(["Stone A", "Stone B"], [3, 4]));
    expect(html).toContain("Mixed-material bundle eligibility needs JW Stone confirmation");
    expect(html).toContain("Materials are priced separately");
    expect(html).not.toContain("Bundle pricing unlocked");
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain("Mix eligible materials");
  });
  it("does not encourage adding a different material to finish a mixed six-slab selection", () => {
    const html = markup(review(["Stone A", "Stone B"], [3, 3]));
    expect(html).toContain("needs JW Stone confirmation");
    expect(html).not.toContain("Add 1 more");
  });
  it("retains the remaining quantity for one checked material", () => {
    const html = markup(review(["Stone A"], [6]));
    expect(html).toContain("Add 1 more eligible slab of this material");
    expect(html).toContain('aria-valuenow="6"');
  });
  it("unlocks seven checked slabs of the same canonical material across lots", () => {
    const html = markup(review(["Stone A", "STONE-A"], [3, 4]));
    expect(html).toContain("Bundle pricing unlocked");
    expect(html).toContain('aria-valuenow="7"');
    expect(html).not.toContain("Materials are priced separately");
  });
  it("does not promise mix-and-match eligibility before selecting stock", () => {
    const html = markup();
    expect(html).toContain("check seven-slab bundle eligibility");
    expect(html).toContain("Combining different materials into a");
    expect(html).not.toContain("Mix eligible materials");
  });
  it("shows the checking state while a changed selection is being reviewed", () => {
    expect(markup(review(["Stone A", "Stone B"], [3, 4]), true)).toContain("Checking bundle eligibility");
  });
});
