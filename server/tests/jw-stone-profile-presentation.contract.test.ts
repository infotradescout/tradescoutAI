import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/profile-sites/WholesalerProfileTheme.tsx"),
  "utf8"
);
const expressSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx"),
  "utf8"
);
const inventory = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "client/src/data/jwStoneInventory.generated.json"),
    "utf8"
  )
) as Array<{ slug: string; sourceFileIds?: string[] }>;
const driveSource = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "docs/audits/data/jw-stone-drive-source-2026-07-13.json"),
    "utf8"
  )
) as { files: Array<{ driveFileId: string; sourceName: string }> };
const sourceNameById = new Map(
  driveSource.files.map((file) => [file.driveFileId, file.sourceName] as const)
);

function isCloseUpLead(sourceName = "") {
  const name = sourceName.toLowerCase().replace(/[_-]+/g, " ");
  return /(close\s*up|closeup|close\s*look|scloseup|\bdetail\b|\btexture\b)/.test(name);
}

describe("JW Stone profile presentation contract", () => {
  it("uses the branded video hero with a restrained, reduced-motion-safe crop", () => {
    expect(source).toContain('stone.slug === "amazonic-green"');
    expect(source).toContain("Amazonic Green · current inventory");
    expect(source).toContain("/images/businesses/jw-stone/video/hero.mp4");
    expect(source).toContain("/images/businesses/jw-stone/video/hero-poster.jpg");
    expect(source).toContain('heroVideoZoomed ? "scale-100 md:scale-[1.12]" : "scale-100"');
    expect(source).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(source).toContain("autoPlay={!prefersReducedMotion}");
    // No full-bleed wash on JW Stone / ISSA Build — stone/video stays true.
    expect(source).toContain("{!isJwStone && !isIssaBuild ? (");
    expect(source).not.toMatch(
      /isJwStone \|\| isHoneyOnyx\s*\?\s*"bg-\[linear-gradient\(90deg,rgba\(9,7,4/
    );
  });

  it("makes the full catalog the primary JW Stone action", () => {
    expect(source).toContain("const openFullInventory = () =>");
    expect(source).toContain("Browse full inventory");
    expect(source).toContain('stone.slug === "rhino-white"');
    expect(source).toContain("Rhino White · current inventory");
    expect(source).toContain("rhinoWhiteWarehouseCtaImage");
    expect(source).toContain("rgba(7,15,18,0.66)_0%");
    const ctaImage = source.indexOf("{rhinoWhiteWarehouseCtaImage ?");
    const ctaStart = source.lastIndexOf("<button", ctaImage);
    const ctaEnd = source.indexOf("</button>", ctaStart);
    const ctaSource = source.slice(ctaStart, ctaEnd);
    expect(ctaSource).not.toContain("<LayoutGrid");
    expect(ctaSource).toContain("<ChevronRight");
    expect(source).toContain('className="-mx-4 mt-0 md:-mx-6"');
    expect(ctaSource).toContain("min-h-[320px]");
    expect(ctaSource).not.toContain("rounded-[1.75rem]");
    expect(source).not.toContain("{allInventoryStones.length} stones · one collection");
    expect(source).not.toContain("{allInventoryStones.length} current stones");
    expect(source).toContain('id="inventory-browser"');
  });

  it("presents a premium featured row of random picks refreshed every visit, without fashion-copy language or pricing", () => {
    expect(source).toContain("Featured stones");
    expect(source).not.toContain("The JW Stone edit");
    expect(source).toContain("Stone worth building around.");
    expect(source).toContain("Three picks from the current collection -- reload to see more.");
    // Random every visit (memoized once per mount, not weekly-locked and not
    // a fixed curated list) -- see shuffleStones + the featuredStones useMemo.
    // Unconfirmed/unnamed slabs are excluded from the random pool entirely --
    // they don't get featured until identified.
    expect(source).toContain(
      'shuffleStones(allStones.filter((stone) => stone.materialStatus !== "unconfirmed"))'
    );
    expect(source).not.toContain("JW_STONE_FEATURED_OFFERS");
    expect(source).not.toContain("offer.price");
    expect(source).not.toContain("offer.size");
    expect(source).not.toContain("offer.availability");
    expect(source).not.toContain("$/sf");
  });

  it("randomizes stone order within each category on every visit, without reassigning categories, keeping unconfirmed slabs last", () => {
    expect(source).toContain("function shuffleStones");
    expect(source).toContain("inventoryCatalogFromContent.map((category) => {");
    expect(source).toContain("...shuffleStones(confirmed), ...shuffleStones(unconfirmed)");
  });

  it("shows featured inventory as image-forward product cards", () => {
    expect(source).toContain('data-testid="jw-stone-featured-product-card"');
    expect(source).toContain('className="relative aspect-[4/3] overflow-hidden');
    expect(source).toContain("View details");
    expect(source).toContain("buildProfileInventoryShareSearch(stone.slug)");
    expect(source).not.toContain("rotate-90 object-contain");
  });

  it("leads each multi-photo stone with a full-slab context shot, not a close-up", () => {
    const closeUpLeads = inventory
      .filter((stone) => (stone.sourceFileIds?.length || 0) > 1)
      .map((stone) => ({
        slug: stone.slug,
        lead: sourceNameById.get(stone.sourceFileIds![0]) || "",
      }))
      .filter((entry) => isCloseUpLead(entry.lead));
    expect(closeUpLeads).toEqual([]);
  });

  it("turns a zero-result search into a prefilled material request", () => {
    expect(source).toContain("Direct Connect");
    expect(source).toContain("JW Stone may be able to source it for your project.");
    expect(source).toContain('startDirectConnect(inventorySearch.trim(), "request_material")');
  });

  it("unwinds JW Stone states in-profile; TradeScout exit stays in the site footer only", () => {
    expect(source).toContain('aria-label="Back within JW Stone"');
    expect(source).toContain("const goBackWithinProfile = () =>");
    expect(source).toContain("if (expressPanelOpen)");
    expect(source).toContain("if (openStone)");
    expect(source).toContain("if (inventoryExpanded)");
    expect(source).toContain("const openFullInventory = () =>");
    expect(source).toContain("View all inventory");
    expect(source).toContain("stayInProfile");
    expect(source).not.toContain('"Close JW Stone and return to Direct Connect"');
    expect(source).not.toContain('"Close JW Stone and return to TradeScout"');
    expect(source).not.toContain("window.history.back()");
    expect(source).toContain("fixed inset-x-0 top-0 z-40");
    expect(source).toContain("TradeScoutProfileHandoff");
  });

  it("keeps every Direct Connect entry action orange and honestly, contextually labeled", () => {
    expect(source).toContain("border-2 border-ts-orange");
    expect(source).toContain("hover:bg-ts-orange-dark");
    // Every entry action still routes through startDirectConnect(...). The
    // hero button opens a general request (no arguments) and stays labeled
    // "Direct Connect"; buttons that carry a stone name or search term
    // forward get a contextual label instead.
    expect(source).toContain("Request this stone");
    expect(source).toContain("Ask about this stone");
    expect(expressSource).toContain("text-ts-orange-dark");
    expect(expressSource).toContain("Fill out the form");
    expect(expressSource).toContain("Direct Connect");
  });

  it("keeps the JW Stone brand centered between profile navigation controls", () => {
    expect(source).toContain("grid-cols-[1fr_auto_1fr]");
    expect(source).toContain('aria-label="JW Stone home"');
    expect(source).toContain('className="h-auto w-[132px] sm:w-[164px] md:w-[204px]"');
    expect(source).toContain("justify-self-start");
    expect(source).toContain("justify-self-end");
    expect(source).toContain('isJwStone ? "pt-14 sm:pt-[96px] md:pt-[112px]" : ""');
    expect(source).toContain("hidden h-10 gap-4 px-3 pb-2 text-[11px] font-bold sm:flex");
  });
});
