import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/profile-sites/WholesalerProfileThemeCore.tsx"),
  "utf8"
);
const expressSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx"),
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
    expect(source).toContain("rgba(7,15,18,0.66)_0%");
    const ctaImage = source.indexOf("{blueGoiasInventoryCtaImage ?");
    const ctaStart = source.lastIndexOf("<button", ctaImage);
    const ctaEnd = source.indexOf("</button>", ctaStart);
    const ctaSource = source.slice(ctaStart, ctaEnd);
    expect(ctaSource).not.toContain("<LayoutGrid");
    expect(ctaSource).not.toContain("<ChevronRight");
    expect(source).toContain('className="-mx-4 mt-0 md:-mx-6"');
    expect(ctaSource).toContain("min-h-[320px]");
    expect(ctaSource).not.toContain("rounded-[1.75rem]");
    expect(source).not.toContain("{allInventoryStones.length} stones · one collection");
    expect(source).not.toContain("{allInventoryStones.length} current stones");
    expect(source).toContain('id="inventory-browser"');
  });

  it("presents a premium featured-offer row without fashion-copy language", () => {
    expect(source).toContain("Featured stone offers");
    expect(source).not.toContain("The JW Stone edit");
    expect(source).toContain("Stone worth building around.");
    expect(source).toContain("Three standouts from the current collection");
    expect(source).toContain("offer.availability");
    expect(source).toMatch(/slug: "rhino-white"[\s\S]{0,260}badge: "New inventory"/);
    expect(source).toContain("offer.badge");
  });

  it("shows each complete featured slab rotated into the portrait card", () => {
    expect(source).toContain('className="relative aspect-[2/3] overflow-hidden');
    expect(source).toContain("rotate-90 object-contain");
    expect(source).toContain("h-2/3 w-[150%] max-w-none");
  });

  it("turns a zero-result search into a prefilled material request", () => {
    expect(source).toContain("Request this stone");
    expect(source).toContain("JW Stone may be able to source it for your project.");
    expect(source).toContain('startDirectConnect(inventorySearch.trim(), "request_material")');
  });

  it("unwinds JW Stone states before offering an account-aware TradeScout exit", () => {
    expect(source).toContain('aria-label="Back within JW Stone"');
    expect(source).toContain("if (expressPanelOpen)");
    expect(source).toContain("if (openStone)");
    expect(source).toContain("if (inventoryExpanded)");
    expect(source).toContain(
      'const tradeScoutExitHref = hasViewerSession ? "/direct-connect" : "/";'
    );
    expect(source).toContain('"Close JW Stone and return to Direct Connect"');
    expect(source).toContain('"Close JW Stone and return to TradeScout"');
    expect(source).not.toContain("window.history.back()");
    expect(source).toContain("fixed inset-x-0 top-0 z-40");
  });

  it("keeps TradeScout actions orange and JW Stone inventory actions green", () => {
    expect(source).toContain("bg-ts-orange/85");
    expect(source).toContain("hover:bg-ts-orange-dark");
    expect(source).toContain(
      "group flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-accent)]"
    );
    expect(source).toContain("Request this stone");
    expect(source).toContain(
      "bg-[var(--brand-accent)] px-6 py-3 text-sm font-extrabold text-[#16200b]"
    );
    expect(expressSource).toContain("text-ts-orange-dark");
    expect(expressSource).toContain(
      "bg-ts-orange px-7 py-3 font-semibold text-white transition-colors hover:bg-ts-orange-dark"
    );
  });

  it("keeps the JW Stone brand centered between profile navigation controls", () => {
    expect(source).toContain("grid-cols-[1fr_auto_1fr]");
    expect(source).toContain('aria-label="JW Stone"');
    expect(source).toContain('className="h-auto w-[132px] sm:w-[164px] md:w-[204px]"');
    expect(source).toContain("justify-self-start");
    expect(source).toContain("justify-self-end");
  });
});
