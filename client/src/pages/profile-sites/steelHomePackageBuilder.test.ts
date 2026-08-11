import { describe, expect, it } from "vitest";
import {
  STEEL_HOME_PACKAGE_DRAFT_STORAGE_KEY,
  buildSteelHomeLaborRequestHref,
  buildSteelHomePackageRequestHref,
  createEmptySteelHomePackageDraft,
  getSteelHomeDraftReadiness,
  loadSteelHomePackageDraft,
  reconcileSteelHomePackageDraft,
  saveSteelHomePackageDraft,
  type SteelHomeDraftStorage,
} from "./steelHomePackageBuilder";

class MemoryStorage implements SteelHomeDraftStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("steelHomePackageBuilder", () => {
  it("reconciles malformed and unsupported selections into a safe draft", () => {
    expect(
      reconcileSteelHomePackageDraft({
        version: 99,
        location: "  Hammond, LA  ",
        packages: ["structure", "bad", "structure"],
        startingPoint: "wrong",
        stone: { stoneIds: ["cristallo", "made-up-stone"] },
      })
    ).toMatchObject({
      version: 1,
      location: "Hammond, LA",
      packages: ["structure"],
      startingPoint: "",
      stone: { stoneIds: ["cristallo"] },
    });
  });

  it("persists a versioned browser draft and recovers from corrupt storage", () => {
    const storage = new MemoryStorage();
    const draft = {
      ...createEmptySteelHomePackageDraft(),
      location: "70451",
      packages: ["structure" as const],
    };
    expect(saveSteelHomePackageDraft(storage, draft)).toBe(true);
    expect(loadSteelHomePackageDraft(storage)).toMatchObject(draft);

    storage.setItem(STEEL_HOME_PACKAGE_DRAFT_STORAGE_KEY, "{broken");
    expect(loadSteelHomePackageDraft(storage)).toEqual(createEmptySteelHomePackageDraft());
    expect(storage.getItem(STEEL_HOME_PACKAGE_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("creates a product/material handoff with real selections and project context", () => {
    const draft = reconcileSteelHomePackageDraft({
      ...createEmptySteelHomePackageDraft(),
      location: "Natalbany, LA 70451",
      timing: "Within 6 months",
      startingPoint: "plans",
      packages: ["structure", "stone", "cabinets"],
      structure: {
        footprint: "Home with garage and shop",
        roofline: "Classic gable",
        levels: "One level",
        sizeEstimate: "2,400 sq. ft.",
        notes: "Deep front porch",
      },
      stone: {
        roomUses: ["Kitchen", "Bathrooms"],
        direction: "Warm and earthy",
        stoneIds: ["cristallo", "taj-mahal"],
        notes: "Include the island",
      },
      cabinets: {
        rooms: ["Kitchen", "Pantry", "Laundry"],
        finishDirection: "Warm natural wood",
        designStage: "Design from my plans",
        notes: "Full-height pantry storage",
      },
      labor: {
        trades: ["Foundation", "Steel erection"],
        notes: "Price labor separately",
      },
    });

    const href = buildSteelHomePackageRequestHref(
      "/direct-connect?profile=steel-home-packages&intent=fix_improve&subject=service",
      draft
    );
    const url = new URL(href, "https://www.thetradescout.com");
    expect(url.pathname).toBe("/direct-connect");
    expect(url.searchParams.get("profile")).toBe("steel-home-packages");
    expect(url.searchParams.get("source")).toBe("steel_home_package_builder");
    expect(url.searchParams.get("subject")).toBe("product");
    expect(url.searchParams.has("intent")).toBe(false);
    expect(url.searchParams.get("location")).toBe("Natalbany, LA 70451");
    expect(url.searchParams.get("when")).toBe("Within 6 months");
    expect(url.searchParams.get("description")).toContain("Cristallo, Taj Mahal");
    expect(url.searchParams.get("description")).toContain("Full-height pantry storage");
    expect(url.searchParams.get("description")).toContain("Steel erection");
    expect(getSteelHomeDraftReadiness(draft).packageReady).toBe(true);
  });

  it("keeps labor untargeted while carrying the matching package context", () => {
    const draft = reconcileSteelHomePackageDraft({
      ...createEmptySteelHomePackageDraft(),
      location: "Biloxi, MS",
      packages: ["structure", "cabinets"],
      labor: { trades: ["Site work", "Cabinet installation"], notes: "Bid both" },
    });
    const href = buildSteelHomeLaborRequestHref(
      "/direct-connect?profile=steel-home-packages&target=steward&intent=hire",
      draft
    );
    const url = new URL(href, "https://www.thetradescout.com");
    expect(url.searchParams.get("source")).toBe("steel_home_package_builder_labor");
    expect(url.searchParams.get("subject")).toBe("service");
    expect(url.searchParams.has("profile")).toBe(false);
    expect(url.searchParams.has("target")).toBe(false);
    expect(url.searchParams.has("intent")).toBe(false);
    expect(url.searchParams.get("description")).toContain("Metal structure, Cabinets");
    expect(url.searchParams.get("description")).toContain("Cabinet installation");
    expect(getSteelHomeDraftReadiness(draft).laborReady).toBe(true);
  });
});
