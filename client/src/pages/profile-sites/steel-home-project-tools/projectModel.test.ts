import { describe, expect, it } from "vitest";
import {
  JW_STONE_ANONYMOUS_CATALOG,
  JW_STONE_NAMED_CATALOG,
  getCatalogItemById,
} from "@/features/jw-stone/catalog";
import {
  STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY,
  STEEL_HOME_PROJECT_DRAFT_VERSION,
  buildSteelHomeLaborRequestHref,
  buildSteelHomeProjectDescription,
  buildSteelHomeProjectRequestHref,
  calculateCabinetPlannedWidth,
  calculateCountertopSquareFeet,
  clearSteelHomeProjectDraft,
  createEmptySteelHomeProjectDraft,
  loadSteelHomeProjectDraft,
  reconcileSteelHomeProjectDraft,
  saveSteelHomeProjectDraft,
  type SteelHomeProjectStorage,
} from "./projectModel";
import { buildStoneDesignerImageHref } from "./stoneDesignerImages";

const FORBIDDEN_PUBLIC_NAMES = [
  "Worldwide Steel Buildings",
  "JW Stone Logistics",
  "A+ Cabinets",
  "TradePartner",
];

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const storage: SteelHomeProjectStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  return { storage, values };
}

describe("steel-home project model", () => {
  it("reconciles bounds, enums, and unnamed stone records to safe planning defaults", () => {
    const anonymousStone = JW_STONE_ANONYMOUS_CATALOG[0];
    expect(anonymousStone).toBeDefined();

    const reconciled = reconcileSteelHomeProjectDraft({
      version: 99,
      location: `  ${"x".repeat(220)}  `,
      stateCode: "TX",
      countyFips: "28059",
      countyName: "invented name",
      timing: "Yesterday",
      building: {
        widthFt: 999,
        lengthFt: -50,
        eaveHeightFt: "18",
        roofStyle: "round",
      },
      countertops: {
        stoneId: anonymousStone?.id,
        wallAIn: 8,
      },
      cabinets: {
        upperHeightIn: 31,
        pantryCount: 99,
      },
      labor: {
        trades: ["Stone fabrication", "Stone fabrication", "Unknown work"],
      },
    });

    expect(reconciled.version).toBe(STEEL_HOME_PROJECT_DRAFT_VERSION);
    expect(reconciled.location).toHaveLength(160);
    expect(reconciled).toMatchObject({
      stateCode: "MS",
      countyFips: "28059",
      countyName: "Jackson County",
    });
    expect(reconciled.timing).toBe("");
    expect(reconciled.building).toMatchObject({
      widthFt: 200,
      lengthFt: 20,
      eaveHeightFt: 18,
      roofStyle: "gable",
    });
    expect(reconciled.countertops.stoneId).toBe("cristallo");
    expect(reconciled.countertops.wallAIn).toBe(24);
    expect(reconciled.cabinets.upperHeightIn).toBe(36);
    expect(reconciled.cabinets.pantryCount).toBe(4);
    expect(reconciled.labor.trades).toEqual(["Stone fabrication"]);
  });

  it("persists only the current version and recovers from corrupt browser storage", () => {
    const { storage, values } = memoryStorage();
    const draft = createEmptySteelHomeProjectDraft();
    draft.location = "39564";
    draft.stateCode = "MS";
    draft.countyFips = "28059";
    draft.countyName = "Jackson County";
    draft.countertops.included = true;
    draft.countertops.stoneId = "taj-mahal";

    expect(saveSteelHomeProjectDraft(storage, draft)).toBe(true);
    expect(loadSteelHomeProjectDraft(storage)).toMatchObject({
      location: "39564",
      stateCode: "MS",
      countyFips: "28059",
      countyName: "Jackson County",
      countertops: { included: true, stoneId: "taj-mahal" },
    });

    values.set(
      STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...draft, version: STEEL_HOME_PROJECT_DRAFT_VERSION - 1 })
    );
    expect(loadSteelHomeProjectDraft(storage).location).toBe("");

    values.set(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY, "{not-json");
    expect(loadSteelHomeProjectDraft(storage)).toEqual(createEmptySteelHomeProjectDraft());
    expect(values.has(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toBe(false);

    saveSteelHomeProjectDraft(storage, draft);
    clearSteelHomeProjectDraft(storage);
    expect(values.has(STEEL_HOME_PROJECT_DRAFT_STORAGE_KEY)).toBe(false);
  });

  it("uses every real named catalog record and a vendor-neutral alias for its exact photo", () => {
    expect(JW_STONE_NAMED_CATALOG.length).toBeGreaterThan(20);
    for (const stone of JW_STONE_NAMED_CATALOG) {
      expect(stone.anonymous).toBe(false);
      expect(stone.nameStatus).not.toBe("placeholder");
      expect(stone.publicLabel.trim()).not.toBe("");
      expect(stone.images[0]).toMatch(/^\/images\//);
      expect(getCatalogItemById(stone.id)).toBe(stone);
      const designerImage = buildStoneDesignerImageHref(stone.id);
      expect(designerImage).toBe(`/images/stone-designer/${stone.id}/1.webp`);
      expect(designerImage.toLowerCase()).not.toContain("jw-stone");
    }
  });

  it("calculates honest planning quantities without presenting a final field measure", () => {
    const draft = createEmptySteelHomeProjectDraft();
    expect(calculateCountertopSquareFeet(draft.countertops)).toBe(58.2);
    expect(calculateCabinetPlannedWidth(draft.cabinets)).toBe(198);

    draft.countertops.layout = "straight";
    draft.countertops.island = false;
    draft.countertops.wallAIn = 120;
    expect(calculateCountertopSquareFeet(draft.countertops)).toBe(21.3);
  });

  it("carries exact completed designs and the selected real stone into a targeted TradeScout review", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.location = "Ocean Springs, MS 39564";
    draft.stateCode = "MS";
    draft.countyFips = "28059";
    draft.countyName = "Jackson County";
    draft.timing = "Within 6 months";
    draft.building.included = true;
    draft.building.widthFt = 54;
    draft.countertops.included = true;
    draft.countertops.stoneId = "taj-mahal";
    draft.countertops.wallAIn = 132;
    draft.cabinets.included = true;
    draft.cabinets.doorStyle = "Slab";

    const description = buildSteelHomeProjectDescription(draft);
    expect(description).toContain("54' wide × 60' long × 14' eave");
    expect(description).toContain("Project location: Ocean Springs, MS 39564 — Jackson County, MS");
    expect(description).toContain("Taj Mahal — Quartzite");
    expect(description).toContain("Stone record: taj-mahal");
    expect(description).toContain("Stone image: /images/stone-designer/taj-mahal/1.webp");
    expect(description).toContain('Wall runs: 132" × 96"');
    expect(description).toContain("Style: Slab");
    expect(description).toContain("Final field measurements");
    expect(description.length).toBeLessThanOrEqual(2000);

    const href = buildSteelHomeProjectRequestHref(
      "/direct-connect?target=old-target&intent=hire&contractorId=old-contractor",
      draft
    );
    const url = new URL(href, "https://www.thetradescout.com");
    expect(url.pathname).toBe("/direct-connect");
    expect(url.searchParams.get("profile")).toBe("steel-home-packages");
    expect(url.searchParams.get("profileName")).toBe("TradeScout project desk");
    expect(url.searchParams.get("source")).toBe("steel_home_project_tools");
    expect(url.searchParams.get("subject")).toBe("product");
    expect(url.searchParams.get("title")).toBe(
      "Steel-home design review: Building + Countertops + Cabinets"
    );
    expect(url.searchParams.get("description")).toBe(description);
    expect(url.searchParams.get("location")).toBe("Ocean Springs, MS 39564");
    expect(url.searchParams.get("county")).toBe("28059");
    expect(url.searchParams.get("state")).toBe("MS");
    expect(url.searchParams.get("when")).toBe("Within 6 months");
    expect(url.searchParams.has("target")).toBe(false);
    expect(url.searchParams.has("intent")).toBe(false);
    expect(url.searchParams.has("contractorId")).toBe(false);

    for (const forbidden of FORBIDDEN_PUBLIC_NAMES) {
      expect(href.toLowerCase()).not.toContain(forbidden.toLowerCase());
      expect(description.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("keeps local labor untargeted while retaining related design context", () => {
    const draft = createEmptySteelHomeProjectDraft();
    draft.location = "Biloxi, MS";
    draft.stateCode = "MS";
    draft.countyFips = "28047";
    draft.countyName = "Harrison County";
    draft.countertops.included = true;
    draft.countertops.stoneId = "cristallo";
    draft.labor.trades = ["Stone fabrication", "Countertop installation"];

    const href = buildSteelHomeLaborRequestHref(
      "/direct-connect?profile=steel-home-packages&target=someone&targetProviderId=provider",
      draft
    );
    const url = new URL(href, "https://www.thetradescout.com");
    expect(url.searchParams.get("subject")).toBe("service");
    expect(url.searchParams.get("source")).toBe("steel_home_project_tools_labor");
    expect(url.searchParams.get("county")).toBe("28047");
    expect(url.searchParams.get("state")).toBe("MS");
    expect(url.searchParams.get("description")).toContain(
      "Countertop concept: Kitchen; Cristallo (cristallo); 58.2 sq. ft. approximate"
    );
    for (const target of ["profile", "profileName", "target", "targetProviderId", "contractorId"]) {
      expect(url.searchParams.has(target)).toBe(false);
    }
  });
});
