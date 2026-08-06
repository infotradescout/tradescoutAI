import { describe, expect, it } from "vitest";
import {
  COLOR_COLLAGE_STRIPS,
  FINISHED_WORK_BRIDGE_BACKGROUND,
  INVENTORY_SECTION_BACKGROUND,
  JW_FINISHED_WORK_PHOTOS,
  MATERIAL_SECTION_BACKGROUND,
} from "./storyBackgrounds";

describe("JW story backgrounds", () => {
  it("uses face-only color-collage strips for browse-by-color", () => {
    expect(COLOR_COLLAGE_STRIPS).toHaveLength(8);
    expect(COLOR_COLLAGE_STRIPS.every((strip) => strip.src.includes("/color-collage/"))).toBe(true);
    const joined = COLOR_COLLAGE_STRIPS.map((strip) => strip.src).join(" ");
    expect(joined).toContain("04-black.webp");
    expect(joined).toContain("07-blue.webp");
    expect(joined).toContain("08-red.webp");
    // Never mount raw yard inventory leads (hands / sky / clamps / reflections).
    expect(joined).not.toContain("/inventory/");
    expect(joined).not.toContain("/inventory-source/");
    expect(joined).not.toContain("/black-pearl/");
    expect(MATERIAL_SECTION_BACKGROUND.src).toContain("/inventory-source/");
    expect(MATERIAL_SECTION_BACKGROUND.src).not.toContain("/story/");
    expect(INVENTORY_SECTION_BACKGROUND.src).toContain("/story/taj-living-room.webp");
    expect(FINISHED_WORK_BRIDGE_BACKGROUND.src).toContain("/story/mont-blanc-bar.webp");
    expect(JW_FINISHED_WORK_PHOTOS.length).toBeGreaterThanOrEqual(3);
    expect(JW_FINISHED_WORK_PHOTOS.every((photo) => photo.src.includes("/story/"))).toBe(true);
    expect(JW_FINISHED_WORK_PHOTOS.some((photo) => photo.src.includes("quarry"))).toBe(false);
    expect("label" in MATERIAL_SECTION_BACKGROUND).toBe(false);
    expect("label" in INVENTORY_SECTION_BACKGROUND).toBe(false);
  });
});
