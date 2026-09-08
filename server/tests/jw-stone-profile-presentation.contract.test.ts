import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  JW_STONE_PROFILE_PRESENTATION_BLOCK,
  JW_STONE_PUBLIC_DISCOVERY_BLOCK,
} from "../../client/src/data/jwStoneProfilePresentation";

function readWorkspaceOrTrackedFile(relativePath: string) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (fs.existsSync(absolutePath)) {
    return fs.readFileSync(absolutePath, "utf8");
  }
  return execFileSync("git", ["show", `HEAD:${relativePath}`], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx"),
  "utf8"
);
const expressSource = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx"),
  "utf8"
);
const presentation = JW_STONE_PROFILE_PRESENTATION_BLOCK.data;
const migrationSource = fs.readFileSync(
  path.resolve(process.cwd(), "migrations/0110_jw_stone_profile_presentation.sql"),
  "utf8"
);
const discoveryMigrationSource = fs.readFileSync(
  path.resolve(process.cwd(), "migrations/0111_jw_stone_public_discovery_routes.sql"),
  "utf8"
);
const recoveryMigrationSource = fs.readFileSync(
  path.resolve(process.cwd(), "migrations/0121_jw_stone_inventory_truth.sql"),
  "utf8"
);
const inventory = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "client/src/data/jwStoneInventory.generated.json"),
    "utf8"
  )
) as Array<{ slug: string; sourceFileIds?: string[] }>;
const driveSource = JSON.parse(
  readWorkspaceOrTrackedFile("docs/audits/data/jw-stone-drive-source-2026-07-13.json")
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
    expect(presentation.hero.inventoryItemSlug).toBe("amazonic-green");
    expect(presentation.hero.eyebrow).toBe("Amazonic Green · material library");
    expect(presentation.hero.videoUrl).toBe("/images/businesses/jw-stone/video/hero.mp4");
    expect(presentation.hero.posterUrl).toBe("/images/businesses/jw-stone/video/hero-poster.jpg");
    expect(presentation.hero.preserveMedia).toBe(true);
    expect(source).toContain('heroVideoZoomed ? "scale-100 md:scale-[1.12]" : "scale-100"');
    expect(source).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(source).toContain("autoPlay={!prefersReducedMotion}");
    expect(source).toContain("!preserveHeroMedia && !isIssaBuild");
    expect(source).not.toContain("isJwStone");
    expect(source).not.toContain('profileSlug === "jw-stone"');
  });

  it("makes the full catalog the primary JW Stone action", () => {
    expect(presentation.inventory.initialView).toBe("catalog");
    expect(presentation.inventory.density).toBe("compact");
    expect(presentation.inventory.pageSize).toBe(12);
    expect(presentation.inventory.pageStep).toBe(12);
    expect(presentation.inventory.stickyControls).toBe(true);
    expect(source).toContain("const openFullInventory = () =>");
    expect(source).toContain("useState(inventoryOpenByDefault)");
    expect(source).toContain("useState(inventoryPageSize)");
    expect(source).toContain("Browse full inventory");
    expect(presentation.inventory.browseCtaEyebrow).toBe("White Rhino · material library");
    expect(source).toContain("inventoryBrowseCtaImage");
    expect(source).toContain("rgba(7,15,18,0.66)_0%");
    const ctaImage = source.indexOf("{inventoryBrowseCtaImage ?");
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
    expect(source).toContain("hasInventoryFilters || compactInventory");
    expect(source).toContain("grid-cols-2");
    expect(source).toContain("xl:grid-cols-5");
  });

  it("adapts the customer path without removing any of the four established audiences", () => {
    expect(presentation.audience.layout).toBe("guided");
    expect(source).toContain('data-testid="profile-audience-chooser"');
    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain("Fabricators");
    expect(source).toContain("Builders & Developers");
    expect(source).toContain("Architects & Designers");
    expect(source).toContain("Homeowners");
    expect(source).toContain(
      "Review named stone, confirmed finishes where listed, and source bundle counts"
    );
    expect(source).toContain(
      "Share project volume, location, and timing so ${displayName} can review material consistency"
    );
    expect(source).toContain("Compare stone imagery, category, and confirmed finish details");
    expect(source).toContain("Start with a room, inspiration, or selected stone");
    expect(source).toContain('requestType: "ask_about_bundle"');
    expect(source.match(/requestType: "match_project"/g)).toHaveLength(3);
    expect(presentation.audience).not.toHaveProperty("availabilityNote");
    expect(presentation.audience.contextHeading).toBe("Helpful context to include");
    expect(source).not.toContain("Serving Pensacola");
    expect(source).not.toContain("no minimum order");
    expect(source).not.toContain("what's actually in stock");
  });

  it("reduces vertical scroll through progressive disclosure while retaining the source content", () => {
    expect(presentation.story.images).toHaveLength(4);
    expect(presentation.faq.layout).toBe("disclosure");
    expect(presentation.recommendations.initialLimit).toBe(3);
    expect(presentation.recommendations.maxVisible).toBe(24);
    expect(source).toContain("storyImages.map");
    expect(source).toContain("snap-mandatory");
    expect(source).toContain("<details");
    expect(source).toContain("recommendationsExpanded");
    expect(source).toContain("Show fewer recommendations");
    expect(source).toContain("recommendationMaxVisible");
    expect(source).toContain('id="why-us"');
    expect(source).toContain('id="materials"');
    expect(source).toContain('id="connect"');
    expect(source).toContain('data-testid="wholesaler-brand-footer"');
    expect(source).toContain("Powered by TradeScout");
    expect(source).toContain('qualifyPublicProfileItemDestination("/", platformBaseHref)');
  });

  it("presents a premium featured row of random picks refreshed every visit, without fashion-copy language or pricing", () => {
    expect(source).toContain("Featured stones");
    expect(source).not.toContain("The JW Stone edit");
    expect(source).toContain("Stone worth building around.");
    expect(source).not.toContain("reload to see more");
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
    expect(source).toContain('data-testid="profile-featured-product-card"');
    expect(source).toContain('className="relative aspect-[4/3] overflow-hidden');
    expect(source).toContain("View details");
    expect(source).toContain("profileInventoryShareIndexForDisplay(");
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
    expect(presentation.inventory.sourceRequests).toBe(true);
    expect(source).toContain("Direct Connect");
    expect(source).toContain("${displayName} may be able to source it for your project.");
    expect(source).toContain('startDirectConnect(inventorySearch.trim(), "request_material")');
  });

  it("unwinds JW Stone states in-profile; TradeScout exit stays in the site footer only", () => {
    expect(presentation.header.backLabel).toBe("Back within JW Stone");
    expect(source).toContain("presentation.header?.backLabel");
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
    expect(source).toContain("Powered by TradeScout");
    expect(source).not.toContain("TradeScoutProfileHandoff");
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
    expect(presentation.header.layout).toBe("centered-brand");
    expect(presentation.header.logoUrl).toBe("/images/businesses/jw-stone/logo.svg");
    expect(presentation.header.homeLabel).toBe("JW Stone home");
    expect(source).toContain("grid-cols-[1fr_auto_1fr]");
    expect(source).toContain("presentation.header?.homeLabel");
    expect(source).toContain('className="h-auto w-[132px] sm:w-[164px] md:w-[204px]"');
    expect(source).toContain("justify-self-start");
    expect(source).toContain("justify-self-end");
    expect(source).toContain('centeredBrandHeader ? "pt-14 sm:pt-[96px] md:pt-[112px]" : ""');
    expect(source).toContain("hidden h-10 gap-4 px-3 pb-2 text-[11px] font-bold sm:flex");
  });

  it("preserves the historical presentation migration and converges the persisted profile", () => {
    const migratedData = migrationSource.match(/'data', '([\s\S]*?)'::jsonb/)?.[1];
    expect(migratedData).toBeTruthy();
    const migratedPresentation = JSON.parse(migratedData || "{}");
    expect(migratedPresentation.hero.eyebrow).toBe("Amazonic Green · current inventory");
    expect(migratedPresentation.copy.inventoryTitle).toBe("Current Inventory");
    expect(presentation.copy).not.toHaveProperty("footerText");
    expect(migrationSource).toContain("'type', 'profilePresentation'");
    expect(migrationSource).toContain('"brandName": "JW Stone Logistics"');
    expect(presentation.social.profileImageUrl).toBe(
      "/images/businesses/jw-stone/video/hero-poster.jpg"
    );
    expect(migrationSource).toContain(
      '"profileImageUrl": "/images/businesses/jw-stone/video/hero-poster.jpg"'
    );
    expect(migrationSource).toContain('"accentColor": "#81904a"');
    expect(presentation.social.inventoryCta).toBe("View material photos");
    expect(migrationSource).toContain('"label": "JW Stone Picks"');
    for (const slug of presentation.inventory.featuredCollection.slugs) {
      expect(migrationSource).toContain(`"${slug}"`);
    }
    expect(migrationSource).toContain("WHERE block ->> 'type' = 'profilePresentation'");
    expect(recoveryMigrationSource).toContain("'Amazonic Green · material library'");
    expect(recoveryMigrationSource).toContain("'inventoryTitle', 'Material Library'");
    expect(recoveryMigrationSource).toContain("'inventoryCta', 'View material photos'");
    expect(recoveryMigrationSource).toContain("- 'availabilityNote'");
    expect(recoveryMigrationSource).toContain("profile.slug = 'jw-stone'");
    expect(recoveryMigrationSource).toContain(
      "profile.content_blocks IS DISTINCT FROM rewritten.content_blocks"
    );
  });

  it("stores item and material routes as profile-owned discovery data", () => {
    expect(JW_STONE_PUBLIC_DISCOVERY_BLOCK.data.routes).toEqual({
      inventory: "stones",
      categories: "materials",
    });
    expect(JW_STONE_PUBLIC_DISCOVERY_BLOCK.data.categories).toHaveLength(7);
    expect(
      JW_STONE_PUBLIC_DISCOVERY_BLOCK.data.categories.find(
        (category) => category.sourceSlug === "quartz"
      )
    ).toMatchObject({
      publicSlug: "engineered-quartz",
      title: "Engineered Quartz",
      leadItemSlug: "aj-quartz",
      indexable: true,
    });
    expect(discoveryMigrationSource).toContain("'type', 'publicDiscovery'");
    expect(discoveryMigrationSource).toContain("'inventory', 'stones'");
    expect(discoveryMigrationSource).toContain("'categories', 'materials'");
    expect(discoveryMigrationSource).toContain('"publicSlug": "engineered-quartz"');
    expect(discoveryMigrationSource).toContain("WHERE profile.slug = 'jw-stone'");
    expect(discoveryMigrationSource).toContain("'categories', defaults.categories");
    expect(discoveryMigrationSource).toContain(
      "WHERE existing.block ->> 'type' IS DISTINCT FROM 'publicDiscovery'"
    );
    expect(discoveryMigrationSource).toContain("jsonb_agg(entry.block ORDER BY entry.sort_key)");
    expect(discoveryMigrationSource).toContain(
      "rebuilt.content_blocks IS DISTINCT FROM rebuilt.next_content_blocks"
    );
    expect(recoveryMigrationSource).toContain('"collectionKind":"offerings"');
    expect(recoveryMigrationSource).toContain("material library");
  });
});
