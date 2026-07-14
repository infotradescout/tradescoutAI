import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/profile-sites/WholesalerProfileTheme.tsx"),
  "utf8"
);

describe("JW Stone profile presentation contract", () => {
  it("uses Amazonic Green as the centered ten-percent-cropped hero", () => {
    expect(source).toContain('stone.slug === "amazonic-green"');
    expect(source).toContain("Amazonic Green · current inventory");
    expect(source).toContain('className="absolute inset-0 h-full w-full scale-[1.25]');
    expect(source).toContain("a 10% crop on every side");
  });

  it("makes the full catalog the primary JW Stone action", () => {
    expect(source).toContain("const openFullInventory = () =>");
    expect(source).toContain("Browse full inventory");
    expect(source).toContain('stone.slug === "blue-goias"');
    expect(source).toContain("Blue Goias · current inventory");
    expect(source).toContain("blueGoiasInventoryCtaImage");
    expect(source).toContain('viewBox="0 0 1600 1200"');
    expect(source).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(source).toContain('transform="translate(1600 0) rotate(90)"');
    expect(source).not.toContain("{allInventoryStones.length} stones · one collection");
    expect(source).not.toContain("{allInventoryStones.length} current stones");
    expect(source).toContain('id="inventory-browser"');
  });

  it("presents the featured offer row as a premium JW Stone edit", () => {
    expect(source).toContain("The JW Stone edit");
    expect(source).toContain("Stone worth building around.");
    expect(source).toContain("Three standouts from the current collection");
    expect(source).toContain("offer.availability");
  });

  it("shows each complete featured slab rotated into the portrait card", () => {
    expect(source).toContain('className="relative aspect-[2/3] overflow-hidden');
    expect(source).toContain("rotate-90 object-contain");
    expect(source).toContain("h-2/3 w-[150%] max-w-none");
  });

  it("owns public-profile navigation after leaving the app shell", () => {
    expect(source).toContain('aria-label="Go back"');
    expect(source).toContain('aria-label="TradeScout home"');
    expect(source).toContain("window.history.back()");
    expect(source).toContain("fixed inset-x-0 top-0 z-40");
  });
});
