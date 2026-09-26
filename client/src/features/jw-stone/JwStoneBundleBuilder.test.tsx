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
  it("shows unlocked pricing and a completed progress bar for seven eligible mixed slabs", () => {
    const html = markup(review(["Stone A", "Stone B"], [3, 4]));
    expect(html).toContain("Bundle pricing unlocked");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="7"');
    expect(html).toContain("Mix eligible materials at each stone’s listed bundle rate");
    expect(html).not.toContain("needs JW Stone confirmation");
  });
  it("shows one more slab needed for a mixed six-slab selection", () => {
    const html = markup(review(["Stone A", "Stone B"], [3, 3]));
    expect(html).toContain("Add 1 more eligible slab to unlock bundle pricing");
    expect(html).toContain('aria-valuenow="6"');
    expect(html).not.toContain("Bundle pricing unlocked");
  });
  it("retains the remaining quantity for one checked material", () => {
    const html = markup(review(["Stone A"], [6]));
    expect(html).toContain("Add 1 more eligible slab to unlock bundle pricing");
    expect(html).toContain('aria-valuenow="6"');
  });
  it("unlocks seven checked slabs of the same canonical material across lots", () => {
    const html = markup(review(["Stone A", "STONE-A"], [3, 4]));
    expect(html).toContain("Bundle pricing unlocked");
    expect(html).toContain('aria-valuenow="7"');
  });
  it("explains mix-and-match eligibility and material-specific exceptions before stock selection", () => {
    const html = markup();
    expect(html).toContain("Choose 7 eligible slabs");
    expect(html).toContain("Mix eligible materials at each stone’s listed bundle rate");
    expect(html).toContain("Special higher-minimum materials do not count");
  });
  it("shows the checking state while a changed selection is being reviewed", () => {
    expect(markup(review(["Stone A", "Stone B"], [3, 4]), true)).toContain("Checking bundle eligibility");
  });
  it("still requires a known material identity instead of approving unidentified stock", () => {
    const html = markup(review(["Stone A", ""], [3, 4]));
    expect(html).toContain("Confirm the material for each stock selection");
    expect(html).not.toContain("Bundle pricing unlocked");
    expect(html).not.toContain('role="progressbar"');
  });
});
