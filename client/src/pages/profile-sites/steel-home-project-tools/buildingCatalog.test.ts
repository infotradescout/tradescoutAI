import { describe, expect, it } from "vitest";
import {
  BUILDING_ACCESSORIES,
  BUILDING_ATTACHMENTS,
  BUILDING_CATALOG_REVIEWED_ON,
  BUILDING_CATALOG_SOURCE_IDS,
  BUILDING_OPENINGS,
  BUILDING_ROOFS,
  BUILDING_SYSTEMS,
  BUILDING_USES,
  isRoofSupportedBySystem,
} from "./buildingCatalog";

describe("buildingCatalog", () => {
  it("is dated, source-backed, and partner-neutral in customer-facing labels", () => {
    expect(BUILDING_CATALOG_REVIEWED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(BUILDING_CATALOG_SOURCE_IDS.length).toBeGreaterThanOrEqual(6);

    const labels = [
      ...BUILDING_USES,
      ...BUILDING_SYSTEMS,
      ...BUILDING_ROOFS,
      ...BUILDING_OPENINGS,
      ...BUILDING_ATTACHMENTS,
      ...BUILDING_ACCESSORIES,
    ]
      .map((entry) => entry.label)
      .join(" ");
    expect(labels).not.toMatch(/worldwide|supplier|dealer/i);
  });

  it("covers the sold capability families without duplicate identifiers", () => {
    expect(BUILDING_USES.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["barndominium", "home-with-shop", "arena", "hangar", "mini-storage"])
    );
    expect(BUILDING_ROOFS.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["gable", "single-slope", "gambrel", "monitor", "hip", "asymmetrical"])
    );
    expect(BUILDING_OPENINGS.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["overhead-door", "hangar-bifold", "hangar-hydraulic", "skylight"])
    );
    expect(BUILDING_SYSTEMS.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "open-web-truss",
        "tube-leg-open-web",
        "light-gauge-steel",
        "tapered-clearspan",
        "modular-rigid-frame",
        "hybrid-web-truss",
      ])
    );

    for (const entries of [
      BUILDING_USES,
      BUILDING_SYSTEMS,
      BUILDING_ROOFS,
      BUILDING_OPENINGS,
      BUILDING_ATTACHMENTS,
      BUILDING_ACCESSORIES,
    ]) {
      expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
      expect(entries.every((entry) => entry.sourceIds.length > 0)).toBe(true);
    }
  });

  it("retains published range meaning instead of presenting typical dimensions as hard limits", () => {
    const openWeb = BUILDING_SYSTEMS.find((system) => system.id === "open-web-truss");
    const tapered = BUILDING_SYSTEMS.find((system) => system.id === "tapered-clearspan");
    const tubeLeg = BUILDING_SYSTEMS.find((system) => system.id === "tube-leg-open-web");
    expect(openWeb?.widthRange).toMatchObject({ min: 12, max: 100, meaning: "published" });
    expect(tapered?.widthRange).toMatchObject({ min: 40, max: 150, meaning: "published-typical" });
    expect(tubeLeg?.widthRange).toMatchObject({ min: 12, max: 60, meaning: "published" });
    expect(isRoofSupportedBySystem("modular-rigid-frame", "gambrel")).toBe(false);
    expect(isRoofSupportedBySystem("open-web-truss", "monitor")).toBe(true);
  });
});
