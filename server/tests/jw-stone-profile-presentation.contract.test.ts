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
    expect(source).toContain("Browse all {allInventoryStones.length} stones");
    expect(source).toContain('id="inventory-browser"');
  });

  it("owns public-profile navigation after leaving the app shell", () => {
    expect(source).toContain('aria-label="Go back"');
    expect(source).toContain('aria-label="TradeScout home"');
    expect(source).toContain("window.history.back()");
    expect(source).toContain("fixed inset-x-0 top-0 z-40");
  });
});
