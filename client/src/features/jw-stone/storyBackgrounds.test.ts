import { describe, expect, it } from "vitest";
import {
  COLOR_COLLAGE_STRIPS,
  FINISHED_WORK_BRIDGE_BACKGROUND,
  INVENTORY_SECTION_BACKGROUND,
  JW_FINISHED_WORK_PHOTOS,
  MATERIAL_COLLAGE_STRIPS,
  MATERIAL_SECTION_BACKGROUND,
} from "./storyBackgrounds";

describe("JW story backgrounds", () => {
  it("uses one face per color, multiple material faces, and the inventory yard", () => {
    expect(COLOR_COLLAGE_STRIPS).toHaveLength(8);
    expect(COLOR_COLLAGE_STRIPS.every((strip) => strip.src.includes("/color-slivers/"))).toBe(true);

    const colorJoined = COLOR_COLLAGE_STRIPS.map((strip) => strip.src).join(" ");
    expect(colorJoined).toContain("preto-sao-gabriel.webp");
    expect(colorJoined).toContain("blue-dream.webp");
    expect(colorJoined).toContain("gold-macaubas.webp");
    expect(colorJoined).not.toContain("/inventory/");
    expect(colorJoined).not.toContain("/inventory-source/");
    expect(colorJoined).not.toContain("/black-pearl/");

    expect(MATERIAL_COLLAGE_STRIPS).toHaveLength(5);
    expect(MATERIAL_COLLAGE_STRIPS.every((strip) => strip.src.includes("/material-covers/"))).toBe(
      true
    );
    expect(new Set(MATERIAL_COLLAGE_STRIPS.map((strip) => strip.src)).size).toBe(
      MATERIAL_COLLAGE_STRIPS.length
    );

    expect(MATERIAL_SECTION_BACKGROUND.src).toContain(
      "/inventory-source/10hwbokQWc-hgPGqXhdKkuLRjs4a6Zbfd.webp"
    );
    expect(MATERIAL_SECTION_BACKGROUND.src).not.toContain("/story/");
    expect(MATERIAL_SECTION_BACKGROUND.src).not.toContain("/material-covers/");
    expect(MATERIAL_SECTION_BACKGROUND.src).not.toContain("/color-collage/");

    expect(INVENTORY_SECTION_BACKGROUND.src).toContain("/story/full-inventory-yard.webp");
    expect(INVENTORY_SECTION_BACKGROUND.src).not.toContain("taj-living-room");
    expect(INVENTORY_SECTION_BACKGROUND.src).not.toBe(MATERIAL_SECTION_BACKGROUND.src);
    expect(INVENTORY_SECTION_BACKGROUND.src).not.toContain("/material-covers/");
    expect(INVENTORY_SECTION_BACKGROUND.src).not.toContain("/color-collage/");

    expect(FINISHED_WORK_BRIDGE_BACKGROUND.src).toContain("/story/mont-blanc-bar.webp");
    expect(JW_FINISHED_WORK_PHOTOS.length).toBeGreaterThanOrEqual(3);
    expect(JW_FINISHED_WORK_PHOTOS.every((photo) => photo.src.includes("/story/"))).toBe(true);
    expect(JW_FINISHED_WORK_PHOTOS.some((photo) => photo.src.includes("quarry"))).toBe(false);
    expect("label" in MATERIAL_SECTION_BACKGROUND).toBe(false);
    expect("label" in INVENTORY_SECTION_BACKGROUND).toBe(false);
  });
});
